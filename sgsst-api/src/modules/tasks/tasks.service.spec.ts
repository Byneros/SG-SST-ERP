import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { TasksService } from './tasks.service';

/**
 * S15.3: bandeja de tareas. Origen trazable same-tenant (404 si es ajeno),
 * owner del tenant, comentarios cerrados sobre tareas abiertas y generacion
 * automatica desde hallazgos MAJOR/CRITICAL (idempotente, prioridad por
 * severidad). Auditoria por operacion.
 */
describe('TasksService - S15.3', () => {
  const repository = {
    findMany: jest.fn(),
    summary: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    createComment: jest.fn(),
    findCommentByIdScoped: jest.fn(),
    removeComment: jest.fn(),
  };
  const prisma = {
    finding: { findFirst: jest.fn() },
    actionPlan: { findFirst: jest.fn() },
    changeRequest: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    task: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  };
  const auditService = { log: jest.fn() };

  const service = new TasksService(
    repository as never,
    prisma as never,
    auditService as never,
  );

  const user: AuthenticatedUser = {
    sub: 'user-1',
    email: 'sst@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const taskId = 'task-1';

  function mockTask(overrides: Record<string, unknown> = {}) {
    repository.findByIdScoped.mockResolvedValue({
      id: taskId,
      title: 'Gestionar hallazgo: Fuga grave',
      sourceType: 'FINDING',
      sourceId: 'finding-1',
      status: 'OPEN',
      ownerId: null,
      closedAt: null,
      companyId: 'company-a',
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Creacion con origen trazable --------------------------------------------

  it('create acepta tareas MANUAL sin origen y audita', async () => {
    repository.create.mockResolvedValue({ id: taskId, status: 'OPEN' });

    const result = await service.create(user, {
      title: 'Coordinar charla de 5 minutos',
      sourceType: 'MANUAL',
      companyId: 'company-a',
    });

    expect(result.id).toBe(taskId);
    expect(prisma.finding.findFirst).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'Task' }),
    );
  });

  it('create exige sourceId para origenes que no son MANUAL', async () => {
    await expect(
      service.create(user, {
        title: 'Tarea sin origen',
        sourceType: 'FINDING',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create rechaza un origen de otra empresa con 404', async () => {
    prisma.finding.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        title: 'Tarea cruzada',
        sourceType: 'FINDING',
        sourceId: 'finding-otro-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create valida que el responsable sea del tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        title: 'Tarea con responsable ajeno',
        sourceType: 'MANUAL',
        ownerId: 'user-otro-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // --- Actualizacion y borrado ---------------------------------------------------

  it('update responde 404 para una tarea de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.update(user, taskId, { status: 'DONE' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.updateScoped).not.toHaveBeenCalled();
  });

  it('update valida el nuevo responsable del tenant y audita', async () => {
    mockTask();
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
    repository.updateScoped.mockResolvedValue({
      id: taskId,
      ownerId: 'user-2',
    });

    const result = await service.update(user, taskId, { ownerId: 'user-2' });

    expect(result.ownerId).toBe('user-2');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', entity: 'Task' }),
    );
  });

  it('remove hace hard delete con traza de la tarea', async () => {
    mockTask();
    prisma.task.delete.mockResolvedValue({ id: taskId });

    const result = await service.remove(user, taskId);

    expect(result.deleted).toBe(true);
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: taskId } });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entity: 'Task' }),
    );
  });

  // --- Comentarios -----------------------------------------------------------------

  it('addComment rechaza comentar una tarea cerrada', async () => {
    mockTask({ status: 'DONE', closedAt: new Date() });

    await expect(
      service.addComment(user, taskId, { body: 'Tarde' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.createComment).not.toHaveBeenCalled();
  });

  it('addComment registra el comentario con el autor autenticado', async () => {
    mockTask();
    repository.createComment.mockResolvedValue({
      id: 'comment-1',
      body: 'Avance 50%',
      authorId: 'user-1',
    });

    const comment = await service.addComment(user, taskId, {
      body: 'Avance 50%',
    });

    expect(comment.authorId).toBe('user-1');
    expect(repository.createComment).toHaveBeenCalledWith(taskId, 'user-1', {
      body: 'Avance 50%',
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'TaskComment' }),
    );
  });

  it('removeComment responde 404 para un comentario de otra tarea/empresa', async () => {
    mockTask();
    repository.findCommentByIdScoped.mockResolvedValue(null);

    await expect(
      service.removeComment(user, taskId, 'comment-otro'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.removeComment).not.toHaveBeenCalled();
  });

  // --- Resumen del widget ------------------------------------------------------------

  it('summary delega en el repositorio con el scope del tenant', async () => {
    repository.summary.mockResolvedValue({
      total: 3,
      overdue: 1,
      dueSoon: 2,
      mine: 2,
      mineOverdue: 1,
    });

    const result = await service.summary(user);

    expect(result.overdue).toBe(1);
    expect(repository.summary).toHaveBeenCalledWith('company-a', 'user-1');
  });

  // --- Generacion automatica desde hallazgos ------------------------------------------

  it('createForFinding ignora hallazgos MINOR', async () => {
    const result = await service.createForFinding({
      id: 'finding-1',
      title: 'Menor',
      severity: 'MINOR',
      companyId: 'company-a',
    });

    expect(result).toBeNull();
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('createForFinding genera tarea HIGH para MAJOR y CRITICAL para CRITICAL', async () => {
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.task.create
      .mockResolvedValueOnce({ id: 'task-major', priority: 'HIGH' })
      .mockResolvedValueOnce({ id: 'task-critical', priority: 'CRITICAL' });

    const major = await service.createForFinding({
      id: 'finding-1',
      title: 'Fuga en linea de aire',
      severity: 'MAJOR',
      ownerId: 'user-1',
      companyId: 'company-a',
    });
    const critical = await service.createForFinding({
      id: 'finding-2',
      title: 'Riesgo electrico grave',
      severity: 'CRITICAL',
      companyId: 'company-a',
    });

    expect(major.priority).toBe('HIGH');
    expect(critical.priority).toBe('CRITICAL');
    const firstCreate = (
      prisma.task.create.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >
    )[0][0];
    expect(firstCreate.data).toMatchObject({
      sourceType: 'FINDING',
      sourceId: 'finding-1',
      ownerId: 'user-1',
      priority: 'HIGH',
      companyId: 'company-a',
    });
    // Sin responsable: la tarea queda sin asignar (visible en "mis tareas").
    const secondCreate = (
      prisma.task.create.mock.calls as Array<
        [{ data: Record<string, unknown> }]
      >
    )[1][0];
    expect(secondCreate.data.ownerId).toBeNull();
  });

  it('createForFinding no duplica tareas activas para el mismo hallazgo', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: 'task-existente' });

    const result = await service.createForFinding({
      id: 'finding-1',
      title: 'Fuga en linea de aire',
      severity: 'MAJOR',
      companyId: 'company-a',
    });

    expect(result).toBeNull();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
