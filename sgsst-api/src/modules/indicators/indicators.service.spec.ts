import { IndicatorsService } from './indicators.service';

/**
 * Pruebas del hard delete de indicadores y del filtro de listado:
 * - DELETE /indicators/:id borra la fila fisicamente (la cascada del esquema
 *   elimina metas y mediciones) con traza AuditLog accion DELETE (fase 1 ADR).
 * - El listado filtra solo por empresa/sede/busqueda: las columnas de baja
 *   logica fueron retiradas por la migracion de fase 2 del ADR
 *   (20260924190000_adr_fase2_site_unique_and_drop_soft_delete).
 */
describe('IndicatorsService (hard delete y listado)', () => {
  const prisma = {
    indicator: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const companyScope = {
    resolveCompanyId: jest.fn(),
    validate: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: IndicatorsService;

  const indicator = {
    id: 'ind-1',
    name: 'Indice de accidentalidad',
    companyId: 'company-a',
  };

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    companyScope.resolveCompanyId.mockReturnValue('company-a');
    service = new IndicatorsService(
      prisma as never,
      companyScope as never,
      auditService as never,
    );
  });

  it('remove borra fisicamente el indicador (cascada) y no hace soft delete', async () => {
    prisma.indicator.findUnique.mockResolvedValue(indicator);

    await expect(service.remove(adminA, 'ind-1')).resolves.toEqual({
      id: 'ind-1',
      deleted: true,
    });

    expect(prisma.indicator.delete).toHaveBeenCalledWith({
      where: { id: 'ind-1' },
    });
    expect(prisma.indicator.update).not.toHaveBeenCalled();
    // Traza de auditoria del ADR (fase 1): accion DELETE con snapshot before.
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'Indicator',
        entityId: 'ind-1',
        before: indicator,
      }),
    );
  });

  it('findAll filtra por empresa y ya no depende de isActive (columnas retiradas)', async () => {
    prisma.$transaction.mockResolvedValue([[indicator], 1]);

    const result = await service.findAll(adminA, { page: 1, pageSize: 10 });

    expect(result.data).toEqual([indicator]);
    const where = (
      prisma.indicator.findMany.mock.calls[0] as [
        { where: { companyId: string; isActive?: string } },
      ]
    )[0].where;
    expect(where.companyId).toEqual('company-a');
    expect(where.isActive).toBeUndefined();
    // count comparte el mismo where.
    expect(
      (prisma.indicator.count.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toEqual(where);
  });
});
