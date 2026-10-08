import {
  AiAssistantOrchestrator,
  routeAssistants,
  selectTools,
} from './ai-assistant.orchestrator';
import { AssistantRegistry } from './assistant-registry';
import { AiAssistantTools } from './ai-assistant.tools';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

/**
 * Pruebas del orquestador (Fase K, S16 extendido).
 *
 * - Router determinista: keywords + score, sin LLM; elige varios asistentes
 *   por dominio y respeta el tope de 4 por consulta.
 * - Seguridad: un asistente con match pero fuera del rol se omite y se
 *   declara (sin fugar la existencia del modulo).
 * - selectTools: maximo 2 herramientas por asistente; si no hay coincidencia
 *   elige la primera (resumen general).
 * - orchestrate: ejecuta herramientas con el ctx resuelto en backend y
 *   produce el prompt de sintesis etiquetado por modulo.
 */
describe('AiAssistantOrchestrator (Fase K)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as never;
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };

  const risksRepo = {
    findAll: jest
      .fn()
      .mockResolvedValue([{ level: 'HIGH', site: { name: 'Sede 1' } }]),
    findWithoutCorrectiveAction: jest.fn().mockResolvedValue([]),
    findOldest: jest.fn().mockResolvedValue([]),
  };
  const incidentsRepo = {
    findAllForAssistant: jest
      .fn()
      .mockResolvedValue([
        { title: 'a', description: 'x', date: new Date(), status: 'PENDING' },
      ]),
  };
  const unsafeReportsRepo = { findAll: jest.fn().mockResolvedValue([]) };
  const findingsRepo = {
    findOpenForAssistant: jest.fn().mockResolvedValue([]),
    findRepeatOwners: jest.fn().mockResolvedValue([]),
  };
  const actionPlansRepo = {
    findOverdueForAssistant: jest.fn().mockResolvedValue([]),
    countForFindingsAsistente: jest.fn().mockResolvedValue({ findings: [] }),
  };
  const trainingsRepo = {
    findAllForAssistant: jest.fn().mockResolvedValue([]),
  };
  const medicalRepo = {
    examSummary: jest
      .fn()
      .mockResolvedValue({ total: 2, byConcept: { APTO: 2 } }),
    pveSummary: jest.fn().mockResolvedValue({ total: 0 }),
  };
  const ppeRepo = {
    findStockSummary: jest
      .fn()
      .mockResolvedValue([
        { name: 'Guantes', stock: 2, stockMin: 10, type: 'MANOS', size: 'M' },
      ]),
    findExpiringDeliveries: jest.fn().mockResolvedValue([]),
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
      risksRepo as never,
      incidentsRepo as never,
      unsafeReportsRepo as never,
      findingsRepo as never,
      actionPlansRepo as never,
      trainingsRepo,
      medicalRepo,
      ppeRepo,
    );
  });

  it('routeAssistants elige riesgos e incidentes por keywords', () => {
    const { chosen, omitted } = routeAssistants(
      'resumen de riesgos criticos e incidentes del mes',
      registry,
      adminA,
    );
    expect(chosen.map((assistant) => assistant.id)).toEqual(
      expect.arrayContaining(['risks', 'incidents']),
    );
    expect(omitted).toEqual([]);
  });

  it('routeAssistants omite y declara asistentes sin permiso para el rol', () => {
    const { chosen, omitted } = routeAssistants(
      'riesgos y examenes ocupacionales',
      registry,
      // EMPLOYEE no tiene acceso a ningun asistente especializado.
      employeeA,
    );
    expect(chosen).toEqual([]);
    expect(omitted).toEqual(expect.arrayContaining(['risks', 'medical']));
  });

  it('routeAssistants respeta el tope de 4 asistentes por consulta', () => {
    const { chosen } = routeAssistants(
      'riesgos incidentes hallazgos capacitaciones examenes ocupacionales epp',
      registry,
      adminA,
    );
    expect(chosen.length).toBeLessThanOrEqual(4);
  });

  it('routeAssistants ignora mensajes sin keywords de dominio', () => {
    const { chosen } = routeAssistants(
      'como creo un usuario en el sistema',
      registry,
      adminA,
    );
    expect(chosen).toEqual([]);
  });

  it('selectTools elige maximo 2 herramientas y sin match usa la primera', () => {
    const risks = registry.get('risks')!;
    const picked = selectTools(risks, 'riesgos criticos sin acciones');
    expect(picked.length).toBeLessThanOrEqual(2);
    expect(picked).toContain('critical_without_actions');

    const fallback = selectTools(risks, 'cualquier cosa sin dominio');
    // Fallback determinista: la primera herramienta del asistente, y solo
    // esa (sin match no se agregan otras por ranking vacio).
    expect(fallback[0]).toBe('matrix_summary');
    expect(fallback.length).toBe(1);
  });

  it('orchestrate ejecuta herramientas de varios asistentes y arma el prompt', async () => {
    const orchestrator = new AiAssistantOrchestrator(registry);
    const outcome = await orchestrator.orchestrate(
      adminA,
      { message: 'riesgos criticos e incidentes reportados' },
      auditService,
    );
    expect(outcome.kind).toBe('OK');
    if (outcome.kind !== 'OK') return;
    const assistants = outcome.routedTools.map((tool) => tool.assistantId);
    expect(assistants).toContain('risks');
    expect(assistants).toContain('incidents');
    expect(outcome.dataPrompt).toContain('DATOS RISKS');
    expect(outcome.dataPrompt).toContain('DATOS INCIDENTS');
    expect(risksRepo.findAll).toHaveBeenCalledWith('company-a');
    expect(incidentsRepo.findAllForAssistant).toHaveBeenCalledWith('company-a');
  });

  it('orchestrate devuelve NO_MATCH sin keywords de dominio', async () => {
    const orchestrator = new AiAssistantOrchestrator(registry);
    const outcome = await orchestrator.orchestrate(
      adminA,
      { message: 'hola, quien eres?' },
      auditService,
    );
    expect(outcome.kind).toBe('NO_MATCH');
    expect(risksRepo.findAll).not.toHaveBeenCalled();
  });

  it('selectTools nunca devuelve herramientas de otro asistente', () => {
    const ppe = registry.get('ppe')!;
    const picked = selectTools(ppe, 'inventario epp y entregas');
    const ppeToolNames = ppe.tools.map((tool) => tool.name);
    for (const name of picked) {
      expect(ppeToolNames).toContain(name);
    }
  });
});
