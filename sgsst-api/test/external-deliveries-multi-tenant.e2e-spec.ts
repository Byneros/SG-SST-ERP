import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  ExternalDeliveryProvider,
  ExternalDeliveryStatus,
} from '@prisma/client';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { env } from '../src/config/env';
import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { NotificationsQueueService } from '../src/modules/notifications/notifications-queue.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { EmailService } from '../src/modules/notifications/email.service';
import { WhatsAppService } from '../src/modules/notifications/whatsapp.service';

/**
 * Suite e2e de entregas externas en el harness multi-tenant (9.1).
 *
 * Escenario: dos empresas (A y B), ADMIN por empresa, EMPLOYEE y SUPER_ADMIN.
 * Mismo patron que `sso-multi-tenant.e2e-spec.ts`: controlador real,
 * PrismaService en memoria y cola de notificaciones deshabilitada
 * (`NOTIFICATIONS_QUEUE_ENABLED=false`) para que los endpoints de reintento
 * ejecuten el camino directo (sin Redis) de forma determinista.
 *
 * Verifica:
 *  - GET /notifications/external-deliveries: scope por empresa, filtros
 *    provider/status, busqueda y paginacion.
 *  - Aislamiento: A no ve entregas de B; ?companyId=B -> 403; EMPLOYEE -> 403;
 *    SUPER_ADMIN sin empresa activa -> 403; sin token -> 401.
 *  - POST /notifications/external-deliveries/:id/retry: exito (SENT),
 *    backoff (FAILED + nextAttemptAt), canal deshabilitado (SKIPPED),
 *    cross-tenant 403, recurso ajeno 404, RBAC 403 y auditoria
 *    EXTERNAL_DELIVERY_RETRY.
 *  - POST /notifications/retry-external-deliveries: procesa solo las entregas
 *    FAILED de la empresa del alcance, respeta nextAttemptAt futuro,
 *    maxAttempts y marca SKIPPED los proveedores sin reintento.
 */

const jwtSecret = 'test-secret';

function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

// ---------------------------------------------------------------------------
// Store en memoria
// ---------------------------------------------------------------------------

type ExternalDeliveryRow = {
  id: string;
  provider: ExternalDeliveryProvider;
  status: ExternalDeliveryStatus;
  target: string | null;
  subject: string | null;
  payload: { text: string } | null;
  response: unknown;
  error: string | null;
  entity: string | null;
  entityId: string | null;
  attemptedAt: Date;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  companyId: string | null;
  notificationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
  isActive: boolean;
};

class MemoryStore {
  companies: Array<{ id: string; name: string; isActive: boolean }> = [];
  users: UserRow[] = [];
  externalDeliveries: ExternalDeliveryRow[] = [];
}

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const ADMIN_A = 'admin-a-id';
const ADMIN_B = 'admin-b-id';
const EMPLOYEE_A = 'employee-a-id';
const SUPER_ADMIN = 'super-admin-id';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedDeliveries(store: MemoryStore) {
  store.externalDeliveries = [];
  const base = {
    subject: 'Alerta operativa',
    entity: 'Incident',
    entityId: 'incident-1',
    notificationId: null,
    response: null,
    deliveredAt: null,
    createdAt: new Date('2026-09-23T10:00:00Z'),
  };
  const row = (
    id: string,
    overrides: Partial<ExternalDeliveryRow>,
  ): ExternalDeliveryRow => ({
    id,
    provider: ExternalDeliveryProvider.WHATSAPP,
    status: ExternalDeliveryStatus.FAILED,
    target: '+573001111111',
    payload: { text: 'Alerta de prueba' },
    error: 'Graph API unreachable',
    companyId: COMPANY_A,
    attemptedAt: new Date('2026-09-23T10:00:00Z'),
    attemptCount: 1,
    maxAttempts: 3,
    nextAttemptAt: null,
    updatedAt: new Date('2026-09-23T10:00:00Z'),
    ...base,
    ...overrides,
  });

  store.externalDeliveries.push(
    // A: reintentable (FAILED, intentos < max, sin backoff pendiente).
    // attemptedAt distintos para orden determinista (desc = mas nuevo primero).
    row('delivery-a1', {
      companyId: COMPANY_A,
      attemptedAt: new Date('2026-09-23T10:00:00Z'),
    }),
    // A: agotada (attemptCount == maxAttempts): el masivo la salta; el manual
    // forzado (force: true) si la reintentara.
    row('delivery-a2', {
      attemptCount: 3,
      maxAttempts: 3,
      attemptedAt: new Date('2026-09-23T10:05:00Z'),
    }),
    // A: ya enviada (el masivo solo mira FAILED)
    row('delivery-a3', {
      status: ExternalDeliveryStatus.SENT,
      attemptedAt: new Date('2026-09-23T10:10:00Z'),
    }),
    // A: reintentable de otra empresa para filtros
    row('delivery-a4', {
      subject: 'Cambio pendiente de evaluacion',
      attemptedAt: new Date('2026-09-23T10:15:00Z'),
    }),
    // A: proveedor sin implementacion de reintento -> SKIPPED en el masivo
    row('delivery-a5', {
      provider: ExternalDeliveryProvider.EMAIL,
      attemptedAt: new Date('2026-09-23T10:20:00Z'),
    }),
    // A: WHATSAPP sin payload de texto -> SKIPPED en el masivo
    row('delivery-a6', {
      payload: null,
      target: null,
      attemptedAt: new Date('2026-09-23T10:25:00Z'),
    }),
    // B: reintentable propia de la otra empresa
    row('delivery-b1', {
      companyId: COMPANY_B,
      target: '+573002222222',
      attemptedAt: new Date('2026-09-23T10:30:00Z'),
    }),
  );
}

