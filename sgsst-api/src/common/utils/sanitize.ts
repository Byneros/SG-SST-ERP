/**
 * Mascaramiento de datos sensibles para logs (hardening observabilidad).
 * Ningun Logger de la app debe imprimir credenciales en claro: pasa el
 * mensaje/objeto por `redactSensitive` antes de delegar al logger base.
 */

/** Claves (en cualquier variante camel/UPPER/kebab) cuyo valor se redacta. */
const SENSITIVE_KEYS = [
  'password',
  'currentpassword',
  'newpassword',
  'passwd',
  'secret',
  'clientsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'resettoken',
  'mfatoken',
  'mfasecret',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'smtppassword',
  's3secretaccesskey',
  'privatekey',
  'databaseurl',
  'connectionstring',
  'ssn',
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 8;

/** Longitud maxima de texto procesado: evita redactar payloads enormes. */
const MAX_TEXT_LENGTH = 10_000;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ''));
}

/** Redacta recursivamente un valor por nombre de clave (objetos y arrays). */
export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return '[TRUNCATED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    // Date, Map, Set, Error y demas clases no-POJO se conservan tal cual:
    // el logger base sabe formatearlos y no llevan claves sensibles.
    if (value.constructor !== Object) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Redacta secretos dentro de un texto. Cuatro pasadas independientes:
 *  A. Par JSON (`"password":"x"` / `password: x`), con o sin comillas.
 *  B. Asignación (`password=x`, `refresh_token=abc` en query strings).
 *  C. Credenciales en URL (`postgres://user:pass@host`).
 *  D. Cabeceras `Bearer <token>` sueltas.
 * Se limita a textos de longitud razonable; mensajes más largos se truncan.
 */
const SENSITIVE_NAME_PATTERN =
  'password|passwd|secret|token|apikey|api[_-]?key|authorization|cookie|' +
  'refresh[_-]?token|access[_-]?token|id[_-]?token|reset[_-]?token|mfa[_-]?secret|' +
  'client[_-]?secret|database[_-]?url|connection[_-]?string';

export function redactText(text: string): string {
  if (text.length > MAX_TEXT_LENGTH) {
    return `${text.slice(0, MAX_TEXT_LENGTH)}... [TRUNCATED]`;
  }
  let out = text;

  // A. Par nombre:valor (JSON y objetos impresos). Consume tambien el prefijo
  // `Bearer` del valor para no dejar el token a la vista tras redactar.
  out = out.replace(
    new RegExp(
      `(["']?)\\b(${SENSITIVE_NAME_PATTERN})\\b\\1?\\s*:\\s*(?:[Bb]earer\\s+)?(?:"[^"]*"|'[^']*'|[^,;\\s}"']+)`,
      'gi',
    ),
    (_m, q: string, name: string) => `${q}${name}${q}: ${REDACTED}`,
  );

  // B. Asignación clave=valor (query strings, texto plano).
  out = out.replace(
    new RegExp(
      `\\b(${SENSITIVE_NAME_PATTERN})\\b\\s*=\\s*(?:[Bb]earer\\s+)?(?:"[^"]*"|'[^']*'|[^,;&\\s}]+)`,
      'gi',
    ),
    (_m, name: string) => `${name}= ${REDACTED}`,
  );

  // C. Usuario:contraseña en URL de conexión (scheme://user:pass@host).
  out = out.replace(
    /\w+:\/\/([^:/\s]+):([^@\s]+)@/g,
    (_m, user: string) => `${user}:[REDACTED]@`,
  );

  // D. Token tras el esquema Bearer.
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`);

  return out;
}

/** Punto unico para mensajes de log: texto, objetos y otros valores. */
export function redactSensitive(message: unknown): unknown {
  if (typeof message === 'string') {
    return redactText(message);
  }
  if (message instanceof Error) {
    // Error: el mensaje puede contener un query string con credenciales.
    return new Error(redactText(message.message), {
      cause: message.cause,
    });
  }
  return redactValue(message);
}
