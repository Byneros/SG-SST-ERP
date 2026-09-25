import { redactSensitive, redactText, redactValue } from './sanitize';

describe('sanitize (mascaramiento de datos sensibles en logs)', () => {
  describe('redactValue', () => {
    it('redacts sensitive keys at the top level', () => {
      expect(
        redactValue({
          email: 'user@example.com',
          password: 'SuperSecret123',
        }),
      ).toEqual({ email: 'user@example.com', password: '[REDACTED]' });
    });

    it('redacts camelCase, UPPER_SNAKE and kebab variants', () => {
      expect(
        redactValue({
          refreshToken: 'r-1',
          SMTP_PASSWORD: 's-1',
          'api-key': 'k-1',
          apiKey: 'k-2',
          Authorization: 'Bearer abc',
        }),
      ).toEqual({
        refreshToken: '[REDACTED]',
        SMTP_PASSWORD: '[REDACTED]',
        'api-key': '[REDACTED]',
        apiKey: '[REDACTED]',
        Authorization: '[REDACTED]',
      });
    });

    it('redacts inside nested objects and arrays', () => {
      const input = {
        user: { name: 'a', credentials: { secret: 'x', keep: 1 } },
        items: [{ token: 't1' }, { safe: 's1' }],
      };
      expect(redactValue(input)).toEqual({
        user: { name: 'a', credentials: { secret: '[REDACTED]', keep: 1 } },
        items: [{ token: '[REDACTED]' }, { safe: 's1' }],
      });
    });

    it('preserves non-plain objects like Date untouched', () => {
      const at = new Date('2026-01-01T00:00:00Z');
      const out = redactValue({ at, password: 'p' }) as {
        at: Date;
        password: string;
      };
      expect(out.at).toBe(at);
      expect(out.password).toBe('[REDACTED]');
    });

    it('truncates beyond the max depth instead of exploding', () => {
      const deep = {
        a: {
          b: { c: { d: { e: { f: { g: { h: { i: { password: 'p' } } } } } } } },
        },
      };
      expect(JSON.stringify(redactValue(deep))).toContain('[TRUNCATED]');
    });
  });

  describe('redactText', () => {
    it('redacts JSON-style password pairs embedded in a message', () => {
      const out = redactText(
        'Login failed for payload {"email":"a@b.com","password":"hunter2"}',
      );
      expect(out).not.toContain('hunter2');
      expect(out).toContain('[REDACTED]');
      expect(out).toContain('"email":"a@b.com"');
    });

    it('redacts query-string tokens (DATABASE_URL style)', () => {
      const out = redactText(
        'Connection failed: postgres://u@h/db?password=sekret&sslmode=require',
      );
      expect(out).not.toContain('sekret');
      expect(out).toContain('password= [REDACTED]');
    });

    it('redacts bearer authorization headers', () => {
      const out = redactText(
        'GET /api/v1/me Authorization: Bearer abc.def.ghi',
      );
      expect(out).not.toContain('abc.def.ghi');
      expect(out).toContain('Authorization: [REDACTED]');
    });

    it('truncates overly long messages', () => {
      const out = redactText('x'.repeat(20_000));
      expect(out).toContain('[TRUNCATED]');
      expect(out.length).toBeLessThan(20_000);
    });

    it('leaves messages without sensitive data intact', () => {
      const msg = 'User created: a@b.com role=ADMIN';
      expect(redactText(msg)).toBe(msg);
    });
  });

  describe('redactSensitive', () => {
    it('handles strings, objects and Errors', () => {
      expect(redactSensitive('token=abc')).toContain('[REDACTED]');
      expect(redactSensitive({ password: 'p' })).toEqual({
        password: '[REDACTED]',
      });
      const err = new Error('auth failed with refresh_token=zzz');
      const out = redactSensitive(err) as Error;
      expect(out).toBeInstanceOf(Error);
      expect(out.message).not.toContain('zzz');
    });
  });
});
