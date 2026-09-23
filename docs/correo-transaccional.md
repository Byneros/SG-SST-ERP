# Correo transaccional

Las notificaciones internas pueden enviarse tambien por correo mediante SMTP.

## Variables

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASSWORD=clave
SMTP_FROM="SG-SST ERP <notificaciones@example.com>"
```

Proveedores compatibles:

- Amazon SES SMTP.
- SendGrid SMTP.
- Mailgun SMTP.
- Mailtrap para pruebas.
- SMTP corporativo.

## Comportamiento

- Si `EMAIL_ENABLED=false`, el sistema registra el intento en logs y no envia correo.
- Si SMTP esta mal configurado, la notificacion interna se crea de todas formas.
- Solo se envian por correo notificaciones con prioridad `HIGH` o `CRITICAL`.

## Recomendacion

En produccion configura `SMTP_HOST/SMTP_USER/SMTP_PASSWORD` en el `.env` del
servidor (`/opt/sgsst/.env`, permisos `600`), nunca en archivos versionados:
es el almacen de secretos decidido (`docs/arquitectura-sgsst.md` §9).
