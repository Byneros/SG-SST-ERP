/**
 * Simulador de IdP SAML para QA local (Fase 9.4).
 *
 * Levanta un IdP SAML 2.0 minimo en el puerto 3600 con certificado
 * autofirmado. Permite verificar en navegador el flujo completo:
 *   1. GET /metadata            -> metadata IdP (cert + SSO URL) para el setup
 *   2. GET/POST /sso            -> recibe el AuthnRequest del SP (node-saml),
 *                                  presenta un formulario de "login" mock y
 *                                  POSTea el assertion firmado al ACS del SP.
 *   3. El assertion lleva nameID/email/displayName/memberOf (grupos) para
 *      probar el override de rol por grupo (roleGroups).
 *
 * La respuesta y el assertion van firmados (XMLDSig enveloped, exc-c14n,
 * RSA-SHA256) con xml-crypto: misma libreria que usa node-saml para validar,
 * por lo que la canonicalizacion es exactamente la que el SP espera.
 *
 * Uso: npx tsx qa-saml-idp.mts [email] [grupo] [nombre]
 *   - email: identidad del usuario mock (default sso.user@empresa.test)
 *   - grupo: memberOf por defecto (default SG-SST-Admins)
 *   - nombre: displayName del usuario mock
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  generateKeyPairSync,
  createSign,
  createPrivateKey,
  createPublicKey,
  randomBytes,
} from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SignedXml } from 'xml-crypto';

const PORT = 3600;
const IDP_ENTITY_ID = 'urn:sgsst:mock-idp';
const IDP_SSO_URL = `http://127.0.0.1:${PORT}/sso`;

const defaultEmail = process.argv[2] ?? 'sso.user@empresa.test';
const defaultGroup = process.argv[3] ?? 'SG-SST-Admins';
const defaultName = process.argv[4] ?? 'Usuario SSO Mock';

// ---------------------------------------------------------------------------
// Certificado autofirmado (RSA 2048, validez 2026-2036)
// La clave se persiste en qa-saml-idp-key.pem: si se regenerara en cada
// arranque, el cert sembrado en el SsoProvider quedaria stale y la validacion
// del assertion fallaria con "Invalid signature".
// ---------------------------------------------------------------------------
const KEY_FILE = 'qa-saml-idp-key.pem';

function loadOrCreateKeyPair(): { privateKeyPem: string; spkiDer: Buffer } {
  if (existsSync(KEY_FILE)) {
    const privateKeyPem = readFileSync(KEY_FILE, 'utf8');
    const keyObj = createPrivateKey(privateKeyPem);
    const spkiDer = createPublicKey(keyObj).export({ type: 'spki', format: 'der' }) as Buffer;
    return { privateKeyPem, spkiDer };
  }
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  writeFileSync(KEY_FILE, privateKeyPem);
  return { privateKeyPem, spkiDer };
}

const { privateKeyPem, spkiDer } = loadOrCreateKeyPair();
const certificateBase64 = selfSignCertificate(spkiDer).toString('base64');

/** X.509 v3 autofirmado minimo (tbsCertificate + algo + firma) en DER. */
function selfSignCertificate(spki: Buffer): Buffer {
  const serial = Buffer.concat([Buffer.from([0x02]), randomBytes(7)]);
  const cn = derSequence(
    derSet(derSequence(derOid('2.5.4.3'), derPrintableString('SG-SST Mock IdP'))),
  );
  const validity = derSequence(derUtcTime(Buffer.from('260101000000Z')), derUtcTime(Buffer.from('360101000000Z')));
  const sha256Rsa = derSequence(derOid('1.2.840.113549.1.1.11'), derNull());

  // v3: el [0] EXPLICIT envuelve SOLO el INTEGER version (2), no el resto.
  const version = derExplicit(0, [derInteger(Buffer.from([0x02]))]);
  const tbs = derSequence(
    Buffer.concat([
      version,
      derInteger(serial),
      sha256Rsa,
      cn, // issuer (Name = RDNSequence)
      validity,
      cn, // subject (mismo Name: auto-firmado)
      spki, // SubjectPublicKeyInfo ya viene en DER
    ]),
  );
  const signature = rsaSign(tbs);
  return derSequence(tbs, sha256Rsa, derBitString(Buffer.concat([Buffer.from([0x00]), signature])));
}

