const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('A 64-character hex ENCRYPTION_KEY is required. Please add it to your .env file.');
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypts a piece of text.
 * @param {string} text - The text to encrypt.
 * @returns {string} The encrypted text, formatted as iv:authTag:encryptedData.
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Prepend the IV and authTag to the encrypted data for use in decryption.
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a piece of text.
 * @param {string} text - The encrypted text (iv:authTag:encryptedData).
 * @returns {string} The decrypted text.
 */
function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const authTag = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };