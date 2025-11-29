const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene l'elenco dei centri con filtri opzionali
 */
const getCentri = async (req, res, next) => {
  try {
    const { tipo, nome, raggio, lat, lng, page = 1, limit = 20, associatiA } = req.query;
    const offset = (page - 1) * limit;
    
    // Filtra in base al ruolo dell'attore
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Costruisci la query di base
    let query = `
      SELECT c.*, ct.descrizione as tipo_descrizione
      FROM Centri c
      JOIN CentriTipi ct ON c.tipo_id = ct.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Se è specificato un ID attore per le associazioni
    if (associatiA) {
      query = `
        SELECT c.*, ct.descrizione as tipo_descrizione
        FROM Centri c
        JOIN CentriTipi ct ON c.tipo_id = ct.id
        JOIN AttoriCentri uc ON c.id = uc.centro_id
        WHERE uc.attore_id = ?
      `;
      params.push(parseInt(associatiA));
    }
    // Se è un amministratore, filtra per i centri di sua competenza
    else if (isAdmin) {
      // Modifichiamo la query per ottenere solo i centri associati all'amministratore
      query = `
        SELECT c.*, ct.descrizione as tipo_descrizione
        FROM Centri c
        JOIN CentriTipi ct ON c.tipo_id = ct.id
        WHERE 1=1
        AND (
          EXISTS (
            SELECT 1 FROM AttoriCentri uc
            WHERE uc.attore_id = ? AND uc.centro_id = c.id
          )
          OR NOT EXISTS (
            SELECT 1 FROM AttoriCentri uc2
            WHERE uc2.centro_id = c.id
          )
        )
      `;
      
      params.push(req.user.id);
    }
    
    // Applicazione dei filtri
    if (tipo) {
      query += ' AND ct.descrizione LIKE ?';
      params.push(`%${tipo}%`);
    }
    
    if (nome) {
      query += ' AND c.nome LIKE ?';
      params.push(`%${nome}%`);
    }
    
    // Calcolo della distanza se sono fornite coordinate
    if (raggio && lat && lng) {
      // Aggiungi calcolo della distanza usando formula di Haversine
      // Preserviamo la condizione di filtro dell'amministratore
      let baseQuery = isAdmin && !associatiA ? 
        `
          SELECT c.*, ct.descrizione as tipo_descrizione
          FROM Centri c
          JOIN CentriTipi ct ON c.tipo_id = ct.id
          WHERE 1=1
          AND (
            EXISTS (
              SELECT 1 FROM AttoriCentri uc
              WHERE uc.attore_id = ? AND uc.centro_id = c.id
            )
            OR NOT EXISTS (
              SELECT 1 FROM AttoriCentri uc2
              WHERE uc2.centro_id = c.id
            )
          )
        ` : 
        associatiA ? 
        `
          SELECT c.*, ct.descrizione as tipo_descrizione
          FROM Centri c
          JOIN CentriTipi ct ON c.tipo_id = ct.id
          JOIN AttoriCentri uc ON c.id = uc.centro_id
          WHERE uc.attore_id = ?
        ` :
        `
          SELECT c.*, ct.descrizione as tipo_descrizione
          FROM Centri c
          JOIN CentriTipi ct ON c.tipo_id = ct.id
          WHERE 1=1
        `;
      
      query = `
        ${baseQuery},
        (
          6371 * acos(
            cos(radians(?)) * 
            cos(radians(c.latitudine)) * 
            cos(radians(c.longitudine) - radians(?)) + 
            sin(radians(?)) * 
            sin(radians(c.latitudine))
          )
        ) AS distanza
      `;
      
      if (isAdmin && !associatiA) {
        params.push(req.user.id);
      } else if (associatiA) {
        params.push(parseInt(associatiA));
      }
      
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat));
      
      // Filtra per raggio
      query += ` AND (
        6371 * acos(
          cos(radians(?)) * 
          cos(radians(c.latitudine)) * 
          cos(radians(c.longitudine) - radians(?)) + 
          sin(radians(?)) * 
          sin(radians(c.latitudine))
        )
      ) <= ?`;
      
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(raggio));
    }
    
    // Query per conteggio totale
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    
    // Aggiungi ordinamento e paginazione
    if (raggio && lat && lng) {
      query += ' ORDER BY distanza ASC';
    } else {
      query += ' ORDER BY c.nome ASC';
    }
    
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Esegui entrambe le query
    const totalResult = await db.get(countQuery, params.slice(0, params.length - 2));
    const centri = await db.all(query, params);
    
    // Calcola paginazione
    const total = totalResult.total;
    const pages = Math.ceil(total / limit);
    
    res.json({
      data: centri,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene i dettagli di un singolo centro
 */
const getCentroById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Se è un amministratore, verificare che abbia accesso a questo centro
    if (isAdmin) {
      const accessQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE attore_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo centro
      const existsQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se ci sono associazioni ma l'amministratore non ha accesso, blocca la richiesta
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo centro');
      }
    }
    
    const query = `
      SELECT c.*, ct.descrizione as tipo_descrizione
      FROM Centri c
      JOIN CentriTipi ct ON c.tipo_id = ct.id
      WHERE c.id = ?
    `;
    
    const centro = await db.get(query, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Recupera dati aggiuntivi sul centro
    // 1. Numero di utenti associati
    const utentiQuery = `
      SELECT COUNT(*) as total_utenti
      FROM AttoriCentri
      WHERE centro_id = ?
    `;
    
    // 2. Statistiche lotti
    const lottiQuery = `
      SELECT 
        COUNT(*) as total_lotti,
        COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as lotti_verdi,
        COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as lotti_arancioni,
        COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as lotti_rossi
      FROM Lotti
      WHERE centro_origine_id = ?
    `;
    
    // 3. Statistiche prenotazioni
    const prenotazioniQuery = `
      SELECT 
        COUNT(*) as total_prenotazioni,
        COUNT(CASE WHEN stato = 'Prenotato' THEN 1 END) as prenotazioni_attive,
        COUNT(CASE WHEN stato = 'Consegnato' THEN 1 END) as prenotazioni_completate
      FROM Prenotazioni
      WHERE centro_ricevente_id = ?
    `;
    
    // Esegui tutte le query in parallelo
    const [utentiStats, lottiStats, prenotazioniStats] = await Promise.all([
      db.get(utentiQuery, [id]),
      db.get(lottiQuery, [id]),
      db.get(prenotazioniQuery, [id])
    ]);
    
    // Combina i risultati
    const result = {
      ...centro,
      statistiche: {
        utenti: utentiStats.total_utenti,
        lotti: lottiStats,
        prenotazioni: prenotazioniStats
      }
    };
    
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un nuovo centro
 */
const createCentro = async (req, res, next) => {
  try {
    const { 
      nome, 
      tipo_id, 
      indirizzo, 
      telefono, 
      email, 
      latitudine, 
      longitudine,
      tipo 
    } = req.body;
    
    let tipoCentro = null;
    // Verifica che il tipo di centro esista, solo se è stato fornito
    if (tipo_id) {
      // Verifica che tipo_id sia un numero intero
      if (!Number.isInteger(Number(tipo_id))) {
        throw new ApiError(400, 'Tipo ID deve essere un numero intero');
      }

      const tipoQuery = `SELECT * FROM CentriTipi WHERE id = ?`;
      tipoCentro = await db.get(tipoQuery, [tipo_id]);
      
      if (!tipoCentro) {
        throw new ApiError(400, 'Tipo di centro non valido');
      }
    }
    
    // Verifica che non esista già un centro con lo stesso nome
    const centroEsistenteQuery = `SELECT id FROM Centri WHERE nome = ?`;
    const centroEsistente = await db.get(centroEsistenteQuery, [nome]);
    
    if (centroEsistente) {
      throw new ApiError(409, 'Esiste già un centro con questo nome');
    }
    
    // Se non è stato fornito un tipo ma solo tipo_id, ottieni il tipo dalla tabella CentriTipi
    const tipoValue = tipo || (tipoCentro ? tipoCentro.descrizione : null);
    
    // Verifica che sia presente almeno un campo tipo
    if (!tipoValue && !tipo_id) {
      throw new ApiError(400, 'È necessario specificare un tipo per il centro');
    }
    
    // Inserisci il nuovo centro
    const insertQuery = `
      INSERT INTO Centri (
        nome, tipo, indirizzo, telefono, email,
        latitudine, longitudine, tipo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.run(
      insertQuery, 
      [
        nome,
        tipoValue,
        indirizzo,
        telefono || null,
        email || null,
        latitudine || null,
        longitudine || null,
        tipo_id || null  // Usa null se tipo_id non è stato fornito
      ]
    );
    
    if (!result.lastID) {
      throw new ApiError(500, 'Errore durante la creazione del centro');
    }
    
    // Associa automaticamente l'amministratore che ha creato il centro
    if (req.user && req.user.ruolo === 'Amministratore') {
      logger.info(`Associazione automatica dell'amministratore ID ${req.user.id} al centro ID ${result.lastID}`);
      
      // Verifica che l'amministratore non sia già associato al centro (per sicurezza)
      const associazioneEsistenteQuery = `
        SELECT 1 FROM AttoriCentri
        WHERE attore_id = ? AND centro_id = ?
      `;
      
      const associazioneEsistente = await db.get(associazioneEsistenteQuery, [req.user.id, result.lastID]);
      
      if (!associazioneEsistente) {
        // Crea l'associazione
        const insertAssociazioneQuery = `
          INSERT INTO AttoriCentri (
            attore_id, centro_id, ruolo_specifico
          ) VALUES (?, ?, ?)
        `;
        
        await db.run(insertAssociazioneQuery, [req.user.id, result.lastID, 'SuperAdmin']);
        logger.info(`Amministratore ID ${req.user.id} associato con successo al centro ID ${result.lastID}`);
      }
    }
    
    // Recupera il centro appena creato - senza join per essere sicuri di ottenerlo
    const centro = await db.get(
      'SELECT * FROM Centri WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json(centro);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggiorna un centro esistente
 */
const updateCentro = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      nome, 
      tipo_id, 
      indirizzo, 
      telefono, 
      email, 
      latitudine, 
      longitudine, 
      descrizione, 
      orari_apertura 
    } = req.body;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Se è fornito un tipo_id, verifica che esista
    if (tipo_id) {
      const tipoQuery = `SELECT * FROM CentriTipi WHERE id = ?`;
      const tipo = await db.get(tipoQuery, [tipo_id]);
      
      if (!tipo) {
        throw new ApiError(400, 'Tipo di centro non valido');
      }
    }
    
    // Se è fornito un nome, verifica che non sia già usato da un altro centro
    if (nome && nome !== centro.nome) {
      const centroEsistenteQuery = `SELECT id FROM Centri WHERE nome = ? AND id != ?`;
      const centroEsistente = await db.get(centroEsistenteQuery, [nome, id]);
      
      if (centroEsistente) {
        throw new ApiError(409, 'Esiste già un centro con questo nome');
      }
    }
    
    // Costruisci la query di aggiornamento
    let updateQuery = `UPDATE Centri SET `;
    const updateFields = [];
    const updateParams = [];
    
    if (nome !== undefined) {
      updateFields.push('nome = ?');
      updateParams.push(nome);
    }
    
    if (tipo_id !== undefined) {
      updateFields.push('tipo_id = ?');
      updateParams.push(tipo_id);
    }
    
    if (indirizzo !== undefined) {
      updateFields.push('indirizzo = ?');
      updateParams.push(indirizzo);
    }
    
    if (telefono !== undefined) {
      updateFields.push('telefono = ?');
      updateParams.push(telefono);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateParams.push(email);
    }
    
    if (latitudine !== undefined) {
      updateFields.push('latitudine = ?');
      updateParams.push(latitudine);
    }
    
    if (longitudine !== undefined) {
      updateFields.push('longitudine = ?');
      updateParams.push(longitudine);
    }
    
    if (descrizione !== undefined) {
      updateFields.push('descrizione = ?');
      updateParams.push(descrizione);
    }
    
    if (orari_apertura !== undefined) {
      updateFields.push('orari_apertura = ?');
      updateParams.push(orari_apertura);
    }
    
    // Se non ci sono campi da aggiornare
    if (updateFields.length === 0) {
      throw new ApiError(400, 'Nessun dato valido fornito per l\'aggiornamento');
    }
    
    updateQuery += updateFields.join(', ');
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);
    
    // Esegui l'aggiornamento
    await db.run(updateQuery, updateParams);
    
    // Recupera il centro aggiornato
    const centroAggiornato = await db.get(
      'SELECT c.*, ct.descrizione as tipo_descrizione FROM Centri c JOIN CentriTipi ct ON c.tipo_id = ct.id WHERE c.id = ?',
      [id]
    );
    
    res.json(centroAggiornato);
  } catch (error) {
    next(error);
  }
};

