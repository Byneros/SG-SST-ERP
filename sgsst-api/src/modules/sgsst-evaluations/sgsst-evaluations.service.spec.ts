import { NotFoundException } from '@nestjs/common';
import { SgsstEvaluationsService } from './sgsst-evaluations.service';

/**
 * Pruebas del hard delete de evaluaciones SG-SST y del filtro de listado:
 * - DELETE /sgsst-evaluations/:id borra la fila fisicamente (la cascada del
 *   esquema elimina los items) y ya no hace soft delete.
 * - Los registros legacy con soft delete no existen para el actor (404).
 * - El listado excluye los borrados por defecto (isActive ?? true), sin
 *   perder el escape explicito isActive=false.
 */
describe('SgsstEvaluationsService (hard delete y filtro de listado)', () => {
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

  it('remove responde 404 para un registro legacy con soft delete y no borra nada', async () => {
    prisma.sgsstEvaluation.findUnique.mockResolvedValue({
      ...evaluation,
      deletedAt: new Date(),
    });

    await expect(service.remove(adminA, 'eval-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.sgsstEvaluation.delete).not.toHaveBeenCalled();
    // Sin traza: el registro legacy no existe para el actor.
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('findOne responde 404 para un registro legacy con soft delete', async () => {
    prisma.sgsstEvaluation.findUnique.mockResolvedValue({
      ...evaluation,
      deletedAt: new Date(),
    });

    await expect(service.findOne(adminA, 'eval-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findAll excluye los borrados por defecto (isActive=true implicito)', async () => {
    prisma.$transaction.mockResolvedValue([[evaluation], 1]);

    const result = await service.findAll(adminA, {});

    expect(result.data).toEqual([evaluation]);
    const where = prisma.sgsstEvaluation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyId: 'company-a', isActive: true });
    // count comparte el mismo where.
    expect(prisma.sgsstEvaluation.count.mock.calls[0][0].where).toEqual(where);
  });

  it('findAll conserva el escape explicito isActive=false (auditoria de borrados)', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.findAll(adminA, { isActive: false });

    expect(prisma.sgsstEvaluation.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'company-a',
      isActive: false,
    });
  });
});
