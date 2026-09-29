import { ReportsService } from './reports.service';

/**
 * S10.4 (Issue #28): el reporte `surveillance` expone los indicadores de
 * vigilancia epidemiologica: programas con su responsable y una fila por
 * cohorte de expuestos (riesgo, nivel, conteo y ultima revision).
 */
describe('ReportsService (surveillance)', () => {
  const prisma = {
    medicalSurveillanceProgram: {
      findMany: jest.fn(),
    },
  };
  const auditService = { log: jest.fn() };
  const service = new ReportsService(prisma as never, auditService as never);

  const admin = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('csv incluye programas, cohortes con nivel de riesgo y conteo de expuestos', async () => {
    prisma.medicalSurveillanceProgram.findMany.mockResolvedValue([
      {
        id: 'pve-1',
        name: 'PVE biomecanico',
        riskType: 'BIOMECANICO',
        status: 'ACTIVE',
        owner: { name: 'SST Responsable' },
        cohorts: [
          {
            id: 'coh-1',
            risk: {
              id: 'risk-1',
              title: 'Manejo de cargas',
              level: 'HIGH',
              position: 'Operario',
            },
            workers: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
            lastReviewedAt: new Date('2026-09-29T00:00:00Z'),
          },
          {
            id: 'coh-2',
            risk: null,
            workers: [],
            lastReviewedAt: null,
          },
        ],
      },
    ]);

    const csv = await service.csv(admin, 'surveillance');

    expect(csv).toContain('PVE biomecanico');
    expect(csv).toContain('BIOMECANICO');
    expect(csv).toContain('SST Responsable');
    expect(csv).toContain('Manejo de cargas');
    expect(csv).toContain('HIGH');
    // Conteo de expuestos de la primera cohorte.
    expect(csv).toContain('3');
  });

  it('sin programas devuelve una fila informativa en lugar de fallar', async () => {
    prisma.medicalSurveillanceProgram.findMany.mockResolvedValue([]);

    const csv = await service.csv(admin, 'surveillance');

    expect(csv).toContain('Sin programas de vigilancia epidemiologica');
  });

  it('el kind surveillance es valido para pdf (titulo PVE)', async () => {
    prisma.medicalSurveillanceProgram.findMany.mockResolvedValue([]);

    const pdf = await service.pdf(admin, 'surveillance');

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(500);
  });
});
