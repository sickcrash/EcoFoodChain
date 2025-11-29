/**
 * Configurazione globale per il backend di Refood
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const trimEnv = (name) => {
  const value = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const requireSecret = (name, fallbackForDev) => {
  const value = trimEnv(name);
  if (value) {
    return value;
  }
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (fallbackForDev !== undefined) {
    console.warn(`[config] Using fallback value for ${name} in ${NODE_ENV} environment. Configure the variable to silence this warning.`);
    return fallbackForDev;
  }
  return undefined;
};

const jwtSecret = requireSecret('JWT_SECRET', 'development-jwt-secret');
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = jwtSecret;
}

const defaultAdminEmail = trimEnv('DEFAULT_ADMIN_EMAIL');
if (!defaultAdminEmail && isProduction) {
  throw new Error('DEFAULT_ADMIN_EMAIL must be set in production environments');
}

const defaultAdminPassword = trimEnv('DEFAULT_ADMIN_PASSWORD');
if (!defaultAdminPassword && isProduction) {
  throw new Error('DEFAULT_ADMIN_PASSWORD must be set in production environments');
}

module.exports = {
  // Configurazione JWT
  jwt: {
    secret: jwtSecret,
    accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION || '2h',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },

  // Configurazione password
  password: {
    saltRounds: 10,
    minLength: 8,
  },

  // Configurazione del sistema
  system: {
    defaultAdminEmail: defaultAdminEmail || null,
    defaultAdminPassword: defaultAdminPassword || null,
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minuti
  },

  // Configurazione validazione
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phoneRegex: /^[0-9]{9,10}$/,
  },

  // Configurazione notifiche
  notifications: {
    enabled: true,
    defaultExpiration: 7 * 24 * 60 * 60 * 1000, // 7 giorni
  },

  // Configurazione paginazione
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};
