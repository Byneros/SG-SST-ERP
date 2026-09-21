FROM postgres:16-alpine

# age para cifrado; rclone para subida a almacenamiento S3-compatible
# (S3, MinIO, GCS, Azure Blob) sin descargar binarios externos.
RUN apk add --no-cache age rclone

COPY backup.sh /usr/local/bin/backup.sh
# Normaliza finales de linea (el checkout en Windows puede introducir CRLF).
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh && chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
