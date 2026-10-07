import { config } from 'dotenv';

// DOTENV_CONFIG_PATH permite apuntar a un .env alternativo (p. ej. el e2e de
// integracion usa test/.env.e2e-db) sin tocar el .env del desarrollador.
config({
  override: true,
  quiet: true,
  path: process.env.DOTENV_CONFIG_PATH,
});

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
  passwordResetExpiresMinutes: Number(
    process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30,
  ),
  // Bloqueo temporal por intentos fallidos de login (hardening auth).
  loginLockoutMaxAttempts: Number(process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS ?? 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3001}`,
  /** Base publica de la app web para redirects del navegador (p. ej. callback SSO). */
  webBaseUrl: process.env.WEB_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? '/',
  uploadsPath: process.env.UPLOADS_PATH ?? 'uploads',
  documentStorageDriver: process.env.DOCUMENT_STORAGE_DRIVER ?? 'local',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Bucket: process.env.S3_BUCKET ?? '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  s3ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION ?? 'AES256',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  metricsToken: process.env.METRICS_TOKEN ?? '',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  dashboardCacheTtlSeconds: Number(
    process.env.DASHBOARD_CACHE_TTL_SECONDS ?? 30,
  ),
  notificationsQueueEnabled:
    (process.env.NOTIFICATIONS_QUEUE_ENABLED ?? 'true') === 'true',
  notificationsWorkerEnabled:
    (process.env.NOTIFICATIONS_WORKER_ENABLED ?? 'true') === 'true',
  notificationsCron: process.env.NOTIFICATIONS_CRON ?? '0 7 * * *',
  reportsQueueEnabled: (process.env.REPORTS_QUEUE_ENABLED ?? 'true') === 'true',
  reportsWorkerEnabled:
    (process.env.REPORTS_WORKER_ENABLED ?? 'true') === 'true',
  reportsCleanupCron: process.env.REPORTS_CLEANUP_CRON ?? '0 3 * * *',
  reportsMetricsCron: process.env.REPORTS_METRICS_CRON ?? '30 3 * * *',
  reportsAlertsCron: process.env.REPORTS_ALERTS_CRON ?? '0 4 * * *',
  reportAlertsEnabled: (process.env.REPORT_ALERTS_ENABLED ?? 'true') === 'true',
  reportFailureRateAlertPercent: Number(
    process.env.REPORT_FAILURE_RATE_ALERT_PERCENT ?? 20,
  ),
  reportStorageAlertBytes: Number(
    process.env.REPORT_STORAGE_ALERT_BYTES ?? 1_073_741_824,
  ),
  reportExportExpirationDays: Number(
    process.env.REPORT_EXPORT_EXPIRATION_DAYS ?? 7,
  ),
  reportExportRetentionDays: Number(
    process.env.REPORT_EXPORT_RETENTION_DAYS ?? 7,
  ),
  emailEnabled: (process.env.EMAIL_ENABLED ?? 'false') === 'true',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: (process.env.SMTP_SECURE ?? 'false') === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  whatsappEnabled: (process.env.WHATSAPP_ENABLED ?? 'false') === 'true',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION ?? 'v20.0',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  externalDeliveryRetryCron:
    process.env.EXTERNAL_DELIVERY_RETRY_CRON ?? '*/10 * * * *',
  // S16.1: escalamiento de tareas vencidas por email/WhatsApp.
  taskEscalationEnabled:
    (process.env.TASK_ESCALATION_ENABLED ?? 'false') === 'true',
  taskEscalationCron: process.env.TASK_ESCALATION_CRON ?? '0 8 * * *',
  taskEscalationAdvanceDays: Number(
    process.env.TASK_ESCALATION_ADVANCE_DAYS ?? 3,
  ),
  taskEscalationDaily:
    (process.env.TASK_ESCALATION_DAILY ?? 'false') === 'true',
  // Asistente inteligente (Sprint 16). Deshabilitado por defecto: sin API key
  // el endpoint responde 503 acotado y el ERP sigue funcionando.
  aiEnabled: (process.env.AI_ENABLED ?? 'false') === 'true',
  aiBaseUrl: process.env.AI_BASE_URL ?? '',
  aiApiKey: process.env.AI_API_KEY ?? '',
  aiModel: process.env.AI_MODEL ?? 'gpt-4o-mini',
  aiTemperature: Number(process.env.AI_TEMPERATURE ?? 0.2),
  aiMaxTokens: Number(process.env.AI_MAX_TOKENS ?? 700),
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 20_000),
  aiHistoryMaxMessages: Number(process.env.AI_HISTORY_MAX_MESSAGES ?? 8),
  externalDeliveryMaxAttempts: Number(
    process.env.EXTERNAL_DELIVERY_MAX_ATTEMPTS ?? 3,
  ),
  externalDeliveryRetryBaseSeconds: Number(
    process.env.EXTERNAL_DELIVERY_RETRY_BASE_SECONDS ?? 300,
  ),
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5176,http://127.0.0.1:5176'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

// H-4 (docs/informe-seguridad-s7.md): contrasena publica del seed historico.
// Unica fuente de verdad: `prisma/seed.ts` la usa como default en desarrollo y
// `assertProductionEnv` rechaza el arranque en produccion si el seed queda con
// esa contrasena conocida.
export const PUBLIC_SEED_PASSWORD = 'Admin12345';

export function assertProductionEnv() {
  if (env.nodeEnv !== 'production') {
    return;
  }

  const invalidSecrets = new Set([
    '',
    'dev-only-change-me',
    'change-me',
    'change-me-with-a-long-random-secret',
  ]);
  const invalidMetricsTokens = new Set([
    '',
    'change-me-with-a-unique-metrics-token',
  ]);

  if (
    invalidSecrets.has(env.jwtSecret.trim()) ||
    env.jwtSecret.trim().length < 32
  ) {
    throw new Error(
      'JWT_SECRET must be a unique value of at least 32 characters in production',
    );
  }
  if (!env.databaseUrl.trim()) {
    throw new Error('DATABASE_URL must be configured in production');
  }
  if (!env.redisUrl.trim()) {
    throw new Error('REDIS_URL must be configured in production');
  }
  if (
    invalidMetricsTokens.has(env.metricsToken.trim()) ||
    env.metricsToken.trim().length < 32
  ) {
    throw new Error(
      'METRICS_TOKEN must be a unique value of at least 32 characters in production',
    );
  }
  if (env.corsOrigins.length === 0 || env.corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must contain explicit origins in production');
  }
  if (!['local', 's3'].includes(env.documentStorageDriver)) {
    throw new Error('DOCUMENT_STORAGE_DRIVER must be local or s3');
  }
  if (
    env.documentStorageDriver === 's3' &&
    (!env.s3Bucket || !env.s3AccessKeyId || !env.s3SecretAccessKey)
  ) {
    throw new Error(
      'S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for S3 storage',
    );
  }
  if (env.aiEnabled && (!env.aiApiKey.trim() || !env.aiBaseUrl.trim())) {
    throw new Error(
      'AI_ENABLED=true requires AI_API_KEY and AI_BASE_URL in production',
    );
  }
  const seedAdminPassword = (
    process.env.SEED_ADMIN_PASSWORD ?? PUBLIC_SEED_PASSWORD
  ).trim();
  if (!seedAdminPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be a unique value if the seed runs in production',
    );
  }
  if (seedAdminPassword === PUBLIC_SEED_PASSWORD) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must be rotated before deploying: the default seed password is public (H-4)',
    );
  }
}