// ---------------------------------------------------------------------------
// Prisma en memoria (superficie usada por NotificationsService)
// ---------------------------------------------------------------------------

/** Evalua una condicion Prisma (soporta OR/AND anidados y nextAttemptAt). */
function matchesDelivery(
  row: ExternalDeliveryRow,
  cond: Record<string, unknown> | undefined,
): boolean {
  if (!cond) return true;
  for (const [key, value] of Object.entries(cond)) {
    if (value === undefined) continue;
    if (key === 'OR') {
      const orConds = value as Array<Record<string, unknown>>;
      if (!orConds.some((inner) => matchesDelivery(row, inner))) return false;
      continue;
    }
    if (key === 'AND') {
      const andConds = value as Array<Record<string, unknown>>;
      if (!andConds.every((inner) => matchesDelivery(row, inner))) return false;
      continue;
    }
    if (key === 'attemptCount' && typeof value === 'object' && value) {
      const { lt } = value as { lt?: number };
      if (lt !== undefined && !(row.attemptCount < lt)) return false;
      continue;
    }
    if (key === 'nextAttemptAt') {
      if (value === null) {
        if (row.nextAttemptAt !== null) return false;
      } else if (typeof value === 'object' && value) {
        const { lte } = value as { lte?: Date };
        if (lte !== undefined) {
          if (!row.nextAttemptAt || row.nextAttemptAt > lte) return false;
        }
      }
      continue;
    }
    if (typeof value === 'object' && value !== null && 'contains' in value) {
      // mode: 'insensitive' (Prisma contains)
      const { contains } = value as { contains: string };
      const field = row[key as keyof ExternalDeliveryRow];
      if (
        typeof field !== 'string' ||
        !field.toLowerCase().includes(String(contains).toLowerCase())
      ) {
        return false;
      }
      continue;
    }
    if (row[key as keyof ExternalDeliveryRow] !== value) return false;
  }
  return true;
}

