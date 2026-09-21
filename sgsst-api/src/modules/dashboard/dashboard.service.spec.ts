import { ForbiddenException } from '@nestjs/common';
import { DashboardService, type SiteKpi } from './dashboard.service';
/**
 * El desglose por sede agrega KPIs con groupBy filtrado por companyId:
 * una sede ajena nunca puede aportar datos al resumen de la empresa.
 */
describe('DashboardService - KPIs por sede', () => {
  const prisma = {
    company: { count: jest.fn() },
    employee: { count: jest.fn(), groupBy: jest.fn() },
    user: { count: jest.fn() },
    document: { count: jest.fn(), groupBy: jest.fn() },
    risk: { count: jest.fn(), groupBy: jest.fn() },
    incident: { count: jest.fn(), groupBy: jest.fn() },
    training: { count: jest.fn(), groupBy: jest.fn() },
    site: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const superAdmin = {
    sub: 'super-admin',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: null as string | null,
  };

  function mockTransaction() {
    // Primer $transaction: conteos globales del resumen.
    prisma.$transaction.mockImplementationOnce(async (ops: unknown[]) =>
      (ops as Array<Promise<number>>).map(() => 0),
    );
    // Segundo $transaction: sedes + groupBy de empleados/riesgos/incidentes/
    // capacitaciones/documentos.
    prisma.$transaction.mockImplementationOnce(async () => [
      [
        { id: 'site-a', name: 'Planta Norte', code: 'SEDE-NORTE', isMain: true },
        { id: 'site-b', name: 'Bodega Sur', code: 'SEDE-SUR', isMain: false },
      ],
      [{ siteId: 'site-a', _count: { _all: 12 } }],
      [{ siteId: 'site-b', _count: { _all: 2 } }],
      [{ siteId: 'site-a', _count: { _all: 3 } }],
      [{ siteId: 'site-a', _count: { _all: 4 } }],
      [{ siteId: 'site-b', _count: { _all: 7 } }],
    ]);
  }

  beforeEach(() => {
    // resetAllMocks: limpia tambien la cola de mockImplementationOnce entre tests.
    jest.resetAllMocks();
  });

  function createService() {
    const service = new DashboardService(prisma as never);
    // Evita Redis real en pruebas unitarias (la conexion puede quedar colgada).
    jest
      .spyOn(service as unknown as { getCachedSummary: (key: string) => Promise<unknown> }, 'getCachedSummary')
      .mockResolvedValue(null);
    jest
      .spyOn(service as unknown as { setCachedSummary: (key: string, value: unknown) => Promise<void> }, 'setCachedSummary')
      .mockResolvedValue(undefined);
    return service;
  }

  it('returns site KPIs scoped to the admin company with per-site counts', async () => {
    mockTransaction();
    const service = createService();

    const summary = await service.summary(adminA as never);

    expect(summary.siteKpis).toEqual([
      {
        siteId: 'site-a',
        name: 'Planta Norte',
        code: 'SEDE-NORTE',
        isMain: true,
        employees: 12,
        criticalRisks: 0,
        openIncidents: 3,
        trainings: 4,
        documents: 0,
      },
      {
        siteId: 'site-b',
        name: 'Bodega Sur',
        code: 'SEDE-SUR',
        isMain: false,
        employees: 0,
        criticalRisks: 2,
        openIncidents: 0,
        trainings: 0,
        documents: 7,
      },
    ]);

    // Aislamiento: los groupBy agregan por sede dentro del scope de la empresa.
    const riskGroupBy = prisma.risk.groupBy.mock.calls[0][0];
    const incidentGroupBy = prisma.incident.groupBy.mock.calls[0][0];
    const employeeGroupBy = prisma.employee.groupBy.mock.calls[0][0];
    expect(riskGroupBy.where.companyId).toBe('company-a');
    expect(incidentGroupBy.where.companyId).toBe('company-a');
    expect(employeeGroupBy.where.companyId).toBe('company-a');
    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', isActive: true }),
      }),
    );
  });

  it('blocks SUPER_ADMIN without an active company before computing KPIs', async () => {
    // Sin empresa activa no hay scope: el desglose por sede nunca se computa.
    const service = createService();

    await expect(service.summary(superAdmin as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.site.findMany).not.toHaveBeenCalled();
  });

  it('keeps site rows with zero KPIs when a site has no records', async () => {
    mockTransaction();
    const service = createService();

    const summary = await service.summary(adminA as never);

    const bodegaSur = summary.siteKpis.find(
      (kpi: SiteKpi) => kpi.siteId === 'site-b',
    );
    expect(bodegaSur).toEqual({
      siteId: 'site-b',
      name: 'Bodega Sur',
      code: 'SEDE-SUR',
      isMain: false,
      employees: 0,
      criticalRisks: 2,
      openIncidents: 0,
      trainings: 0,
      documents: 7,
    });
  });
});
