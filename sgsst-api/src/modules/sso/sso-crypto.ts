import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';

function key(): Buffer {
  return createHash('sha256').update(env.jwtSecret).digest();
}

/** Cifra secretos de configuracion (client_secret del IdP) en reposo. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  const [ivPart, dataPart, tagPart] = payload.split(':');
  if (!ivPart || !dataPart || !tagPart) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivPart, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