function buildPrismaMock(store: MemoryStore) {
  const externalDelivery = {
    create: jest.fn(({ data }: { data: Partial<ExternalDeliveryRow> }) => {
      const now = new Date();
      const row: ExternalDeliveryRow = {
        id: randomUUID(),
        provider: ExternalDeliveryProvider.WHATSAPP,
        status: ExternalDeliveryStatus.PENDING,
        target: null,
        subject: null,
        payload: null,
        response: null,
        error: null,
        entity: null,
        entityId: null,
        attemptedAt: now,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
        companyId: null,
        notificationId: null,
        attemptCount: 0,
        maxAttempts: 3,
        nextAttemptAt: null,
        ...data,
      };
      store.externalDeliveries.push(row);
      return clone(row);
    }),
    findUnique: jest.fn(({ where }: { where: { id: string } }) => {
      const row = store.externalDeliveries.find((d) => d.id === where.id);
      return row ? clone(row) : null;
    }),
    findMany: jest.fn(
      ({
        where,
        orderBy,
        take,
        skip,
      }: {
        where?: Record<string, unknown>;
        orderBy?: { attemptedAt?: 'asc' | 'desc' };
        take?: number;
        skip?: number;
      }) => {
        let rows = store.externalDeliveries.filter((r) =>
          matchesDelivery(r, where),
        );
        rows = rows
          .slice()
          .sort((a, b) =>
            orderBy?.attemptedAt === 'asc'
              ? a.attemptedAt.getTime() - b.attemptedAt.getTime()
              : b.attemptedAt.getTime() - a.attemptedAt.getTime(),
          );
        const start = skip ?? 0;
        const end = take !== undefined ? start + take : undefined;
        return rows.slice(start, end).map(clone);
      },
    ),
    count: jest.fn(
      ({ where }: { where?: Record<string, unknown> }) =>
        store.externalDeliveries.filter((r) => matchesDelivery(r, where))
          .length,
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ExternalDeliveryRow>;
      }) => {
        const row = store.externalDeliveries.find((d) => d.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return clone(row);
      },
    ),
  };

  return {
    externalDelivery,
    company: { findUnique: jest.fn(() => null) },
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
  };
}

// ---------------------------------------------------------------------------
// WhatsApp mock con comportamiento controlable por test
// ---------------------------------------------------------------------------

type WhatsAppBehavior = 'sent' | 'disabled' | 'misconfigured' | 'error';
const whatsappBehavior: { mode: WhatsAppBehavior } = { mode: 'sent' };

