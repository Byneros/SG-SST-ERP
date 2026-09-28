import { ForbiddenException } from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AiAssistantTools } from './ai-assistant.tools';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

/**
 * Pruebas unitarias de las herramientas del asistente (Sprint 16, tarea 16.6).
 *
 * - El alcance SIEMPRE se resuelve con resolveCompanyScope(): EMPLOYEE queda
 *   fuera y un SUPER_ADMIN sin empresa activa recibe 403.
 * - Cada herramienta consulta SOLO el companyId del actor y mapea los datos
 *   a resumenes compactos (los repositorios ya aplican el scoping por tenant).
 */
describe('AiAssistantTools (scope multi-tenant)', () => {
  const companiesRepository = { findById: jest.fn() };
  const sitesRepository = { findAll: jest.fn() };
  const employeesRepository = { findAll: jest.fn() };
  const risksRepository = { findAll: jest.fn() };
  const incidentsRepository = { findAll: jest.fn() };
  const trainingsRepository = { findAll: jest.fn() };
  let tools: AiAssistantTools;

  const adminA: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const employeeA: AuthenticatedUser = {
    sub: 'employee-a',
    email: 'employee-a@test.com',
    role: 'EMPLOYEE',
    companyId: 'company-a',
  };
  const superAdminSinEmpresa: AuthenticatedUser = {
    sub: 'super-admin',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = new AiAssistantTools(
      companiesRepository as never,
      sitesRepository as never,
      employeesRepository as never,
      risksRepository as never,
      incidentsRepository as never,
      trainingsRepository as never,
    );
  });

  it('EMPLOYEE queda fuera de las herramientas (403) sin consultar repositorios', async () => {
    await expect(tools.run('risks_summary', employeeA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(risksRepository.findAll).not.toHaveBeenCalled();
  });

  it('rechaza 403 cuando no hay empresa activa (SUPER_ADMIN sin activeCompanyId)', async () => {
    await expect(
      tools.run('company_summary', superAdminSinEmpresa),
    ).rejects.toThrow('A company must be selected');
    expect(companiesRepository.findById).not.toHaveBeenCalled();
  });

  it('company_summary devuelve los datos basicos de la empresa del actor', async () => {
    companiesRepository.findById.mockResolvedValue({
      id: 'company-a',
      name: 'Empresa A S.A.S.',
      nit: '900000001-1',
      isActive: true,
    });

    const result = await tools.run('company_summary', adminA);

    expect(companiesRepository.findById).toHaveBeenCalledWith('company-a');
    expect(result).toEqual({
      company: { name: 'Empresa A S.A.S.', nit: '900000001-1', isActive: true },
    });
  });

  it('company_summary tolera empresa no encontrada (company null)', async () => {
    companiesRepository.findById.mockResolvedValue(null);

    const result = await tools.run('company_summary', adminA);

    expect(result).toEqual({ company: null });
  });

  it('sites_summary pagina y mapea datos completos de cada sede', async () => {
    sitesRepository.findAll.mockResolvedValue({
      meta: { total: 5 },
      data: [
        {
          name: 'Sede 1',
          code: 'S1',
          city: 'Bogota',
          department: 'Cundinamarca',
          address: 'Calle 1 #2-03',
          isMain: true,
          _count: { employees: 12 },
        },
        {
          name: 'Sede 2',
          code: 'S2',
          city: null,
          department: null,
          address: null,
          isMain: false,
          _count: undefined,
        },
      ],
    });

    const result = await tools.run('sites_summary', adminA);

    expect(sitesRepository.findAll).toHaveBeenCalledWith('company-a', {
      page: 1,
      pageSize: 20,
    });
    expect(result).toEqual({
      total: 5,
      sites: [
        {
          name: 'Sede 1',
          code: 'S1',
          city: 'Bogota',
          department: 'Cundinamarca',
          address: 'Calle 1 #2-03',
          isMain: true,
          employeesCount: 12,
        },
        {
          name: 'Sede 2',
          code: 'S2',
          city: null,
          department: null,
          address: null,
          isMain: false,
          employeesCount: 0,
        },
      ],
    });
  });

  it('employees_summary mapea nombre, cargo y sede (null si no tiene)', async () => {
    employeesRepository.findAll.mockResolvedValue({
      meta: { total: 2 },
      data: [
        {
          firstName: 'Ana',
          lastName: 'Perez',
          position: 'Operaria',
          site: { name: 'Sede 1' },
        },
        {
          firstName: 'Luis',
          lastName: 'Gomez',
          position: 'Tecnico',
          site: undefined,
        },
      ],
    });

    const result = await tools.run('employees_summary', adminA);

    expect(employeesRepository.findAll).toHaveBeenCalledWith('company-a', {
      page: 1,
      pageSize: 20,
    });
    expect(result).toEqual({
      total: 2,
      employees: [
        { name: 'Ana Perez', position: 'Operaria', site: 'Sede 1' },
        { name: 'Luis Gomez', position: 'Tecnico', site: null },
      ],
    });
  });

  it('risks_summary agrega por nivel y mapea el nombre de la sede (sin siteId crudo)', async () => {
    risksRepository.findAll.mockResolvedValue([
      {
        title: 'R1',
        level: 'MEDIUM',
        siteId: 's1',
        site: { name: 'Sede Norte' },
      },
      { title: 'R2', level: 'HIGH', siteId: null, site: null },
      {
        title: 'R3',
        level: 'MEDIUM',
        siteId: 's2',
        site: { name: 'Sede Sur' },
      },
    ]);

    const result = await tools.run('risks_summary', adminA);

    expect(risksRepository.findAll).toHaveBeenCalledWith('company-a');
    expect(result).toEqual({
      total: 3,
      byLevel: { MEDIUM: 2, HIGH: 1 },
      topRisks: [
        { title: 'R1', level: 'MEDIUM', site: 'Sede Norte' },
        { title: 'R2', level: 'HIGH', site: null },
        { title: 'R3', level: 'MEDIUM', site: 'Sede Sur' },
      ],
    });
  });

  it('incidents_summary agrega por estado y pasa un usuario de contexto sin identidad real', async () => {
    incidentsRepository.findAll.mockResolvedValue([
      { title: 'I1', status: 'OPEN', date: '2026-09-01' },
      { title: 'I2', status: 'CLOSED', date: '2026-09-02' },
    ]);

    const result = await tools.run('incidents_summary', adminA);

    expect(incidentsRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-a' }),
      'company-a',
      expect.any(ListQueryDto),
    );
    expect(result).toEqual({
      total: 2,
      byStatus: { OPEN: 1, CLOSED: 1 },
      recent: [
        { title: 'I1', status: 'OPEN', date: '2026-09-01' },
        { title: 'I2', status: 'CLOSED', date: '2026-09-02' },
      ],
    });
  });

  it('trainings_summary devuelve el total y las recientes', async () => {
    trainingsRepository.findAll.mockResolvedValue([
      { title: 'T1', date: '2026-09-01' },
      { title: 'T2', date: '2026-08-01' },
    ]);

    const result = await tools.run('trainings_summary', adminA);

    expect(trainingsRepository.findAll).toHaveBeenCalledWith('company-a');
    expect(result).toEqual({
      total: 2,
      recent: [
        { title: 'T1', date: '2026-09-01' },
        { title: 'T2', date: '2026-08-01' },
      ],
    });
  });
});
