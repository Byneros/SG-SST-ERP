# Guia de administracion: SSO empresarial (OIDC y SAML)

Esta guia explica como configurar el ingreso con identidad corporativa (SSO) por empresa en SG-SST ERP: que datos pedirle al IdP, donde registrar los endpoints del ERP, como escribir el mapeo de grupos a roles y como verificar que el flujo funciona. Es la referencia operativa para administradores de la plataforma y de cada empresa cliente.

Referencias tecnicas: `docs/plan-fase-9-plataforma.md` (seccion 9.4, decisiones de implementacion) y `docs/permisos-rol-employee.md` (que puede hacer cada rol).

## Conceptos

- **IdP**: el proveedor de identidad del cliente (Okta, Entra ID / Azure AD, Google Workspace, Keycloak, ADFS, etc.). Es la fuente de verdad de quien es el usuario y a que grupos pertenece.
- **SP**: el ERP. Cada empresa tiene su propia configuracion de federacion aislada (multi-tenant).
- **JIT**: aprovisionamiento automatico. Si el usuario nunca entro y no existe una cuenta con su correo, se crea una con el rol resultante del mapeo, dentro de la empresa del proveedor.
- **Rol por defecto (`defaultRole`)**: rol que reciben los usuarios que no caen en ningun grupo mapeado.

## Donde se configura

En la web: **Empresas → fila de la empresa → SSO**. Un solo proveedor activo por empresa; el protocolo se elige en el dialogo (OIDC o SAML) y solo se muestran los campos de ese protocolo. Requiere rol `ADMIN` o `SUPER_ADMIN` (auditoria `SSO_PROVIDER_SAVE` / `SSO_PROVIDER_DELETE`).

## Configuracion OIDC

Datos a pedirle al cliente:

| Campo | Que es | Ejemplo |
|---|---|---|
| Issuer del IdP | URL base que identifica al IdP | `https://idp.empresa.com` |
| Client ID | Identificador de la app registrada en el IdP | `sgsst-erp-prod` |
| Client Secret | Secreto del cliente (se guarda cifrado en reposo; al reeditar, dejar vacio conserva el actual) | — |
| Endpoint de autorizacion | URL de login del IdP | `https://idp.empresa.com/authorize` |
| Endpoint de token | URL de canje de codigo | `https://idp.empresa.com/token` |
| JWKS URI | Claves publicas para verificar la firma del id_token | `https://idp.empresa.com/.well-known/jwks.json` |
| Userinfo (opcional) | Respaldo si el IdP no devuelve id_token utilizable | `https://idp.empresa.com/userinfo` |
| Scopes | Debe incluir `openid`; `email profile` para nombres/grupos | `openid email profile` |

Registra en el IdP el **redirect URI** del ERP:

```text
{PUBLIC_BASE_URL}/api/v1/auth/sso/callback
```

Para OIDC, habilita el claim `groups` en el id_token o en userinfo si vas a usar el mapeo por grupos (en Okta/Entra es un claim personalizado; en Keycloak, un mapper).

## Configuracion SAML

Datos a pedirle al cliente (certificado directo o metadata XML; con metadata el ERP extrae cert y URL automaticamente):

| Campo | Que es |
|---|---|
| Entity ID del IdP | Identificador federado (opcional; se infiere de la metadata) |
| URL SSO del IdP | Binding redirect de login (obligatoria, salvo que venga en la metadata) |
| Certificado X.509 del IdP | PEM completo o body base64 (obligatorio, salvo que venga en la metadata) |
| Metadata XML del IdP | XML completo: si contiene `X509Certificate` y `SingleSignOnService`, rellena lo anterior |
| Entity ID del SP (opcional) | Vacio = autogenerado por empresa |

Endpoints publicos del ERP para registrar en la consola del IdP (se muestran en el dialogo):

```text
Metadata SP: {PUBLIC_BASE_URL}/api/v1/auth/sso/saml/{companyId}/metadata
ACS:         {PUBLIC_BASE_URL}/api/v1/auth/sso/saml/{companyId}/acs
Start login: {PUBLIC_BASE_URL}/api/v1/auth/sso/saml/{companyId}/authorize
```

Requisitos del IdP: assertions firmados (el Response puede ir sin firmar), algoritmo SHA-256, `nameID` en formato email recomendado y atributo de grupos si se va a mapear (`memberOf`, `groups` o URIs estandar `eduPerson`/claims de AD).

## Mapeo de grupos a roles (`roleGroups`)

Campo JSON del dialogo (OIDC y SAML):

```json
{
  "SG-SST-Admins": "ADMIN",
  "SG-SST-Contratistas": "EMPLOYEE",
  "SG-SST-Auditores": "AUDITOR",
  "SG-SST-Coordinadores": "SST"
}
```

Reglas de resolucion (verificadas por unitarios en `sso-roles.spec.ts`):