/**
 * Elimina un centro
 */
const deleteCentro = async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await connection.query(centroQuery, [id]);
    
    if (!centro[0]) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Verifica che non ci siano lotti attivi associati a questo centro
    const lottiQuery = `
      SELECT COUNT(*) as count FROM Lotti 
      WHERE centro_origine_id = ? 
      AND stato IN ('Verde', 'Arancione')
    `;
    
    const lottiResult = await connection.query(lottiQuery, [id]);
    
    if (lottiResult[0].count > 0) {
      throw new ApiError(400, 'Impossibile eliminare il centro: ci sono lotti attivi associati');
    }
    
    // Verifica che non ci siano prenotazioni attive associate a questo centro
    const prenotazioniQuery = `
      SELECT COUNT(*) as count FROM Prenotazioni 
      WHERE centro_ricevente_id = ? 
      AND stato IN ('Prenotato', 'InTransito')
    `;
    
    const prenotazioniResult = await connection.query(prenotazioniQuery, [id]);
    
    if (prenotazioniResult[0].count > 0) {
      throw new ApiError(400, 'Impossibile eliminare il centro: ci sono prenotazioni attive associate');
    }
    
    // Elimina tutte le associazioni attore-centro
    await connection.query(
      'DELETE FROM AttoriCentri WHERE centro_id = ?',
      [id]
    );
    
    // Archivia i lotti associati al centro invece di eliminarli
    // Prima copia nella tabella archivio
    await connection.query(`
      INSERT INTO LottiArchivio 
      SELECT *, NOW() as data_archiviazione 
      FROM Lotti 
      WHERE centro_origine_id = ?
    `, [id]);
    
    // Poi elimina dalla tabella attiva
    await connection.query(
      'DELETE FROM Lotti WHERE centro_origine_id = ?',
      [id]
    );
    
    // Archivia le prenotazioni associate al centro
    await connection.query(`
      INSERT INTO PrenotazioniArchivio 
      SELECT *, NOW() as data_archiviazione 
      FROM Prenotazioni 
      WHERE centro_ricevente_id = ?
    `, [id]);
    
    // Elimina dalla tabella attiva
    await connection.query(
      'DELETE FROM Prenotazioni WHERE centro_ricevente_id = ?',
      [id]
    );
    
    // Elimina il centro
    await connection.query(
      'DELETE FROM Centri WHERE id = ?',
      [id]
    );
    
    await connection.commit();
    
    res.json({
      message: 'Centro eliminato con successo',
      id: parseInt(id)
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Ottiene tutti i tipi di centro
 */
const getCentriTipi = async (req, res, next) => {
  try {
    const query = `SELECT * FROM CentriTipi ORDER BY descrizione`;
    const tipi = await db.all(query);
    
    res.json(tipi);
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene gli utenti associati a un centro
 */
const getCentroAttori = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Se è un amministratore, verificare che abbia accesso a questo centro
    if (isAdmin) {
      const accessQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE attore_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo centro
      const existsQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se ci sono associazioni ma l'amministratore non ha accesso, blocca la richiesta
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo centro');
      }
    }
    
    // Ottieni gli utenti associati
    const utentiQuery = `
      SELECT u.id, u.nome, u.cognome, u.email, u.ruolo
      FROM Attori u
      JOIN AttoriCentri uc ON u.id = uc.attore_id
      WHERE uc.centro_id = ?
      ORDER BY u.cognome, u.nome
    `;
    
    const utenti = await db.all(utentiQuery, [id]);
    
    res.json(utenti);
  } catch (error) {
    next(error);
  }
};

/**
 * Associa un attore a un centro
 */
const associaAttore = async (req, res, next) => {
  try {
    const { id, attore_id } = req.params;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Verifica che l'attore esista
    const attoreQuery = `SELECT * FROM Attori WHERE id = ?`;
    const attore = await db.get(attoreQuery, [attore_id]);
    
    if (!attore) {
      throw new ApiError(404, 'Attore non trovato');
    }
    
    // Verifica che l'attore non sia già associato al centro
    const associazioneQuery = `
      SELECT 1 FROM AttoriCentri
      WHERE attore_id = ? AND centro_id = ?
    `;
    
    const associazioneEsistente = await db.get(associazioneQuery, [attore_id, id]);
    
    if (associazioneEsistente) {
      throw new ApiError(409, 'Attore già associato a questo centro');
    }
    
    // Crea l'associazione
    const insertQuery = `
      INSERT INTO AttoriCentri (
        attore_id, centro_id
      ) VALUES (?, ?)
    `;
    
    await db.run(insertQuery, [attore_id, id]);
    
    res.status(201).json({
      message: 'Attore associato al centro con successo',
      attore_id: parseInt(attore_id),
      centro_id: parseInt(id)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rimuove un attore da un centro
 */
const rimuoviAttore = async (req, res, next) => {
  try {
    const { id, attore_id } = req.params;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Verifica che l'attore esista
    const attoreQuery = `SELECT * FROM Attori WHERE id = ?`;
    const attore = await db.get(attoreQuery, [attore_id]);
    
    if (!attore) {
      throw new ApiError(404, 'Attore non trovato');
    }
    
    // Verifica che l'attore sia effettivamente associato al centro
    const associazioneQuery = `
      SELECT 1 FROM AttoriCentri
      WHERE attore_id = ? AND centro_id = ?
    `;
    
    const associazioneEsistente = await db.get(associazioneQuery, [attore_id, id]);
    
    if (!associazioneEsistente) {
      throw new ApiError(400, 'Attore non associato a questo centro');
    }
    
    // Elimina l'associazione
    const deleteQuery = `
      DELETE FROM AttoriCentri
      WHERE attore_id = ? AND centro_id = ?
    `;
    
    await db.run(deleteQuery, [attore_id, id]);
    
    res.json({
      message: 'Attore rimosso dal centro con successo',
      attore_id: parseInt(attore_id),
      centro_id: parseInt(id)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene le statistiche di un centro in un periodo specifico
 */
const getCentroStatistiche = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inizio, fine } = req.query;
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Predisponi le condizioni di data
    let dataCondition = '';
    const params = [id];
    
    if (inizio && fine) {
      dataCondition = ' AND data_creazione BETWEEN ? AND ?';
      params.push(inizio, fine);
    } else if (inizio) {
      dataCondition = ' AND data_creazione >= ?';
      params.push(inizio);
    } else if (fine) {
      dataCondition = ' AND data_creazione <= ?';
      params.push(fine);
    }
    
    // Statistiche lotti creati
    const lottiQuery = `
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as verdi,
        COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as arancioni,
        COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as rossi,
        SUM(quantita) as quantita_totale
      FROM Lotti
      WHERE centro_origine_id = ?${dataCondition}
    `;
    
    // Statistiche prenotazioni
    const prenotazioniRicevuteQuery = `
      SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN stato = 'Prenotato' THEN 1 END) as attive,
        COUNT(CASE WHEN stato = 'InTransito' THEN 1 END) as in_transito,
        COUNT(CASE WHEN stato = 'Consegnato' THEN 1 END) as completate,
        COUNT(CASE WHEN stato = 'Annullato' THEN 1 END) as annullate
      FROM Prenotazioni
      WHERE centro_ricevente_id = ?${dataCondition}
    `;
    
    // Statistiche per lotti ricevuti
    const lottiRicevutiQuery = `
      SELECT 
        COUNT(*) as totale,
        SUM(l.quantita) as quantita_totale
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      WHERE p.centro_ricevente_id = ?
      AND p.stato = 'Consegnato'${dataCondition}
    `;
    
    // Calcolo impatto ambientale ed economico
    const impattoQuery = `
      SELECT 
        SUM(ic.co2_risparmiata) as co2_risparmiata,
        SUM(ic.acqua_risparmiata) as acqua_risparmiata,
        SUM(ic.valore_economico) as valore_economico
      FROM Prenotazioni p
      JOIN Lotti l ON p.lotto_id = l.id
      JOIN ImpattoCO2 ic ON l.id = ic.lotto_id
      WHERE (p.centro_ricevente_id = ? OR l.centro_origine_id = ?)
      AND p.stato = 'Consegnato'${dataCondition}
    `;
    
    // Esegui tutte le query in parallelo
    const [
      lottiStats, 
      prenotazioniStats, 
      lottiRicevutiStats, 
      impattoStats
    ] = await Promise.all([
      db.get(lottiQuery, params),
      db.get(prenotazioniRicevuteQuery, params),
      db.get(lottiRicevutiQuery, params),
      db.get(impattoQuery, [...params, id]) // Aggiungi id una seconda volta per OR nella query
    ]);
    
    // Top 5 prodotti più ceduti
    const topProdottiQuery = `
      SELECT 
        l.prodotto,
        SUM(l.quantita) as quantita_totale,
        COUNT(*) as occorrenze
      FROM Lotti l
      WHERE l.centro_origine_id = ?${dataCondition}
      GROUP BY l.prodotto
      ORDER BY quantita_totale DESC
      LIMIT 5
    `;
    
    const topProdotti = await db.all(topProdottiQuery, params);
    
    // Statistiche di andamento temporale (ultimi 6 mesi)
    const andamentoQuery = `
      SELECT 
        strftime('%Y-%m', data_creazione) as mese,
        COUNT(*) as lotti_creati,
        SUM(quantita) as quantita_ceduta
      FROM Lotti
      WHERE centro_origine_id = ?
      AND data_creazione >= date('now', '-6 month')
      GROUP BY mese
      ORDER BY mese
    `;
    
    const andamento = await db.all(andamentoQuery, [id]);
    
    // Prepara risposta
    const statistiche = {
      centro: {
        id: centro.id,
        nome: centro.nome,
        tipo: centro.tipo_id
      },
      periodo: {
        inizio: inizio || 'inizio',
        fine: fine || 'oggi'
      },
      lotti_creati: lottiStats,
      lotti_ricevuti: lottiRicevutiStats,
      prenotazioni: prenotazioniStats,
      impatto_ambientale: impattoStats,
      top_prodotti: topProdotti,
      andamento_mensile: andamento
    };
    
    res.json(statistiche);
  } catch (error) {
    next(error);
  }
};

/**
 * Associa più operatori e/o amministratori a un centro in una singola operazione
 */
const associaOperatori = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { operatori_ids = [], amministratori_ids = [] } = req.body;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    // Verifica che il centro esista
    const centroQuery = `SELECT * FROM Centri WHERE id = ?`;
    const centro = await db.get(centroQuery, [id]);
    
    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }
    
    // Verifica che l'amministratore abbia i permessi necessari (deve essere SuperAdmin del centro)
    const permessiQuery = `
      SELECT ruolo_specifico 
      FROM AttoriCentri 
      WHERE attore_id = ? AND centro_id = ?
    `;
    
    const permessi = await db.get(permessiQuery, [req.user.id, id]);
    const isSuperAdmin = permessi && permessi.ruolo_specifico === 'SuperAdmin';
    
    // Solo il SuperAdmin può aggiungere altri amministratori
    if (amministratori_ids.length > 0 && !isSuperAdmin) {
      throw new ApiError(403, 'Solo il SuperAdmin del centro può aggiungere altri amministratori');
    }
    
    // Se è un amministratore, verificare che abbia accesso a questo centro
    if (isAdmin && !isSuperAdmin) {
      const accessQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE attore_id = ? AND centro_id = ?
      `;
      
      // Verifica se ci sono associazioni per questo centro
      const existsQuery = `
        SELECT 1 FROM AttoriCentri 
        WHERE centro_id = ?
      `;
      
      const hasAccess = await db.get(accessQuery, [req.user.id, id]);
      const existsAssociations = await db.get(existsQuery, [id]);
      
      // Se ci sono associazioni ma l'amministratore non ha accesso, blocca la richiesta
      if (existsAssociations && !hasAccess) {
        throw new ApiError(403, 'Non hai accesso a questo centro');
      }
    }
    
    // Ottieni le associazioni esistenti, divise per ruolo specifico
    const associazioniQuery = `
      SELECT uc.attore_id, u.ruolo, uc.ruolo_specifico
      FROM AttoriCentri uc
      JOIN Attori u ON uc.attore_id = u.id
      WHERE uc.centro_id = ?
    `;
    
    const associazioni = await db.all(associazioniQuery, [id]);
    const superAdmin = associazioni
      .filter(a => a.ruolo_specifico === 'SuperAdmin')
      .map(a => a.attore_id);
    
    logger.info(`Centro ${id}: trovato ${superAdmin.length} SuperAdmin e ${associazioni.length - superAdmin.length} altre associazioni`);
    
    // Rimuovi solo le associazioni degli operatori e amministratori normali, preservando il SuperAdmin
    const deleteOperatoriQuery = `
      DELETE FROM AttoriCentri
      WHERE centro_id = ? AND attore_id IN (
        SELECT uc.attore_id
        FROM AttoriCentri uc
        JOIN Attori u ON uc.attore_id = u.id
        WHERE uc.centro_id = ? AND u.ruolo = 'Operatore'
      )
    `;
    
    const deleteAmministratoriQuery = `
      DELETE FROM AttoriCentri
      WHERE centro_id = ? AND attore_id IN (
        SELECT uc.attore_id
        FROM AttoriCentri uc
        JOIN Attori u ON uc.attore_id = u.id
        WHERE uc.centro_id = ? AND u.ruolo = 'Amministratore' AND uc.ruolo_specifico IS NULL
      )
    `;
    
    // Esegui le query di eliminazione solo se l'attore è SuperAdmin
    if (isSuperAdmin) {
      await db.run(deleteOperatoriQuery, [id, id]);
      await db.run(deleteAmministratoriQuery, [id, id]);
    } else {
      // Se non è SuperAdmin, può gestire solo gli operatori
      await db.run(deleteOperatoriQuery, [id, id]);
    }
    
    // Verifica che tutti gli utenti esistano e associali al centro
    const operatoriPromises = operatori_ids.map(async (attore_id) => {
      const attoreQuery = `SELECT * FROM Attori WHERE id = ? AND ruolo = 'Operatore'`;
      const attore = await db.get(attoreQuery, [attore_id]);
      
      if (!attore) {
        logger.warn(`Attore ID ${attore_id} non trovato o non è un operatore, salto associazione`);
        return null;
      }
      
      // Crea la nuova associazione per l'operatore
      const insertQuery = `
        INSERT INTO AttoriCentri (attore_id, centro_id)
        VALUES (?, ?)
        ON CONFLICT (attore_id, centro_id) DO NOTHING
      `;
      
      await db.run(insertQuery, [attore_id, id]);
      return attore_id;
    });
    
    // Se l'attore è SuperAdmin, può aggiungere anche amministratori
    let amministratoriPromises = [];
    if (isSuperAdmin && amministratori_ids.length > 0) {
      amministratoriPromises = amministratori_ids.map(async (attore_id) => {
        const attoreQuery = `SELECT * FROM Attori WHERE id = ? AND ruolo = 'Amministratore'`;
        const attore = await db.get(attoreQuery, [attore_id]);
        
        if (!attore) {
          logger.warn(`Attore ID ${attore_id} non trovato o non è un amministratore, salto associazione`);
          return null;
        }
        
        // Non permettere di modificare il ruolo di SuperAdmin
        if (superAdmin.includes(Number(attore_id))) {
          logger.warn(`Attore ID ${attore_id} è già SuperAdmin, salto modifica`);
          return attore_id;
        }
        
        // Crea la nuova associazione per l'amministratore (senza ruolo_specifico)
        const insertQuery = `
          INSERT INTO AttoriCentri (attore_id, centro_id)
          VALUES (?, ?)
          ON CONFLICT (attore_id, centro_id) DO NOTHING
        `;
        
        await db.run(insertQuery, [attore_id, id]);
        return attore_id;
      });
    }
    
    // Attendi il completamento di tutte le associazioni
    const operatoriAssociati = (await Promise.all(operatoriPromises)).filter(Boolean);
    const amministratoriAssociati = (await Promise.all(amministratoriPromises)).filter(Boolean);
    
    res.json({
      message: 'Attori associati al centro con successo',
      centro_id: parseInt(id),
      operatori_ids: operatoriAssociati.map(id => parseInt(id)),
      amministratori_ids: amministratoriAssociati.map(id => parseInt(id)),
      super_admin_preservato: superAdmin.length > 0
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCentri,
  getCentroById,
  createCentro,
  updateCentro,
  deleteCentro,
  getCentriTipi,
  getCentroAttori,
  associaAttore,
  rimuoviAttore,
  getCentroStatistiche,
  associaOperatori
};
