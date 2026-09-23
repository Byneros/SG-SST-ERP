import { parseIdpMetadata, normalizeIdpCertificate } from './saml-metadata';

const metadataXml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://idp.example.test/sso">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>
            MIIBIzANBgkq
            hkiG9w0BAQEF
          </ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.test/sso/redirect"/>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.test/sso/post"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

describe('saml-metadata', () => {
  describe('parseIdpMetadata', () => {
    it('extracts the certificate (whitespace stripped) and the last SSO URL', () => {
      const parsed = parseIdpMetadata(metadataXml);
      expect(parsed).not.toBeNull();
      expect(parsed?.certificate).toBe('MIIBIzANBgkqhkiG9w0BAQEF');
      // El ultimo binding listado gana (los IdP listan Redirect y POST).
      expect(parsed?.ssoUrl).toBe('https://idp.example.test/sso/post');
    });

    it('returns null for non-XML input', () => {
      expect(parseIdpMetadata('no soy xml')).toBeNull();
    });

    it('returns null when the XML has no certificate', () => {
      expect(
        parseIdpMetadata(
          '<EntityDescriptor><SingleSignOnService Location="https://idp/sso"/></EntityDescriptor>',
        ),
      ).toBeNull();
    });

    it('returns null when the XML has no SingleSignOnService', () => {
      expect(
        parseIdpMetadata(
          '<EntityDescriptor><X509Certificate>ABCDEF</X509Certificate></EntityDescriptor>',
        ),
      ).toBeNull();
    });

    it('parses the raw certificate element (no namespace prefix)', () => {
      const parsed = parseIdpMetadata(
        '<X509Certificate>ABCDEF</X509Certificate><SingleSignOnService Location="https://idp/sso"/>',
      );
      expect(parsed?.certificate).toBe('ABCDEF');
    });
  });

  describe('normalizeIdpCertificate', () => {
    it('strips PEM headers and whitespace', () => {
      expect(
        normalizeIdpCertificate(
          '-----BEGIN CERTIFICATE-----\nMIIBIzAN\nBgkq\n-----END CERTIFICATE-----',
        ),
      ).toBe('MIIBIzANBgkq');
    });

    it('passes through a bare base64 body', () => {
      expect(normalizeIdpCertificate('MIIBIzANBgkq')).toBe('MIIBIzANBgkq');
    });
  });
});
