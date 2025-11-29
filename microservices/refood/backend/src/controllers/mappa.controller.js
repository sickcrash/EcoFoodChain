const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Ottiene tutti i centri per la mappa
 * Ora accessibile pubblicamente - il controllo del ruolo viene fatto dal frontend
 */
exports.getCentriMappa = async (req, res, next) => {
  try {
    logger.info('Richiesta centri per mappa ricevuta');

    // Query migliorata per ottenere tutti i centri con coordinate
    const centri = await db.all(`
      SELECT 
        tu.id, 
        tu.tipo,
        tu.indirizzo, 
        tu.email, 
        tu.telefono, 
        tu.latitudine, 
        tu.longitudine,
        tu.creato_il,
        MAX(a.nome) AS nome_attore
      FROM 
        Tipo_Utente tu
      LEFT JOIN AttoriTipoUtente atu ON atu.tipo_utente_id = tu.id
      LEFT JOIN Attori a ON a.id = atu.attore_id
      WHERE 
        tu.latitudine IS NOT NULL 
        AND tu.longitudine IS NOT NULL
      GROUP BY 
        tu.id, tu.tipo, tu.indirizzo, tu.email, tu.telefono, tu.latitudine, tu.longitudine, tu.creato_il
      ORDER BY 
        tu.tipo, tu.creato_il DESC
    `);

    logger.info(`Trovati ${centri.length} centri con coordinate valide`);

    // Mappa i risultati con colori per tipologia
    const centriMappati = centri.map(centro => {
      // Definisci colori per tipologia (compatibili con le mappe)
      let colore = '#6B7280'; // Grigio default
      let categoria = 'altro';
      
      switch (centro.tipo?.toLowerCase()) {
        case 'privato':
          colore = '#4CAF50'; // Verde - Privati
          categoria = 'privato';
          break;
        case 'canale sociale':
          colore = '#FF9800'; // Arancione - Canali sociali
          categoria = 'sociale';
          break;
        case 'centro riciclo':
          colore = '#F44336'; // Rosso - Centri riciclo
          categoria = 'riciclo';
          break;
        default:
          colore = '#9E9E9E'; // Grigio - Altro
          categoria = 'altro';
      }

      return {
        id: centro.id,
        nome: centro.nome_attore || centro.tipo || `Centro ${centro.id}`, // Nome da mostrare sulla mappa
        tipologia: centro.tipo,
        categoria: categoria, // Per filtering frontend
        indirizzo: centro.indirizzo,
        email: centro.email,
        telefono: centro.telefono,
        lat: parseFloat(centro.latitudine), 
        lng: parseFloat(centro.longitudine), 
        coordinate: {
          lat: parseFloat(centro.latitudine),
          lng: parseFloat(centro.longitudine)
        },
        colore: colore, // Colore per marker sulla mappa
        creato_il: centro.creato_il
      };
    });

    // Raggruppa per tipologia per statistiche
    const statistiche = {
      totale: centriMappati.length,
      per_tipologia: {
        privato: centriMappati.filter(c => c.categoria === 'privato').length,
        sociale: centriMappati.filter(c => c.categoria === 'sociale').length, 
        riciclo: centriMappati.filter(c => c.categoria === 'riciclo').length,
        altro: centriMappati.filter(c => c.categoria === 'altro').length
      },
      colori: {
        privato: '#4CAF50',
        sociale: '#FF9800', 
        riciclo: '#F44336',
        altro: '#9E9E9E'
      }
    };

    res.json({
      success: true,
      data: {
        centri: centriMappati,
        statistiche: statistiche
      },
      message: `${centriMappati.length} centri trovati`
    });

  } catch (error) {
    logger.error(`Errore in getCentriMappa: ${error.message}`);
    next(error);
  }
};

/**
 * Ottiene un singolo centro per ID
 */