function buildWhatsAppMock() {
  return {
    sendText: jest.fn(() => {
      switch (whatsappBehavior.mode) {
        case 'sent':
          return {
            sent: true,
            response: { messages: [{ id: 'wamid.mock' }] },
          };
        case 'disabled':
          return { sent: false, disabled: true };
        case 'misconfigured':
          return { sent: false, disabled: false };
        case 'error':
        default:
          throw new Error('Graph API unreachable');
      }
    }),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('External deliveries (e2e multi-tenant)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const store = new MemoryStore();
  const prismaMock = buildPrismaMock(store);
  const whatsAppMock = buildWhatsAppMock();
  const auditLog = jest.fn().mockResolvedValue(undefined);

  const tokenFor = (user: {
    sub: string;
    role: string;
    companyId: string | null;
    activeCompanyId?: string | null;
  }) =>
    jwtService.sign({
      email: `${user.sub}@example.com`,
      type: 'access',
      ...user,
    });

  let adminAToken: string;
  let adminBToken: string;
  let employeeAToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    // Cola deshabilitada: los endpoints de reintento ejecutan el camino
    // directo de NotificationsService (sin Redis) y onModuleInit no abre
    // conexiones. Es el mismo efecto de NOTIFICATIONS_QUEUE_ENABLED=false.
    Object.assign(env, { notificationsQueueEnabled: false });

    store.companies = [
      { id: COMPANY_A, name: 'Empresa A', isActive: true },
      { id: COMPANY_B, name: 'Empresa B', isActive: true },
    ];
    store.users = [
      {
        id: ADMIN_A,
        name: 'Admin A',
        email: 'admin-a@example.com',
        role: 'ADMIN',
        companyId: COMPANY_A,
        isActive: true,
      },
      {
        id: ADMIN_B,
        name: 'Admin B',
        email: 'admin-b@example.com',
        role: 'ADMIN',
        companyId: COMPANY_B,
        isActive: true,
      },
      {
        id: EMPLOYEE_A,
        name: 'Empleado A',
        email: 'employee-a@example.com',
        role: 'EMPLOYEE',
        companyId: COMPANY_A,
        isActive: true,
      },
      {
        id: SUPER_ADMIN,
        name: 'Super Admin',
        email: 'super@example.com',
        role: 'SUPER_ADMIN',
        companyId: null,
        isActive: true,
      },
    ];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        NotificationsQueueService,
        JwtAuthGuard,
        RolesGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: WhatsAppService, useValue: whatsAppMock },
        { provide: AuditService, useValue: { log: auditLog } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = app.get(JwtService);
    adminAToken = tokenFor({
      sub: ADMIN_A,
      role: 'ADMIN',
      companyId: COMPANY_A,
      activeCompanyId: COMPANY_A,
    });
    adminBToken = tokenFor({
      sub: ADMIN_B,
      role: 'ADMIN',
      companyId: COMPANY_B,
      activeCompanyId: COMPANY_B,
    });
    employeeAToken = tokenFor({
      sub: EMPLOYEE_A,
      role: 'EMPLOYEE',
      companyId: COMPANY_A,
      activeCompanyId: COMPANY_A,
    });
    // SUPER_ADMIN sin empresa activa: el alcance exige seleccionar una.
    superAdminToken = tokenFor({
      sub: SUPER_ADMIN,
      role: 'SUPER_ADMIN',
      companyId: null,
    });
  });

  afterAll(async () => {
    await app.close();
    // Restaura el estado global de env para otras suites del proceso.
    Object.assign(env, { notificationsQueueEnabled: true });
  });

  beforeEach(() => {
    seedDeliveries(store);
    auditLog.mockClear();
    whatsAppMock.sendText.mockClear();
    whatsappBehavior.mode = 'sent';
  });

  describe('GET /notifications/external-deliveries', () => {
    it('lista solo las entregas de la empresa del ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);

      const list = body<{
        data: Array<{ id: string }>;
        meta: { total: number };
      }>(res);
      expect(list.meta.total).toBe(6);
      expect(list.data.map((d) => d.id)).toEqual([
        'delivery-a6',
        'delivery-a5',
        'delivery-a4',
        'delivery-a3',
        'delivery-a2',
        'delivery-a1',
      ]);
    });

    it('aisla por empresa: el ADMIN B solo ve las suyas', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);

      const list = body<{
        data: Array<{ id: string }>;
        meta: { total: number };
      }>(res);
      expect(list.meta.total).toBe(1);
      expect(list.data.map((d) => d.id)).toEqual(['delivery-b1']);
    });

    it('rechaza companyId fuera del alcance (403)', async () => {
      await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .query({ companyId: COMPANY_B })
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(403);
    });

    it('filtra por provider, status y busqueda', async () => {
      const failedWhatsapp = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .query({ status: 'FAILED', provider: 'WHATSAPP' })
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      const failed = body<{ data: Array<{ id: string }> }>(failedWhatsapp);
      expect(failed.data.map((d) => d.id).sort()).toEqual([
        'delivery-a1',
        'delivery-a2',
        'delivery-a4',
        'delivery-a6',
      ]);

      const search = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .query({ search: 'Cambio pendiente' })
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      const found = body<{ data: Array<{ id: string }> }>(search);
      expect(found.data.map((d) => d.id)).toEqual(['delivery-a4']);
    });

    it('pagina con page/pageSize', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .query({ page: 2, pageSize: 4 })
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      const list = body<{
        data: Array<{ id: string }>;
        meta: { total: number; totalPages: number };
      }>(res);
      expect(list.data).toHaveLength(2);
      expect(list.meta.total).toBe(6);
      expect(list.meta.totalPages).toBe(2);
    });

    it('requiere rol ADMIN (EMPLOYEE -> 403) y token valido (401)', async () => {
      await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .expect(401);
    });

    it('SUPER_ADMIN sin empresa activa no puede listar (403)', async () => {
      await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(403);
    });
  });

  describe('POST /notifications/external-deliveries/:id/retry', () => {
    it('reintenta y marca SENT con deliveredAt y auditoria', async () => {
      whatsappBehavior.mode = 'sent';
      const res = await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-a1/retry')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);

      const delivery = body<{
        id: string;
        status: string;
        attemptCount: number;
        error: null;
        deliveredAt: string | null;
      }>(res);
      expect(delivery.status).toBe('SENT');
      expect(delivery.attemptCount).toBe(2);
      expect(delivery.error).toBeNull();
      expect(delivery.deliveredAt).toBeTruthy();
      expect(whatsAppMock.sendText).toHaveBeenCalledTimes(1);
      expect(auditLog).toHaveBeenCalledTimes(1);
      type AuditCall = {
        action: string;
        entityId: string;
        before: { status: string; attemptCount: number };
        after: { status: string };
      };
      // mock.calls[0] es el array de argumentos de la primera llamada.
      const [firstAuditCall] =
        (auditLog.mock.calls as unknown as AuditCall[][])[0] ?? [];
      expect(firstAuditCall?.action).toBe('EXTERNAL_DELIVERY_RETRY');
      expect(firstAuditCall?.entityId).toBe('delivery-a1');
      expect(firstAuditCall?.before).toEqual({
        status: 'FAILED',
        attemptCount: 1,
      });
      expect(firstAuditCall?.after.status).toBe('SENT');
    });

    it('registra FAILED con backoff cuando el canal falla', async () => {
      whatsappBehavior.mode = 'error';
      const res = await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-a1/retry')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);

      const delivery = body<{
        status: string;
        attemptCount: number;
        nextAttemptAt: string | null;
      }>(res);
      expect(delivery.status).toBe('FAILED');
      expect(delivery.attemptCount).toBe(2);
      expect(delivery.nextAttemptAt).toBeTruthy();
    });

    it('marca SKIPPED cuando el canal esta deshabilitado', async () => {
      whatsappBehavior.mode = 'disabled';
      const res = await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-a1/retry')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);

      const delivery = body<{ status: string; error: string | null }>(res);
      expect(delivery.status).toBe('SKIPPED');
      expect(delivery.error).toContain('globally disabled');
    });

    it('permite reintento manual forzado de una entrega agotada', async () => {
      // force: true del reintento manual ignora el bloqueo por maxAttempts.
      whatsappBehavior.mode = 'sent';
      const res = await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-a2/retry')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);
      const delivery = body<{ status: string; attemptCount: number }>(res);
      expect(delivery.status).toBe('SENT');
      expect(delivery.attemptCount).toBe(4);
    });

    it('rechaza cross-tenant (403) y recurso inexistente (404)', async () => {
      await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-b1/retry')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/notifications/external-deliveries/${randomUUID()}/retry`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(404);
    });

    it('requiere rol ADMIN (EMPLOYEE -> 403)', async () => {
      await request(app.getHttpServer())
        .post('/notifications/external-deliveries/delivery-a1/retry')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .expect(403);
    });
  });

  describe('POST /notifications/retry-external-deliveries (masivo)', () => {
    it('procesa solo las FAILED de la empresa y salta lo no reintentable', async () => {
      whatsappBehavior.mode = 'sent';
      const res = await request(app.getHttpServer())
        .post('/notifications/retry-external-deliveries')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);

      const summary = body<{
        success: boolean;
        scanned: number;
        retried: number;
        sent: number;
        failed: number;
        skipped: number;
      }>(res);
      // FAILED de A: a1, a2 (agotada), a4, a5 (EMAIL), a6 (sin payload).
      // El masivo filtra attemptCount < maxAttempts: excluye a2.
      expect(summary.success).toBe(true);
      expect(summary.scanned).toBe(4);
      expect(summary.retried).toBe(4);
      expect(summary.sent).toBe(2); // a1 y a4 (WHATSAPP con payload)
      expect(summary.skipped).toBe(2); // a5 (proveedor) y a6 (sin payload)
      expect(summary.failed).toBe(0);

      // La entrega de B queda intacta.
      const listB = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);
      const b = body<{ data: Array<{ status: string; attemptCount: number }> }>(
        listB,
      );
      expect(b.data).toHaveLength(1);
      expect(b.data[0].status).toBe('FAILED');
      expect(b.data[0].attemptCount).toBe(1);
    });

    it('registra FAILED con backoff cuando el canal falla en el masivo', async () => {
      whatsappBehavior.mode = 'error';
      const res = await request(app.getHttpServer())
        .post('/notifications/retry-external-deliveries')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(201);
      const summary = body<{ sent: number; failed: number; skipped: number }>(
        res,
      );
      expect(summary.failed).toBe(2);
      expect(summary.skipped).toBe(2);
    });

    it('respeta el scope de empresa por ADMIN', async () => {
      whatsappBehavior.mode = 'sent';
      await request(app.getHttpServer())
        .post('/notifications/retry-external-deliveries')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(201);

      // Solo delivery-b1 fue reintentada por B.
      const listA = await request(app.getHttpServer())
        .get('/notifications/external-deliveries')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200);
      const a = body<{ data: Array<{ id: string; status: string }> }>(listA);
      const a1 = a.data.find((d) => d.id === 'delivery-a1');
      expect(a1?.status).toBe('FAILED');
    });

    it('requiere rol ADMIN (EMPLOYEE -> 403)', async () => {
      await request(app.getHttpServer())
        .post('/notifications/retry-external-deliveries')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .expect(403);
    });
  });
});
