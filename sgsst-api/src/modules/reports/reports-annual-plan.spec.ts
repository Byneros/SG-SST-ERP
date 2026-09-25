import { ReportsService } from './reports.service';

/**
 * S8.4: el reporte `annual-plan` devuelve una fila resumen del plan más una
 * fila por actividad, con % de avance agregado y estado de evidencia.
 */
describe('ReportsService (annual-plan)', () => {
  const prisma = {
    annualWorkPlan: {
      findMany: jest.fn(),
    },
    plannedInspection: { findMany: jest.fn().mockResolvedValue([]) },
    unplannedInspection: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const auditService = { log: jest.fn() };
  const service = new ReportsService(prisma as never, auditService as never);

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('csv incluye fila resumen, avance del plan y estado de evidencia', async () => {
    prisma.annualWorkPlan.findMany.mockResolvedValue([
      {
        id: 'plan-1',
        year: 2026,
        status: 'IN_PROGRESS',
        company: { name: 'Empresa A', nit: '900000001-1' },
        activities: [
          {
            id: 'act-1',
            name: 'Inspeccion extintores',
            cycle: 'HACER',
            dueDate: new Date('2026-10-01T00:00:00Z'),
            progress: 100,
            status: 'DONE',
            evidenceId: 'doc-1',
            owner: { name: 'SST Responsable' },
          },
          {
            id: 'act-2',
            name: 'Simulacro de evacuacion',
            cycle: 'ACT',
            dueDate: new Date('2026-11-15T00:00:00Z'),
            progress: 50,
            status: 'IN_PROGRESS',
            evidenceId: null,
            owner: null,
          },
        ],
      },
    ]);

    const csv = await service.csv(adminA, 'annual-plan');

    // Cabecera del plan con el % agregado: (100 + 50) / 2 = 75.
    expect(csv).toContain('RESUMEN DEL PLAN');
    expect(csv).toContain('Empresa A');
    expect(csv).toContain('75');
    // Fila por actividad: evidencia adjunta vs pendiente, responsable.
    expect(csv).toContain('Inspeccion extintores');
    expect(csv).toContain('Adjunta');
    expect(csv).toContain('SST Responsable');
    expect(csv).toContain('Simulacro de evacuacion');
    expect(csv).toContain('Pendiente');
    // Las actividades canceladas se excluyen del % (no aplica en este caso).
    expect(prisma.annualWorkPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-a' },
      }),
    );
  });

  it('plan sin actividades produce solo la fila resumen con avance vacio', async () => {
    prisma.annualWorkPlan.findMany.mockResolvedValue([
      {
        id: 'plan-2',
        year: 2027,
        status: 'DRAFT',
        company: { name: 'Empresa A', nit: '900000001-1' },
        activities: [],
      },
    ]);

    const csv = await service.csv(adminA, 'annual-plan');

    expect(csv).toContain('RESUMEN DEL PLAN');
    expect(csv).not.toContain('Adjunta');
  });

  it('incluye las inspecciones del anio como filas del reporte (S9 integrado)', async () => {
    prisma.annualWorkPlan.findMany.mockResolvedValue([
      {
        id: 'plan-4',
        year: 2026,
        status: 'IN_PROGRESS',
        company: { name: 'Empresa A', nit: '900000001-1' },
        activities: [],
      },
    ]);
    prisma.plannedInspection.findMany.mockResolvedValue([
      {
        id: 'insp-1',
        title: 'Inspeccion mensual',
        type: 'ORDER_CLEANING',
        status: 'COMPLETED',
        scheduledAt: new Date('2026-03-10T00:00:00Z'),
        inspector: { name: 'SST Responsable' },
        site: { name: 'Planta Norte' },
        findings: [
          { id: 'f1', action: { id: 'a1' } },
          { id: 'f2', action: null },
        ],
      },
    ]);
    prisma.unplannedInspection.findMany.mockResolvedValue([
      {
        id: 'uinsp-1',
        title: 'Visita por queja',
        reason: 'Reporte de trabajador',
        status: 'COMPLETED',
        createdAt: new Date('2026-05-20T00:00:00Z'),
        inspector: null,
        site: { name: 'Planta Norte' },
        findings: [],
      },
    ]);

    const csv = await service.csv(adminA, 'annual-plan');

    expect(csv).toContain('Inspeccion planeada: Inspeccion mensual');
    expect(csv).toContain('Inspector: SST Responsable');
    expect(csv).toContain('2 hallazgo(s), 1 accion(es)');
    expect(csv).toContain('Inspeccion no planeada: Visita por queja');
    expect(csv).toContain('REACTIVA');
  });

  it('excluye las actividades canceladas del porcentaje del plan', async () => {
    prisma.annualWorkPlan.findMany.mockResolvedValue([
      {
        id: 'plan-3',
        year: 2026,
        status: 'IN_PROGRESS',
        company: { name: 'Empresa A', nit: '900000001-1' },
        activities: [
          {
            id: 'act-a',
            name: 'Actividad vigente',
            cycle: 'ACT',
            progress: 100,
            status: 'DONE',
            evidenceId: 'doc-9',
            owner: null,
          },
          {
            id: 'act-b',
            name: 'Actividad cancelada',
            cycle: 'ACT',
            progress: 0,
            status: 'CANCELLED',
            evidenceId: null,
            owner: null,
          },
        ],
      },
    ]);

    const csv = await service.csv(adminA, 'annual-plan');

    // (100) / 1 actividad no cancelada = 100%.
    expect(csv).toContain('100');
    // La cancelada sigue apareciendo como fila (trazabilidad) pero no resta.
    expect(csv).toContain('Actividad cancelada');
  });
});