function rsaSign(data: Buffer): Buffer {
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  return signer.sign(privateKeyPem);
}

// ---------------------------------------------------------------------------
// Helpers DER minimos
// ---------------------------------------------------------------------------
function derSequence(...children: Buffer[]): Buffer {
  return derWrap(0x30, Buffer.concat(children));
}
function derSet(...children: Buffer[]): Buffer {
  return derWrap(0x31, Buffer.concat(children));
}
function derWrap(tag: number, content: Buffer): Buffer {
  if (content.length < 0x80) {
    return Buffer.concat([Buffer.from([tag, content.length]), content]);
  }
  const lengthBytes: number[] = [];
  let remaining = content.length;
  while (remaining > 0) {
    lengthBytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.concat([
    Buffer.from([tag, 0x80 | lengthBytes.length]),
    Buffer.from(lengthBytes),
    content,
  ]);
}
function derExplicit(tag: number, children: Buffer[]): Buffer {
  return derWrap(0xa0 | tag, Buffer.concat(children));
}
function derInteger(value: Buffer): Buffer {
  return derWrap(0x02, value);
}
function derNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}
function derOid(oid: string): Buffer {
  const parts = oid.split('.').map((p) => Number(p));
  const body: number[] = [parts[0]! * 40 + parts[1]!];
  for (const part of parts.slice(2)) {
    let value = part!;
    const bytes: number[] = [value & 0x7f];
    value >>= 7;
    while (value > 0) {
      bytes.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    body.push(...bytes);
  }
  return derWrap(0x06, Buffer.from(body));
}
function derPrintableString(value: string): Buffer {
  return derWrap(0x13, Buffer.from(value, 'ascii'));
}
function derUtcTime(value: Buffer): Buffer {
  return derWrap(0x17, value);
}
function derBitString(value: Buffer): Buffer {
  return derWrap(0x03, value);
}

// ---------------------------------------------------------------------------
// SAML: AuthnRequest y Response firmada
// ---------------------------------------------------------------------------
function decodeBase64Loose(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/** Extrae ID, ACS y Issuer (entityID del SP) del AuthnRequest. */
function parseAuthnRequest(raw: string): { id: string; acsUrl: string; spIssuer: string } {
  let xml = raw.trim();
  if (!xml.startsWith('<')) {
    try {
      xml = inflateRawSync(decodeBase64Loose(raw)).toString('utf8');
    } catch {
      xml = decodeBase64Loose(raw).toString('utf8');
    }
  }
  const id = xml.match(/\bID="([^"]+)"/)?.[1] ?? '';
  const acsUrl = xml.match(/AssertionConsumerServiceURL="([^"]+)"/)?.[1] ?? '';
  const spIssuer =
    xml.match(/<(?:[\w.-]+:)?Issuer[^>]*>([^<]+)<\/(?:[\w.-]+:)?Issuer>/)?.[1] ?? '';
  return { id, acsUrl, spIssuer };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Response SAML con Response y Assertion firmadas (enveloped, exc-c14n). */
function buildSignedResponse(params: {
  requestId: string;
  acsUrl: string;
  audience: string;
  nameId: string;
  name: string;
  group: string;
}): string {
  const issueInstant = new Date().toISOString();
  const responseId = '_res' + randomBytes(16).toString('hex');
  const assertionId = '_ast' + randomBytes(16).toString('hex');
  const sessionIndex = '_sess' + randomBytes(12).toString('hex');
  const notBefore = new Date(Date.now() - 60_000).toISOString();
  const notOnOrAfter = new Date(Date.now() + 300_000).toISOString();
  const xs = 'xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

  const assertionContent = [
    `<saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>`,
    `<saml:Subject>`,
    `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${escapeXml(params.nameId)}</saml:NameID>`,
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">`,
    `<saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}" Recipient="${escapeXml(params.acsUrl)}"${params.requestId ? ` InResponseTo="${params.requestId}"` : ''}/>`,
    `</saml:SubjectConfirmation>`,
    `</saml:Subject>`,
    `<saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">`,
    `<saml:AudienceRestriction><saml:Audience>${escapeXml(params.audience)}</saml:Audience></saml:AudienceRestriction>`,
    `</saml:Conditions>`,
    `<saml:AuthnStatement AuthnInstant="${issueInstant}" SessionIndex="${sessionIndex}">`,
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>`,
    `</saml:AuthnStatement>`,
    `<saml:AttributeStatement>`,
    `<saml:Attribute Name="email"><saml:AttributeValue ${xs}>${escapeXml(params.nameId)}</saml:AttributeValue></saml:Attribute>`,
    `<saml:Attribute Name="displayName"><saml:AttributeValue ${xs}>${escapeXml(params.name)}</saml:AttributeValue></saml:Attribute>`,
    // Grupo vacio = sin memberOf: permite probar el fallback al rol por defecto.
    ...(params.group
      ? [
          `<saml:Attribute Name="memberOf"><saml:AttributeValue ${xs}>${escapeXml(params.group)}</saml:AttributeValue></saml:Attribute>`,
        ]
      : []),
    `</saml:AttributeStatement>`,
  ].join('');

  const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" Version="2.0" IssueInstant="${issueInstant}">${assertionContent}</saml:Assertion>`;

  const response = [
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${escapeXml(params.acsUrl)}"${params.requestId ? ` InResponseTo="${params.requestId}"` : ''}>`,
    `<saml:Issuer>${IDP_ENTITY_ID}</saml:Issuer>`,
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>`,
    assertion,
    `</samlp:Response>`,
  ].join('');

  // Solo el assertion va firmado: el SP (saml.service.ts) exige
  // wantAssertionsSigned y NO exige firma de la Response. Firmar ambas rompe
  // la validacion: el transform enveloped-signature de xml-crypto elimina
  // TODAS las firmas del documento al recalcular el digest.
  return response.replace(assertion, signXmlFragment(assertion, 'Assertion'));
}

/**
 * Firma enveloped de un elemento XML con xml-crypto v6 (exc-c14n + rsa-sha256).
 * El `idAttribute: 'ID'` va en el constructor y la referencia se dirige por
 * XPath del elemento con ese ID (compatible con como node-saml valida).
 */
function signXmlFragment(xml: string, elementName: 'Assertion' | 'Response'): string {
  const signed = new SignedXml({
    privateKey: privateKeyPem,
    idAttribute: 'ID',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  });
  signed.addReference({
    xpath: `//*[local-name(.)='${elementName}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  signed.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='Issuer']", action: 'after' },
  });
  return signed.getSignedXml();
}

// ---------------------------------------------------------------------------
// Metadata IdP
// ---------------------------------------------------------------------------
function idpMetadata(): string {
  return [
    `<?xml version="1.0"?>`,
    `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${IDP_ENTITY_ID}">`,
    `<IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `<KeyDescriptor use="signing">`,
    `<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>${certificateBase64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`,
    `</KeyDescriptor>`,
    `<NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>`,
    `<SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${IDP_SSO_URL}"/>`,
    `<SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${IDP_SSO_URL}"/>`,
    `</IDPSSODescriptor>`,
    `</EntityDescriptor>`,
  ].join('');
}

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------
function send(res: ServerResponse, status: number, body: string, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
    req.on('end', () => resolve(data));
  });
}

