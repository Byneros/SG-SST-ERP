import { SgsstEvaluationsService } from './sgsst-evaluations.service';

/**
 * Pruebas del hard delete de evaluaciones SG-SST y del filtro de listado:
 * - DELETE /sgsst-evaluations/:id borra la fila fisicamente (la cascada del
 *   esquema elimina los items) y ya no hace soft delete.
 * - Los registros legacy con soft delete no existen para el actor (404).
 * - El listado excluye los borrados por defecto (isActive ?? true), sin
 *   perder el escape explicito isActive=false.
 */
describe('SgsstEvaluationsService (hard delete y listado)', () => {
  const prisma = {
    sgsstEvaluation: {
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
  let service: SgsstEvaluationsService;

  const evaluation = {
    id: 'eval-1',
    name: 'Evaluacion 2026',
    companyId: 'company-a',
    isActive: true,
    deletedAt: null as Date | null,
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
    service = new SgsstEvaluationsService(
      prisma as never,
      companyScope as never,
      auditService as never,
    );
  });

  it('remove borra fisicamente la evaluacion (cascada) y no hace soft delete', async () => {
    prisma.sgsstEvaluation.findUnique.mockResolvedValue(evaluation);

    await expect(service.remove(adminA, 'eval-1')).resolves.toEqual({
      id: 'eval-1',
      deleted: true,
    });

    expect(prisma.sgsstEvaluation.delete).toHaveBeenCalledWith({
      where: { id: 'eval-1' },
    });
    expect(prisma.sgsstEvaluation.update).not.toHaveBeenCalled();
    // Traza de auditoria del ADR (fase 1): accion DELETE con snapshot before.
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'SgsstEvaluation',
        entityId: 'eval-1',
        before: evaluation,
      }),
    );
  });

  it('findAll filtra por empresa y ya no depende de isActive (columnas retiradas)', async () => {
    prisma.$transaction.mockResolvedValue([[evaluation], 1]);

    const result = await service.findAll(adminA, { page: 1, pageSize: 10 });

    expect(result.data).toEqual([evaluation]);
    const where = (
      prisma.sgsstEvaluation.findMany.mock.calls[0] as [
        { where: { companyId: string } },
      ]
    )[0].where;
    expect(where).toEqual({ companyId: 'company-a' });
    // count comparte el mismo where.
    expect(
      (prisma.sgsstEvaluation.count.mock.calls[0] as [{ where: unknown }])[0]
        .where,
    ).toEqual(where);
  });
});
