const crypto = require('crypto');

function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return '';
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

function secureEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    return a === b;
  }
}

module.exports = {
  hashToken,
  secureEquals,
};