const page = (title: string, body: string) => [
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>`,
  `<style>body{font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px}`,
  `code{background:#f2f2f2;padding:2px 4px;border-radius:4px}</style></head>`,
  `<body><h1>${title}</h1>${body}</body></html>`,
].join('');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/metadata') {
    return send(res, 200, idpMetadata(), 'application/xml; charset=utf-8');
  }

  if (url.pathname === '/sso' && (req.method === 'GET' || req.method === 'POST')) {
    let raw = '';
    if (req.method === 'GET') {
      raw = url.searchParams.get('SAMLRequest') ?? '';
    } else {
      const body = await readBody(req);
      raw = new URLSearchParams(body).get('SAMLRequest') ?? '';
    }
    const { id, acsUrl, spIssuer } = parseAuthnRequest(raw);
    return renderLogin(res, id, acsUrl, spIssuer, url.searchParams.get('RelayState') ?? '');
  }

  if (url.pathname === '/sso/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const responseXml = buildSignedResponse({
      requestId: params.get('requestId') ?? '',
      acsUrl: params.get('acsUrl') ?? '',
      // Audience = entityID del SP (Issuer del AuthnRequest).
      audience: params.get('audience') ?? '',
      nameId: params.get('email') || defaultEmail,
      name: params.get('name') || defaultName,
      group: params.get('group') ?? defaultGroup,
    });
    const acsUrl = params.get('acsUrl') ?? '';
    const relayState = params.get('RelayState') ?? '';
    const html = [
      `<!doctype html><html><body onload="document.forms[0].submit()">`,
      `<p>Redirigiendo al SP con el assertion firmado...</p>`,
      `<form method="POST" action="${escapeXml(acsUrl)}">`,
      `<input type="hidden" name="SAMLResponse" value="${Buffer.from(responseXml).toString('base64')}"/>`,
      relayState ? `<input type="hidden" name="RelayState" value="${escapeXml(relayState)}"/>` : '',
      `<noscript><button type="submit">Continuar</button></noscript>`,
      `</form></body></html>`,
    ].join('');
    return send(res, 200, html);
  }

  return send(res, 404, page('IdP mock', '<p>Ruta desconocida. Usa <code>/metadata</code> o inicia el flujo desde el SP.</p>'));
});

