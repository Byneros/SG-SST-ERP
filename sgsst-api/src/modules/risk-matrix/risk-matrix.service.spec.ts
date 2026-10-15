import { BadRequestException, NotFoundException } from '@nestjs/common';
import { deriveGtcLevel, RiskMatrixService } from './risk-matrix.service';

/**
 * Matriz GTC-45 estructurada (#57):
 * - Derivación del nivel 5x5 (I ≤ 4 · II ≤ 9 · III ≤ 19 · IV ≥ 20).
 * - La valoración vigente re-sincroniza el nivel del riesgo vinculado.
 * - Crear el riesgo exige valoración previa (400) y rechaza duplicado.
 * - Scoping por cadena de padres: recursos de otra empresa → 404.
 */
describe('RiskMatrixService (#57)', () => {
  const auditService = { log: jest.fn() };
  const sitesRepository = { findByIdScoped: jest.fn() };
  const repository = {
    findProcessById: jest.fn(),
    findActivityById: jest.fn(),
    findHazardById: jest.fn(),
    createProcess: jest.fn(),
    upsertValoracion: jest.fn(),
    findRiskByHazardId: jest.fn(),
    updateLinkedRisk: jest.fn(),
    createLinkedRisk: jest.fn(),
    createControl: jest.fn(),
  };

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const companyA = 'company-a';
  const companyB = 'company-b';
  type ServiceInstance = InstanceType<typeof RiskMatrixService>;
  let service: ServiceInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RiskMatrixService(
      repository as never,
      auditService as never,
      sitesRepository as never,
    );
  });

  describe('deriveGtcLevel (matriz 5x5)', () => {
    it.each([
      [1, 1, 'I'],
      [5, 1, 'II'],
      [2, 2, 'I'],
      [2, 3, 'II'],
      [3, 3, 'II'],
      [5, 2, 'III'],
      [4, 5, 'IV'],
      [5, 4, 'IV'],
      [5, 5, 'IV'],
    ] as const)('prob=%i sev=%i -> nivel %s', (prob, sev, expected) => {
      expect(deriveGtcLevel(prob, sev)).toBe(expected);
    });
  });

  describe('upsertValoracion', () => {
    it('deriva el nivel y re-sincroniza el nivel del riesgo vinculado', async () => {
      repository.findHazardById.mockResolvedValue({
        id: 'haz-1',
        activity: { process: { companyId: companyA } },
        valorations: [],
      });
      repository.upsertValoracion.mockResolvedValue({
        id: 'val-1',
        probability: 5,
        severity: 5,
        riskLevel: 'IV',
        hazardId: 'haz-1',
      });
      repository.findRiskByHazardId.mockResolvedValue({
        id: 'risk-1',
        level: 'LOW',
      });
      repository.updateLinkedRisk.mockResolvedValue({
        id: 'risk-1',
        level: 'CRITICAL',
      });

      const result = await service.upsertValoracion(adminA, 'haz-1', {
        probability: 5,
        severity: 5,
      });

      expect(result).toMatchObject({ riskLevel: 'IV', mappedRiskLevel: 'CRITICAL' });
      expect(repository.upsertValoracion).toHaveBeenCalledWith('haz-1', {
        probability: 5,
        severity: 5,
        riskLevel: 'IV',
      });
      expect(repository.updateLinkedRisk).toHaveBeenCalledWith('risk-1', { level: 'CRITICAL' });
      // Traza: la valoración y sincronización del riesgo quedan en AuditLog.
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ entity: 'RiskValoracion' }));
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ entity: 'Risk' }));
    });

    it('el hazard de otra empresa no existe para el actor (404 por cadena de padres)', async () => {
      repository.findHazardById.mockResolvedValue({
        id: 'haz-b',
        activity: { process: { companyId: companyB } },
        valorations: [],
      });
      await expect(
        service.upsertValoracion(adminA, 'haz-b', { probability: 2, severity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createLinkedRisk', () => {
    const hazardWithValoracion = {
      id: 'haz-1',
      name: 'Caída de altura',
      activity: { process: { companyId: companyA } },
      valorations: [{ riskLevel: 'III' }],
    };

    it('crea el riesgo con el nivel derivado de la valoración vigente', async () => {
      repository.findHazardById.mockResolvedValue(hazardWithValoracion);
      repository.findRiskByHazardId.mockResolvedValue(null);
      repository.createLinkedRisk.mockResolvedValue({
        id: 'risk-1',
        title: 'Caída de altura',
        level: 'HIGH',
        hazardId: 'haz-1',
      });

      const risk = await service.createLinkedRisk(adminA, 'haz-1', {});

      expect(repository.createLinkedRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Caída de altura',
          level: 'HIGH',
          hazardId: 'haz-1',
          companyId: companyA,
        } as unknown as Record<string, unknown>),
      );
      // El tenant del riesgo sale del peligro (cadena de padres), no del DTO.
      expect(risk).toMatchObject({ level: 'HIGH' });
    });

    it('sin valoración rechaza con 400 (cerrar la cadena GTC-45 en orden)', async () => {
      repository.findHazardById.mockResolvedValue({
        ...hazardWithValoracion,
        valorations: [],
      });
      await expect(service.createLinkedRisk(adminA, 'haz-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('riel de duplicado: el peligro ya tiene riesgo → 400', async () => {
      repository.findHazardById.mockResolvedValue(hazardWithValoracion);
      repository.findRiskByHazardId.mockResolvedValue({ id: 'risk-existente' });
      await expect(service.createLinkedRisk(adminA, 'haz-1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.createLinkedRisk).not.toHaveBeenCalled();
    });
  });
});