exports.getCentroById = async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`Richiesta dettagli centro ID: ${id}`);

    const centro = await db.get(`
      SELECT 
        tu.id, 
        tu.tipo,
        tu.indirizzo, 
        tu.email, 
        tu.telefono, 
        tu.latitudine, 
        tu.longitudine,
        tu.creato_il,
        MAX(a.nome) AS nome_attore,
        (SELECT STRING_AGG(att.nome || ' ' || COALESCE(att.cognome, ''), ',')
         FROM AttoriTipoUtente atu2 
         JOIN Attori att ON atu2.attore_id = att.id 
         WHERE atu2.tipo_utente_id = tu.id) AS nomi_utenti
      FROM 
        Tipo_Utente tu
      LEFT JOIN AttoriTipoUtente atu ON atu.tipo_utente_id = tu.id
      LEFT JOIN Attori a ON a.id = atu.attore_id
      WHERE 
        tu.id = ?
      GROUP BY tu.id, tu.tipo, tu.indirizzo, tu.email, tu.telefono, tu.latitudine, tu.longitudine, tu.creato_il
    `, [id]);

    if (!centro) {
      throw new ApiError(404, 'Centro non trovato');
    }

    // Se non ha coordinate, restituisci comunque ma con avviso
    const hasCoordinates = centro.latitudine && centro.longitudine;
    
    let colore = '#6B7280';
    let categoria = 'altro';
    
    switch (centro.tipo?.toLowerCase()) {
      case 'privato':
        colore = '#FFC107';
        categoria = 'privato';
        break;
      case 'canale sociale':
        colore = '#2196F3';
        categoria = 'sociale';
        break;
      case 'centro riciclo':
        colore = '#4CAF50';
        categoria = 'riciclo';
        break;
    }

    const centroMappato = {
      id: centro.id,
      nome: centro.nome_attore || centro.tipo || `Centro ${centro.id}`,
      tipologia: centro.tipo,
      categoria: categoria,
      indirizzo: centro.indirizzo,
      email: centro.email,
      telefono: centro.telefono,
      lat: hasCoordinates ? parseFloat(centro.latitudine) : null,
      lng: hasCoordinates ? parseFloat(centro.longitudine) : null,
      coordinate: hasCoordinates ? {
        lat: parseFloat(centro.latitudine),
        lng: parseFloat(centro.longitudine)
      } : null,
      colore: colore,
      utenti_associati: centro.nomi_utenti ? centro.nomi_utenti.split(',') : [],
      creato_il: centro.creato_il,
      has_coordinates: hasCoordinates
    };

    res.json({
      success: true,
      data: centroMappato,
      warning: !hasCoordinates ? 'Centro senza coordinate geografiche' : null
    });

  } catch (error) {
    logger.error(`Errore in getCentroById: ${error.message}`);
    next(error);
  }
};

/**
 * Cerca centri per nome, tipo o indirizzo
 */
