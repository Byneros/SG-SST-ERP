/**
 * Utilidades para metadata SAML 2.0 del IdP: permiten configurar un proveedor
 * pegando solo el XML de metadata (el cert y la URL SSO se extraen de ahi).
 */

/** Extrae cert X.509 (body base64) y URL SSO de la metadata XML del IdP. */
export function parseIdpMetadata(
  xml: string,
): { certificate: string; ssoUrl: string } | null {
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<')) return null;
  const certificate =
    trimmed.match(/<X509Certificate>([^<]+)<\/X509Certificate>/)?.[1] ?? null;
  // Ultimo SingleSignOnService (los IdP suelen listar Redirect y POST).
  const ssoUrl =
    [
      ...trimmed.matchAll(/<SingleSignOnService\b[^>]*\bLocation="([^"]+)"/g),
    ].pop()?.[1] ?? null;
  if (!certificate || !ssoUrl) return null;
  return {
    certificate: certificate.replace(/\s+/g, ''),
    ssoUrl,
  };
}

/** Acepta PEM completo o body base64; devuelve el body sin espacios. */
export function normalizeIdpCertificate(cert: string): string {
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
}
