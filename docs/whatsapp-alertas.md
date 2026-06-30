# Alertas por WhatsApp

Las alertas criticas de reportes pueden enviarse tambien por WhatsApp usando Meta WhatsApp Cloud API.

## Variables

```text
WHATSAPP_ENABLED=true
WHATSAPP_API_VERSION=v20.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=token-seguro
EXTERNAL_DELIVERY_RETRY_CRON=*/10 * * * *
EXTERNAL_DELIVERY_MAX_ATTEMPTS=3
EXTERNAL_DELIVERY_RETRY_BASE_SECONDS=300
```

## Configuracion por empresa

En el CRUD de empresas:

- `Alertas WhatsApp`: habilita o deshabilita el canal para esa empresa.
- `Telefono WhatsApp`: telefono destino en formato internacional, por ejemplo `573001112233`.

Si WhatsApp global esta deshabilitado, la notificacion interna se crea igual y el worker solo registra el intento como omitido.

## Alcance actual

- Se envia un mensaje por alerta y empresa, no por cada usuario notificado.
- Solo aplica a alertas `HIGH` o `CRITICAL`.
- Si la alerta es global de plataforma y no tiene empresa, no se envia WhatsApp.
- Si Meta responde error, el job no se cae; se registra un warning y continua.
- Cada intento queda registrado en `ExternalDelivery` con estado `PENDING`, `SENT`, `FAILED` o `SKIPPED`.
- El registro conserva destino, asunto, payload, respuesta del proveedor, error y entidad origen.
- Las entregas `FAILED` se reintentan automaticamente con backoff exponencial.

## Auditoria de entregas

Estados:

- `SENT`: Meta acepto el mensaje.
- `FAILED`: Meta respondio error o fallo la llamada HTTP.
- `SKIPPED`: el canal global estaba apagado, la empresa no tenia WhatsApp activo o la alerta no aplicaba.
- `PENDING`: intento creado y aun no finalizado.

La tabla queda preparada para otros proveedores como email, Teams o Slack.

## Reintentos

El worker agenda `retry-external-deliveries` con `EXTERNAL_DELIVERY_RETRY_CRON`.

- `EXTERNAL_DELIVERY_MAX_ATTEMPTS`: maximo de intentos por entrega.
- `EXTERNAL_DELIVERY_RETRY_BASE_SECONDS`: base del backoff. Con `300`, los reintentos se programan aproximadamente a 5, 10 y 20 minutos.
- `POST /api/v1/notifications/retry-external-deliveries`: permite a `ADMIN` encolar un reintento manual.