exports.searchCentri = async (req, res, next) => {
  try {
    const { q: query, tipo, solo_con_coordinate } = req.query;
    logger.info(`Ricerca centri con query: "${query}", tipo: "${tipo}"`);

    if (!query || query.trim().length < 2) {
      throw new ApiError(400, 'La query di ricerca deve contenere almeno 2 caratteri');
    }

    let whereConditions = [];
    let params = [];
    
    // Condizione per coordinate (opzionale)
    if (solo_con_coordinate === 'true') {
      whereConditions.push('tu.latitudine IS NOT NULL AND tu.longitudine IS NOT NULL');
    }
    
    // Condizione per tipo specifico
    if (tipo && tipo !== 'tutti') {
      whereConditions.push('tu.tipo = ?');
      params.push(tipo);
    }
    
    // Condizione di ricerca testuale (migliorata per includere anche il nome dell'attore)
    whereConditions.push(`(
      tu.tipo LIKE ? OR 
      tu.indirizzo LIKE ? OR 
      tu.email LIKE ? OR
      tu.telefono LIKE ? OR
      a.nome LIKE ?
    )`);
    
    const searchTerm = `%${query.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

    const whereClause = whereConditions.length > 0 ? 
      'WHERE ' + whereConditions.join(' AND ') : '';

    const centri = await db.all(`
      SELECT 
        tu.id, 
        tu.tipo,
        tu.indirizzo, 
        tu.email, 
        tu.telefono, 
        tu.latitudine, 
        tu.longitudine,
        tu.creato_il,
        MAX(a.nome) AS nome_attore
      FROM 
        Tipo_Utente tu
      LEFT JOIN AttoriTipoUtente atu ON atu.tipo_utente_id = tu.id
      LEFT JOIN Attori a ON a.id = atu.attore_id
      ${whereClause}
      GROUP BY tu.id, tu.tipo, tu.indirizzo, tu.email, tu.telefono, tu.latitudine, tu.longitudine, tu.creato_il
      ORDER BY 
        CASE 
          WHEN tu.tipo LIKE ? THEN 1
          WHEN tu.indirizzo LIKE ? THEN 2
          WHEN COALESCE(MAX(a.nome), '') LIKE ? THEN 3
          ELSE 4
        END,
        tu.tipo, tu.creato_il DESC
      LIMIT 50
    `, [...params, searchTerm, searchTerm, searchTerm]);

    logger.info(`Ricerca completata: ${centri.length} risultati trovati`);

    // Mappa i risultati
    const centriMappati = centri.map(centro => {
      const hasCoordinates = centro.latitudine && centro.longitudine;
      
      let colore = '#6B7280';
      let categoria = 'altro';
      
      switch (centro.tipo?.toLowerCase()) {
        case 'privato':
          colore = '#4CAF50';
          categoria = 'privato';
          break;
        case 'canale sociale':
          colore = '#FF9800';
          categoria = 'sociale';
          break;
        case 'centro riciclo':
          colore = '#F44336';
          categoria = 'riciclo';
          break;
      }

      return {
        id: centro.id,
        nome: centro.nome_attore || centro.tipo || `Centro ${centro.id}`,
        tipologia: centro.tipo,
        categoria: categoria,
        indirizzo: centro.indirizzo,
        email: centro.email,
        telefono: centro.telefono,
        lat: hasCoordinates ? parseFloat(centro.latitudine) : null,
        lng: hasCoordinates ? parseFloat(centro.longitudine) : null,
        coordinate: hasCoordinates ? {
          lat: parseFloat(centro.latitudine),
          lng: parseFloat(centro.longitudine)
        } : null,
        colore: colore,
        creato_il: centro.creato_il,
        has_coordinates: hasCoordinates
      };
    });

    res.json({
      success: true,
      data: {
        centri: centriMappati,
        query: query,
        tipo_filtro: tipo || 'tutti',
        total_results: centriMappati.length,
        has_more: centriMappati.length === 50 // Indica se ci sono altri risultati
      },
      message: `${centriMappati.length} centri trovati per "${query}"`
    });

  } catch (error) {
    logger.error(`Errore in searchCentri: ${error.message}`);
    next(error);
  }
};

/**
 * Ottiene statistiche generali sui centri
 */
exports.getStatisticheCentri = async (req, res, next) => {
  try {
    logger.info('Richiesta statistiche centri');

    // Statistiche per tipologia
    const stats = await db.all(`
      SELECT 
        tu.tipo,
        COUNT(*) as totale,
        COUNT(CASE WHEN tu.latitudine IS NOT NULL AND tu.longitudine IS NOT NULL THEN 1 END) as con_coordinate,
        ROUND(AVG(CASE WHEN tu.latitudine IS NOT NULL AND tu.longitudine IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100, 1) as percentuale_geocodificati
      FROM Tipo_Utente tu
      GROUP BY tu.tipo
      ORDER BY totale DESC
    `);

    // Statistiche generali
    const totaleGenerale = await db.get(`
      SELECT 
        COUNT(*) as totale_centri,
        COUNT(CASE WHEN latitudine IS NOT NULL AND longitudine IS NOT NULL THEN 1 END) as centri_con_coordinate,
        COUNT(CASE WHEN latitudine IS NULL OR longitudine IS NULL THEN 1 END) as centri_senza_coordinate
      FROM Tipo_Utente
    `);

    // Statistiche utenti associati
    const utentiStats = await db.get(`
      SELECT 
        COUNT(DISTINCT atu.attore_id) as totale_utenti_associati,
        COUNT(DISTINCT atu.tipo_utente_id) as centri_con_utenti
      FROM AttoriTipoUtente atu
    `);

    res.json({
      success: true,
      data: {
        riepilogo: {
          ...totaleGenerale,
          percentuale_geocodificazione: totaleGenerale.totale_centri > 0 ? 
            Math.round((totaleGenerale.centri_con_coordinate / totaleGenerale.totale_centri) * 100) : 0,
          ...utentiStats
        },
        per_tipologia: stats,
        colori_mappa: {
          'Privato': '#4CAF50',
          'Canale sociale': '#FF9800', 
          'centro riciclo': '#F44336',
          'altro': '#9E9E9E'
        }
      }
    });

  } catch (error) {
    logger.error(`Errore in getStatisticheCentri: ${error.message}`);
    next(error);
  }
};
