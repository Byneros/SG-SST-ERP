import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PpeService } from './ppe.service';

/**
 * S9.4: EPP.
 * - Entrega atomica: descuenta stock; 400 si el stock es insuficiente.
 * - Reposicion programada segun la vida util del item.
 * - Trabajador de otra empresa -> 404 cross-tenant.
 * - Hard delete del catalogo con traza (ADR).
 */
describe('PpeService', () => {
  const repository = {
    findItems: jest.fn(),
    findItemByIdScoped: jest.fn(),
    createItem: jest.fn(),
    updateItemScoped: jest.fn(),
    removeItemScoped: jest.fn(),
    findDeliveries: jest.fn(),
    findDeliveryByIdScoped: jest.fn(),
    createDeliveryAtomically: jest.fn(),
    findEmployeeDeliveries: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const prisma = {
    employee: { findFirst: jest.fn() },
  };
  let service: PpeService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const itemA = {
    id: 'item-1',
    name: 'Arnes altura',
    usefulLifeDays: 365,
    stock: 10,
    stockMin: 3,
    companyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PpeService(
      repository as never,
      prisma as never,
      auditService as never,
    );
  });

  it('createDelivery entrega con stock suficiente y devuelve el stock restante', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    repository.findItemByIdScoped.mockResolvedValue(itemA);
    repository.createDeliveryAtomically.mockResolvedValue({
      delivery: { id: 'd-1', quantity: 2 },
      itemStock: 8,
      belowMin: false,
    });

    const result = await service.createDelivery(adminA, {
      itemId: 'item-1',
      employeeId: 'emp-1',
      quantity: 2,
      companyId: 'company-a',
    });

    expect(result.itemStock).toBe(8);
    expect(result.stockBelowMin).toBe(false);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'PpeDelivery',
        entityId: 'd-1',
      }),
    );
  });

  it('createDelivery rechaza con 400 cuando el stock es insuficiente', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    repository.findItemByIdScoped.mockResolvedValue(itemA);
    repository.createDeliveryAtomically.mockResolvedValue({
      error: 'INSUFFICIENT_STOCK',
      stock: 1,
    });

    await expect(
      service.createDelivery(adminA, {
        itemId: 'item-1',
        employeeId: 'emp-1',
        quantity: 5,
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('createDelivery devuelve 404 si el item es de otra empresa', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    repository.findItemByIdScoped.mockResolvedValue(null);
    repository.createDeliveryAtomically.mockResolvedValue({
      error: 'ITEM_NOT_FOUND',
    });

    await expect(
      service.createDelivery(adminA, {
        itemId: 'item-b',
        employeeId: 'emp-1',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('programa la reposicion segun la vida util del item (365 dias)', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    repository.findItemByIdScoped.mockResolvedValue(itemA);
    repository.createDeliveryAtomically.mockResolvedValue({
      delivery: { id: 'd-2' },
      itemStock: 9,
      belowMin: false,
    });

    await service.createDelivery(adminA, {
      itemId: 'item-1',
      employeeId: 'emp-1',
      companyId: 'company-a',
    });

    const dueReplacementAt = (
      repository.createDeliveryAtomically.mock.calls as unknown as Array<
        [unknown, unknown, Date]
      >
    )[0][2];
    const expected = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(dueReplacementAt).not.toBeNull();
    // Tolerancia de un minuto por el desfase de ejecucion.
    expect(
      Math.abs(dueReplacementAt.getTime() - expected.getTime()),
    ).toBeLessThan(60 * 1000);
  });

  it('rechaza la entrega a un trabajador de otra empresa con 404', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createDelivery(adminA, {
        itemId: 'item-1',
        employeeId: 'emp-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createDeliveryAtomically).not.toHaveBeenCalled();
  });

  it('removeItem borra fisicamente con traza DELETE (ADR)', async () => {
    repository.findItemByIdScoped.mockResolvedValue(itemA);
    repository.removeItemScoped.mockResolvedValue(itemA);

    await expect(service.removeItem(adminA, 'item-1')).resolves.toEqual({
      id: 'item-1',
      deleted: true,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'PpeItem',
        before: itemA,
      }),
    );
  });
});
