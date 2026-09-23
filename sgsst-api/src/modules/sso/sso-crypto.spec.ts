import { decryptSecret, encryptSecret } from './sso-crypto';

describe('sso-crypto', () => {
  it('round-trips a secret (encrypt -> decrypt)', () => {
    const secret = 'client-secret-de-prueba';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext for the same plaintext (random IV)', () => {
    expect(encryptSecret('mismo')).not.toBe(encryptSecret('mismo'));
  });

  it('keeps the ciphertext format iv:data:tag in base64', () => {
    const [iv, data, tag] = encryptSecret('formato').split(':');
    expect(iv).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(data).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(tag).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('rejects a malformed payload (missing parts)', () => {
    expect(() => decryptSecret('solo-una-parte')).toThrow(
      'Invalid encrypted secret format',
    );
  });
});
