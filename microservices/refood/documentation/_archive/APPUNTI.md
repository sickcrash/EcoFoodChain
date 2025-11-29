# ReFood - Quick Notes

Promemoria rapido per demo e manutenzione. Per istruzioni complete consulta i file PROJECT_SETUP.md, OFFICIAL_DOCUMENTATION.md e la cartella scheme/.

## Visibilita schermate per ruolo
| Schermata / Funzione | Amministratore | Operatore | Operatore Centro | Utente (privato/sociale/riciclo) |
|----------------------|----------------|-----------|------------------|----------------------------------|
| Home / Dashboard     | si             | si        | no               | no                               |
| Lotti                | si (tutti)     | si        | sola lettura     | solo colore consentito           |
| Prenotazioni         | si             | si        | sola lettura     | solo le proprie                  |
| Segnalazioni         | si             | no        | si (proprie)     | no                               |
| Notifiche            | si (tutte)     | si        | filtrate per centro | personali                       |
| Statistiche          | si             | si        | si               | si                               |
| Mappa                | si             | si        | si               | si                               |
| Area Admin           | si             | no        | no               | no                               |

## Flussi da ricordare
1. Lotto interno: operatore crea lotto, utenti idonei prenotano, operatore porta lo stato fino a Consegnato.
2. Segnalazione centro: operatore centro carica descrizione e foto, amministratore revisiona, approvazione genera lotto.
3. Prenotazione: stati principali Richiesta -> Confermato -> ProntoPerRitiro -> InTransito -> Consegnato con rami Rifiutato, Annullato, Eliminato.

## Regole prodotto
- Ogni utente finale vede solo i lotti del proprio colore.
- Admin e operatori vedono anche i lotti gia prenotati e possono eliminarli.
- Le notifiche sono filtrate per ruolo: admin tutto, operatori lotti/prenotazioni, centri le proprie segnalazioni, utenti finali le prenotazioni personali.
- La campanella notifiche e accessibile dal profilo.

## Script utili
- node backend/src/scripts/invalidate_refresh_tokens.js invalida tutte le sessioni attive.
- npm run pg:init:full applica lo schema PostgreSQL completo.

## Demo rapida (10 minuti)
1. Avvia backend e frontend (vedi PROJECT_SETUP.md).
2. Login come amministratore, mostra dashboard e statistiche.
3. Crea un lotto, prenotalo con utente idoneo, porta lo stato a Consegnato.
4. Invia una segnalazione come Operatore Centro, approvala da admin e mostra il nuovo lotto.
5. Controlla che le notifiche arrivino ai ruoli coinvolti.

Mantieni questo file breve: aggiorna quando cambiano permessi o flussi principali.
