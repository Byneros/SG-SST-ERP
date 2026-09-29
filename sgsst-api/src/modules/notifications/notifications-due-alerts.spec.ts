import { NotificationPriority, NotificationType, Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

/**
 * S8.3: la generacion de alertas incluye actividades del plan anual
 * (proximas/vencidas/sin evidencia) ademas de documentos, capacitaciones
 * e incidentes. S10.2: tambien examenes ocupacionales por nextDueAt.
 * Prueba el escaneo y la creacion de notificaciones TASK.
 */
describe('NotificationsService.generateDueAlertsForCompany (plan anual)', () => {
  const notificationCreate = jest.fn();
  const notificationFindFirst = jest.fn();
  const prisma = {
    notification: {
      create: notificationCreate,
      findFirst: notificationFindFirst,
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    training: { findMany: jest.fn().mockResolvedValue([]) },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
    company: { findUnique: jest.fn(), findMany: jest.fn() },
    externalDelivery: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: { findMany: jest.fn() },
    annualPlanActivity: { findMany: jest.fn().mockResolvedValue([]) },
    medicalExam: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const emailService = { send: jest.fn() };
  const whatsAppService = { sendText: jest.fn() };
  const auditService = { log: jest.fn() };
  const service = new NotificationsService(
    prisma as never,
    emailService as never,
    whatsAppService as never,
    auditService as never,
  );

  // Fechas relativas al reloj real: vencida = hace 30 dias, proxima = en 15.
  const now = new Date();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const daysAhead = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const companyUsers = [
    { id: 'sst-1', companyId: 'company-a', role: Role.SST },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue(companyUsers);
    // create() sin duplicado previo: devuelve la notificacion recien creada.
    notificationFindFirst.mockResolvedValue(null);
    notificationCreate.mockImplementation(
      (input: { data: { type?: string; priority?: string } }) =>
        Promise.resolve({
          id: `n-${notificationCreate.mock.calls.length}`,
          // En el momento de la llamada: el servicio cuenta la notificacion
          // como nueva cuando createdAt >= su propio `now` interno.
          createdAt: new Date(),
          user: { email: 'sst@a.com', name: 'SST' },
          ...input.data,
          type: input.data.type ?? 'INFO',
          priority: input.data.priority ?? 'MEDIUM',
        }),
    );
    // Documentos/trainings/incidentes/plan/examenes vacios: escaneo base.
    prisma.$transaction.mockResolvedValue([[], [], [], [], []]);
  });

  it('escanea actividades del plan anual y examenes medicos junto a documents/trainings/incidents', async () => {
    prisma.$transaction.mockResolvedValue([[], [], [], [], []]);

    const result = await service.generateDueAlertsForCompany('company-a');

    expect(result.scanned).toEqual({
      documents: 0,
      trainings: 0,
      incidents: 0,
      planActivities: 0,
      medicalExams: 0,
    });
    // El where del escaneo excluye actividades DONE/CANCELLED y filtra por
    // vencidas/proximas/sin evidencia (OR sobre dueDate y evidenceId).
    const activityCall = (
      prisma.annualPlanActivity.findMany.mock.calls as Array<
        [{ where: { status: unknown; OR: unknown[] } }]
      >
    )[0][0];
    expect(activityCall.where.status).toEqual({ notIn: ['DONE', 'CANCELLED'] });
    expect(activityCall.where.OR).toHaveLength(3);
    // S10.2: examenes filtrados por nextDueAt vencida o dentro de 30 dias.
    const examCall = (
      prisma.medicalExam.findMany.mock.calls as Array<
        [{ where: { nextDueAt: unknown; OR: unknown[] } }]
      >
    )[0][0];
    expect(examCall.where.nextDueAt).toEqual({ not: null });
    expect(examCall.where.OR).toHaveLength(2);
  });

  it('crea notificacion TASK critica para una actividad vencida con evidencia', async () => {
    prisma.$transaction.mockResolvedValue([
      [], // documents
      [], // trainings
      [], // incidents
      [
        {
          id: 'act-overdue',
          name: 'Inspeccion extintores',
          dueDate: daysAgo(30),
          status: 'IN_PROGRESS',
          evidenceId: 'doc-1',
          companyId: 'company-a',
          plan: { year: 2026 },
        },
      ],
      [], // medicalExams
    ]);

    const result = await service.generateDueAlertsForCompany('company-a');

    expect(result.created).toBe(1);
    // Cast explicito: mock.calls llega como any y el linter exige tiparlo.
    const createCall = (
      notificationCreate.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0];
    const data = createCall.data;
    expect(data).toMatchObject({
      userId: 'sst-1',
      companyId: 'company-a',
      title: 'Actividad del plan anual vencida',
      type: NotificationType.TASK,
      priority: NotificationPriority.CRITICAL,
      entity: 'AnnualPlanActivity',
      entityId: 'act-overdue',
    });
    expect(String(data.message)).toContain('vencio el');
  });

  it('marca sin evidencia en el mensaje de una actividad proxima sin documento', async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      [],
      [],
      [
        {
          id: 'act-upcoming',
          name: 'Simulacro de evacuacion',
          dueDate: daysAhead(15),
          status: 'PENDING',
          evidenceId: null,
          companyId: 'company-a',
          plan: { year: 2026 },
        },
      ],
      [], // medicalExams
    ]);

    await service.generateDueAlertsForCompany('company-a');

    const upcomingCall = (
      notificationCreate.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0];
    const data: Record<string, unknown> = upcomingCall.data;
    expect(data.title).toBe('Actividad del plan anual proxima');
    expect(data.priority).toBe(NotificationPriority.HIGH);
    expect(String(data.message)).toContain('no tiene evidencia');
    expect(String(data.message)).toContain('plan 2026');
  });

  it('S10.2: crea notificacion TASK critica para un examen ocupacional vencido', async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      [],
      [],
      [],
      [
        {
          id: 'exam-overdue',
          examType: 'PERIODICO',
          scheduledAt: daysAgo(400),
          nextDueAt: daysAgo(35),
          companyId: 'company-a',
          employee: { firstName: 'Ana', lastName: 'Perez' },
        },
      ],
    ]);

    const result = await service.generateDueAlertsForCompany('company-a');

    expect(result.created).toBe(1);
    const createCall = (
      notificationCreate.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0];
    expect(createCall.data).toMatchObject({
      userId: 'sst-1',
      companyId: 'company-a',
      title: 'Examen ocupacional vencido',
      type: NotificationType.TASK,
      priority: NotificationPriority.CRITICAL,
      entity: 'MedicalExam',
      entityId: 'exam-overdue',
    });
    expect(String(createCall.data.message)).toContain('Ana Perez');
    expect(String(createCall.data.message)).toContain('debia realizarse');
  });

  it('S10.2: crea notificacion de alta prioridad para un examen proximo', async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      [],
      [],
      [],
      [
        {
          id: 'exam-upcoming',
          examType: 'INGRESO',
          scheduledAt: daysAhead(2),
          nextDueAt: daysAhead(10),
          companyId: 'company-a',
          employee: { firstName: 'Luis', lastName: 'Gomez' },
        },
      ],
    ]);

    const result = await service.generateDueAlertsForCompany('company-a');

    expect(result.created).toBe(1);
    const createCall = (
      notificationCreate.mock.calls as unknown as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0];
    expect(createCall.data).toMatchObject({
      title: 'Examen ocupacional proximo',
      type: NotificationType.TASK,
      priority: NotificationPriority.HIGH,
      entity: 'MedicalExam',
    });
    expect(String(createCall.data.message)).toContain('Luis Gomez');
    expect(String(createCall.data.message)).toContain('debe realizarse');
  });
});