1. Se toman los grupos que el IdP envia para el usuario.
2. **El primer grupo, en el orden que envia el IdP, que tenga entrada en el mapa define el rol.** Si un usuario pertenece a dos grupos mapeados, prioriza poniendo primero el grupo del rol que quieras que gane.
3. Sin match (o sin mapa): rol por defecto del proveedor.
4. **JIT**: el rol mapeado se usa en el alta automatica.
5. **Cuenta existente**: si hay match de grupo, el rol se sincroniza en cada login (promueve o degrada segun el grupo actual del IdP). Sin match, el rol local **no se toca** (protege roles asignados manualmente desde Usuarios).
6. Roles asignables: `EMPLOYEE`, `SST`, `AUDITOR`, `ADMIN`. `SUPER_ADMIN` nunca se asigna por via automatica.

El mapeo se valida al guardar: JSON invalido o roles inexistentes se rechazan (400). El dialogo valida el JSON antes de enviar.

**Receta recomendada para un despliegue tipico** (coordinador SST mas trabajadores generales):

```json
{
  "SG-SST-Coordinadores": "SST",
  "SG-SST-Admins": "ADMIN"
}
```

`defaultRole: EMPLOYEE`. Los contratistas externos, si el cliente los federar por un grupo aparte, mapearlos explicitamente a `EMPLOYEE` para que la auditoria del mapeo quede explicita.

## Ciclo de vida de usuarios

- **Alta (JIT)**: primer login SSO crea la cuenta con el rol resuelto y la empresa del proveedor. Se genera una password aleatoria no usable (el ingreso es por SSO).
- **Vinculacion**: si ya existe una cuenta local con el mismo correo, se vincula a la identidad federada (`ssoSubject`). Se respeta aislamiento multi-tenant: una cuenta de otra empresa responde error, no se reasigna.
- **Cambio de rol**: automatico solo si el usuario cae en un grupo mapeado (regla 5); si el admin asigno un rol manual y el usuario no esta en ningun grupo del mapa, se conserva.
- **Suspension**: desactivar al usuario en el IdP no lo desactiva en el ERP (depende del IdP soportar SCIM/webhooks, hoy no integrado). Para desactivar de inmediato: **Usuarios → desactivar**; su proximo SSO responde "User is inactive".
- **Borrado de configuracion**: eliminar el proveedor SSO no borra usuarios ni sesiones activas; los logins SSO posteriores responden "SSO is not configured for this company".

## Verificacion (checklist)

1. Configurar el proveedor y guardar; verificar que el dialogo reabre con los datos.
2. Abrir el login de la web → **Ingresar con SSO empresarial** → elegir la empresa.
3. Confirmar en el IdP que el usuario de prueba pertenece a un grupo mapeado.
4. Completar el login en el IdP y volver a la web con sesion iniciada.
5. Verificar en la web: rol del usuario (debe ser el mapeado) y empresa activa correcta.
6. Verificar en el log de auditoria: evento `SSO_PROVIDER_SAVE` al guardar la configuracion.
7. Probar el caso negativo: usuario sin grupo mapeado debe entrar con `defaultRole`, y una cuenta desactivada debe ser rechazada.
8. Para SAML, validar ademas: `GET .../metadata` responde XML y el IdP acepta el certificado/expiracion.

## Problemas frecuentes

| Sintoma | Causa probable | Solucion |
|---|---|---|
| `Invalid or expired state` / `Invalid or expired RelayState` | El usuario tardo mas de 10 min en el IdP, o reuso del navegador (atras/refresh) | Reintentar el login desde la web; el state es one-shot por diseno |
| `RelayState does not match IdP` | La respuesta SAML llego al ACS de otra empresa | Verificar que el Entity ID del SP en el IdP corresponde a la empresa correcta |
| `Invalid SAML response` | Cert del IdP rotado o assertion sin firma | Actualizar el certificado/metadata en la config; el IdP debe firmar assertions |
| `SAML provider missing IdP certificate` | Config incompleta al guardar | Pegar cert directo o metadata XML que lo contenga |
| `IdP did not provide an email` | El assertion/token no trae email ni nameID con formato email | Agregar el claim/atributo de email en el IdP |
| Entra siempre con `defaultRole` | El claim `groups` no esta habilitado o el nombre del grupo no coincide (mayusculas/espacios) | Habilitar el claim en el IdP y copiar el nombre exacto del grupo en el mapa |
| El rol no se degrada aunque quito al usuario del grupo | Era un match previo y ahora no hay match (regla 5) | Comportamiento esperado: ajustar el rol manualmente en Usuarios si hace falta |
| Redirect del IdP falla | redirect URI mal registrado en OIDC o ACS mal copiado en SAML | Comparar con los endpoints de esta guia; revisar `PUBLIC_BASE_URL` vs dominio real |
