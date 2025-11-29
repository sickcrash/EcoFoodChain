const CANONICAL = {
  AMMINISTRATORE: 'Amministratore',
  OPERATORE: 'Operatore',
  UTENTE: 'Utente',
  OPERATORE_CENTRO: 'OperatoreCentro',
};

const INPUT_ALIASES = new Map([
  // Amministratore
  ['amministratore', CANONICAL.AMMINISTRATORE],
  ['amministratore cooperativa', CANONICAL.AMMINISTRATORE],
  ['admin', CANONICAL.AMMINISTRATORE],
  // Operatore
  ['operatore', CANONICAL.OPERATORE],
  ['operatore cooperativa', CANONICAL.OPERATORE],
  // Operatore Centro (Centro associato)
  ['operatore centro associato', CANONICAL.OPERATORE_CENTRO],
  ['operatore centro', CANONICAL.OPERATORE_CENTRO],
  ['operatore_centro', CANONICAL.OPERATORE_CENTRO],
  ['operatore-centro', CANONICAL.OPERATORE_CENTRO],
  ['centro associato', CANONICAL.OPERATORE_CENTRO],
  ['operatorecentro', CANONICAL.OPERATORE_CENTRO],
  ['operatorecentroassociato', CANONICAL.OPERATORE_CENTRO],
  // Utente
  ['utente', CANONICAL.UTENTE],
]);

function normalizeRole(role) {
  if (!role) return null;
  const key = String(role).trim().toLowerCase();
  return INPUT_ALIASES.get(key) || null;
}

function displayName(canonicalRole) {
  switch (canonicalRole) {
    case CANONICAL.AMMINISTRATORE:
      return 'Amministratore';
    case CANONICAL.OPERATORE:
      return 'Operatore';
    case CANONICAL.OPERATORE_CENTRO:
      return 'Centro associato';
    case CANONICAL.UTENTE:
      return 'Utente';
    default:
      return canonicalRole || '';
  }
}

function isOrganizationRole(role) {
  return [CANONICAL.AMMINISTRATORE, CANONICAL.OPERATORE, CANONICAL.OPERATORE_CENTRO].includes(role);
}

module.exports = {
  CANONICAL,
  normalizeRole,
  displayName,
  isOrganizationRole,
};
