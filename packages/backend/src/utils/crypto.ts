import crypto from 'crypto';
import { getConfig } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = getConfig().plaid.tokenEncryptionKey;
  if (hex.length !== 64) {
    throw new Error(
      'PLAID_TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)'
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('hex'),
    ciphertext.toString('hex'),
    authTag.toString('hex'),
  ].join(':');
}

export function decrypt(encrypted: string): string {
  const [ivHex, ciphertextHex, authTagHex] = encrypted.split(':');
  if (!ivHex || !ciphertextHex || !authTagHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
