import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createContractorsAssistant } from './contractors.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Contratistas (Fase I1, S16 extendido).
 *
 * - Registro: 'contractors' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: docs_expiring cuenta vencidas y recorta con take; entry_flow
 *   agrega por etapa y estado del contratista.
 */
describe('ContractorsAssistant (Fase I1)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const contractorsRepo = {
    findExpiringDocumentsForAssistant: jest.fn(),
    findEntryFlowForAssistant: jest.fn(),
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
      undefined,
      contractorsRepo as never,
    );
  });

  it('registra el asistente contractors junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'contractors',
    ]);
    const contractors = registry.get('contractors');
    expect(contractors?.module).toBe('contractors');
    expect(contractors?.tools.map((tool) => tool.name)).toEqual([
      'docs_expiring',
      'entry_flow_status',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('contractors', 'docs_expiring', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool(
        'contractors',
        'employees_summary',
        adminA,
        auditService,
      ),
    ).rejects.toThrow(/not available for assistant contractors/);
  });

  it('docs_expiring pasa el companyId del ctx y acota take al tope 20', async () => {
    contractorsRepo.findExpiringDocumentsForAssistant.mockResolvedValue([
      {
        documentType: 'ARL',
        status: 'APPROVED',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        contractor: { name: 'Segurimax' },
      },
      {
        documentType: 'SG-SST',
        status: 'APPROVED',
        expiresAt: new Date('2026-10-20T00:00:00Z'),
        contractor: { name: 'Limpiezas SA' },
      },
    ]);
    const { data } = await registry.runTool(
      'contractors',
      'docs_expiring',
      adminA,
      auditService,
      { take: 99 },
    );
    expect(
      contractorsRepo.findExpiringDocumentsForAssistant,
    ).toHaveBeenCalledWith('company-a', 20);
    expect(data).toEqual({
      total: 2,
      expired: 1,
      documents: expect.any(Array) as unknown[],
    });
  });

  it('entry_flow_status agrega por etapa del flujo y estado', async () => {
    contractorsRepo.findEntryFlowForAssistant.mockResolvedValue([
      { entryStatus: 'WORK', status: 'ACTIVE' },
      { entryStatus: 'INDUCTION', status: 'ACTIVE' },
      { entryStatus: 'WORK', status: 'CLOSED' },
    ]);
    const { data } = await registry.runTool(
      'contractors',
      'entry_flow_status',
      adminA,
      auditService,
    );
    expect(contractorsRepo.findEntryFlowForAssistant).toHaveBeenCalledWith(
      'company-a',
    );
    expect(data).toEqual({
      total: 3,
      byEntryStatus: { INDUCTION: 1, WORK: 2 },
      byStatus: { ACTIVE: 2, CLOSED: 1 },
    });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createContractorsAssistant(contractorsRepo as never);
    expect(definition.id).toBe('contractors');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
