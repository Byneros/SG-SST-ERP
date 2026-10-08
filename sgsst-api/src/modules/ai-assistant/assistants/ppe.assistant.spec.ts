import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createPpeAssistant } from './ppe.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de EPP (Fase H3, S16 extendido).
 *
 * - Registro: 'ppe' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, params validados.
 * - Scoping: los repositorios se llaman con el companyId del ToolContext.
 * - Formato: stock_summary separa bajo minimo; expiring_deliveries aplica
 *   tope de 20 y cuenta vencidas.
 */
describe('PpeAssistant (Fase H3)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const ppeRepo = {
    findStockSummary: jest.fn(),
    findExpiringDeliveries: jest.fn(),
  };

  const adminA: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const employeeA: AuthenticatedUser = {
    sub: 'emp-a',
    email: 'emp-a@test.com',
    role: 'EMPLOYEE',
    companyId: 'company-a',
  };

  let registry: AssistantRegistry;
  const PAST = new Date('2026-01-01T00:00:00Z');
  const SOON = new Date(Date.now() + 10 * 24 * 3600 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AssistantRegistry(
      legacyTools as unknown as AiAssistantTools,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ppeRepo,
    );
  });

  it('registra el asistente ppe junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'ppe',
    ]);
    const ppe = registry.get('ppe');
    expect(ppe?.name).toBe('Asistente de EPP');
    expect(ppe?.module).toBe('ppe');
    expect(ppe?.tools.map((tool) => tool.name)).toEqual([
      'stock_summary',
      'expiring_deliveries',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('ppe', 'stock_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas de otros asistentes no invocables', async () => {
    await expect(
      registry.runTool('ppe', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant ppe/);
    await expect(
      registry.runTool('central', 'stock_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant central/);
  });

  it('stock_summary separa items bajo minimo con el companyId del ctx', async () => {
    ppeRepo.findStockSummary.mockResolvedValue([
      {
        id: '1',
        name: 'Guantes',
        type: 'MANOS',
        size: 'M',
        stock: 2,
        stockMin: 10,
      },
      {
        id: '2',
        name: 'Casco',
        type: 'CABEZA',
        size: null,
        stock: 5,
        stockMin: 5,
      },
      {
        id: '3',
        name: 'Gafas',
        type: 'OJOS',
        size: null,
        stock: 20,
        stockMin: 4,
      },
    ]);
    const { data } = await registry.runTool(
      'ppe',
      'stock_summary',
      adminA,
      auditService,
    );
    expect(ppeRepo.findStockSummary).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      belowMinCount: 1,
      belowMin: [
        { name: 'Guantes', type: 'MANOS', size: 'M', stock: 2, stockMin: 10 },
      ],
      byType: { MANOS: 1, CABEZA: 1, OJOS: 1 },
    });
  });

  it('expiring_deliveries aplica tope maximo de 20 y cuenta vencidas', async () => {
    ppeRepo.findExpiringDeliveries.mockResolvedValue([
      {
        id: 'd1',
        quantity: 1,
        deliveredAt: PAST,
        dueReplacementAt: PAST,
        item: { name: 'Guantes', type: 'MANOS' },
        employee: { firstName: 'Ana', lastName: 'Gomez', position: 'Operaria' },
      },
      {
        id: 'd2',
        quantity: 2,
        deliveredAt: PAST,
        dueReplacementAt: SOON,
        item: { name: 'Casco', type: 'CABEZA' },
        employee: { firstName: 'Luis', lastName: '', position: 'Auxiliar' },
      },
    ]);
    const { data } = await registry.runTool(
      'ppe',
      'expiring_deliveries',
      adminA,
      auditService,
      { take: 999 },
    );
    expect(ppeRepo.findExpiringDeliveries).toHaveBeenCalledWith(
      'company-a',
      20,
    );
    const payload = data as {
      total: number;
      overdue: number;
      deliveries: Array<{ employee: string }>;
    };
    expect(payload.total).toBe(2);
    expect(payload.overdue).toBe(1);
    expect(payload.deliveries[0].employee).toBe('Ana Gomez');
    expect(payload.deliveries[1].employee).toBe('Luis');
  });

  it('expiring_deliveries rechaza params invalidos (take no numerico)', async () => {
    await expect(
      registry.runTool('ppe', 'expiring_deliveries', adminA, auditService, {
        take: 'muchos',
      }),
    ).rejects.toThrow(TypeError);
    expect(ppeRepo.findExpiringDeliveries).not.toHaveBeenCalled();
  });

  it('la definicion factory expone solo herramientas READ y roles completos', () => {
    const definition = createPpeAssistant(ppeRepo as never);
    expect(definition.id).toBe('ppe');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