function renderLogin(res: ServerResponse, requestId: string, acsUrl: string, spIssuer: string, relayState: string) {
  const groupOptions = ['SG-SST-Admins', 'SST-Team', 'Auditores', '']
    .map((g) => `<option value="${g}">${g === '' ? '(sin grupo)' : g}</option>`)
    .join('');
  const html = page(
    'IdP SAML Mock — SG-SST',
    [
      `<p>AuthnRequest recibido (<code>${escapeXml(requestId || 'sin ID')}</code>).</p>`,
      `<form method="POST" action="/sso/submit">`,
      `<input type="hidden" name="requestId" value="${escapeXml(requestId)}"/>`,
      `<input type="hidden" name="acsUrl" value="${escapeXml(acsUrl)}"/>`,
      `<input type="hidden" name="audience" value="${escapeXml(spIssuer)}"/>`,
      `<input type="hidden" name="RelayState" value="${escapeXml(relayState)}"/>`,
      `<p><label>Correo (nameID): <input name="email" value="${escapeXml(defaultEmail)}" style="width:100%"/></label></p>`,
      `<p><label>Nombre: <input name="name" value="${escapeXml(defaultName)}" style="width:100%"/></label></p>`,
      `<p><label>Grupo (memberOf): <select name="group">${groupOptions}</select></label></p>`,
      `<p><button type="submit">Autenticar y volver al SP</button></p>`,
      `</form>`,
    ].join(''),
  );
  send(res, 200, html);
}

server.listen(PORT, () => {
  console.log(`IdP SAML mock escuchando en ${IDP_SSO_URL}`);
  console.log(`  Metadata IdP: http://127.0.0.1:${PORT}/metadata`);
  console.log(`  Entidad:      ${IDP_ENTITY_ID}`);
  console.log(`  Usuario mock: ${defaultEmail} | grupo por defecto: ${defaultGroup}`);
  console.log(`  Cert X509 (base64 DER) para el dialogo SSO:`);
  console.log(certificateBase64);
});
