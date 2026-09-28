import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { CompaniesRepository } from '../companies/companies.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { SitesRepository } from '../sites/sites.repository';
import { RisksRepository } from '../risks/risks.repository';
import { IncidentsRepository } from '../incidents/incidents.repository';
import { TrainingsRepository } from '../trainings/trainings.repository';

/**
 * Herramientas del asistente (fase 1 del Sprint 16).
 *
 * Reglas:
 * - El alcance SIEMPRE se resuelve en backend con resolveCompanyScope();
 *   el cliente no puede influir en el companyId consultado.
 * - Los datos salen de repositorios existentes (mismas reglas que la UI/API),
 *   nunca de SQL arbitrario generado por el modelo.
 * - Medicina laboral y documentos quedan EXCLUIDOS en esta fase (datos
 *   sensibles / permisos granulares pendientes de revision).
 */
export type AssistantToolName =
  | 'company_summary'
  | 'sites_summary'
  | 'employees_summary'
  | 'risks_summary'
  | 'incidents_summary'
  | 'trainings_summary';

@Injectable()
export class AiAssistantTools {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly sitesRepository: SitesRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly risksRepository: RisksRepository,
    private readonly incidentsRepository: IncidentsRepository,
    private readonly trainingsRepository: TrainingsRepository,
  ) {}

  /** Ejecuta una herramienta autorizada para el usuario autenticado. */
  async run(
    tool: AssistantToolName,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    if (user.role === 'EMPLOYEE') {
      // EMPLOYEE podria recibir resumenes propios mas adelante, pero en la
      // fase 1 el asistente queda limitado a roles con permisos de lectura.
      throw new ForbiddenException(
        'Assistant data tools are not available for this role yet',
      );
    }
    // Fuente unica de verdad del tenant (403 si no hay empresa activa).
    const companyId = resolveCompanyScope(user);

    switch (tool) {
      case 'company_summary':
        return this.companySummary(companyId);
      case 'sites_summary':
        return this.sitesSummary(companyId);
      case 'employees_summary':
        return this.employeesSummary(companyId);
      case 'risks_summary':
        return this.risksSummary(companyId);
      case 'incidents_summary':
        return this.incidentsSummary(companyId);
      case 'trainings_summary':
        return this.trainingsSummary(companyId);
      default: {
        const exhaustive: never = tool;
        throw new ForbiddenException(`Unknown tool: ${String(exhaustive)}`);
      }
    }
  }

  private async companySummary(companyId: string) {
    const company = await this.companiesRepository.findById(companyId);
    return {
      company: company
        ? { name: company.name, nit: company.nit, isActive: company.isActive }
        : null,
    };
  }

  private async sitesSummary(companyId: string) {
    const result = await this.sitesRepository.findAll(companyId, {
      page: 1,
      pageSize: 20,
    });
    return {
      total: result.meta.total,
      sites: result.data.map((site) => ({
        name: site.name,
        code: site.code,
        city: site.city,
        employeesCount: site._count?.employees ?? 0,
      })),
    };
  }

  private async employeesSummary(companyId: string) {
    const result = await this.employeesRepository.findAll(companyId, {
      page: 1,
      pageSize: 20,
    });
    return {
      total: result.meta.total,
      employees: result.data.map((employee) => ({
        name: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        site: employee.site?.name ?? null,
      })),
    };
  }

  private async risksSummary(companyId: string) {
    const risks = await this.risksRepository.findAll(companyId);
    const byLevel = risks.reduce<Record<string, number>>((acc, risk) => {
      acc[risk.level] = (acc[risk.level] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: risks.length,
      byLevel,
      topRisks: risks.slice(0, 10).map((risk) => ({
        title: risk.title,
        level: risk.level,
        // Nombre de sede legible; nunca identificadores crudos al modelo.
        site: risk.site?.name ?? null,
      })),
    };
  }

  private async incidentsSummary(companyId: string) {
    const incidents = await this.incidentsRepository.findAll(
      // El repositorio solo usa el usuario para logging contextual; el scope
      // ya viene resuelto por resolveCompanyScope en run().
      { sub: '', email: '', role: '', companyId },
      companyId,
      new ListQueryDto(),
    );
    const byStatus = incidents.reduce<Record<string, number>>(
      (acc, incident) => {
        acc[incident.status] = (acc[incident.status] ?? 0) + 1;
        return acc;
      },
      {},
    );
    return {
      total: incidents.length,
      byStatus,
      recent: incidents.slice(0, 10).map((incident) => ({
        title: incident.title,
        status: incident.status,
        date: incident.date,
      })),
    };
  }

  private async trainingsSummary(companyId: string) {
    const trainings = await this.trainingsRepository.findAll(companyId);
    return {
      total: trainings.length,
      recent: trainings.slice(0, 10).map((training) => ({
        title: training.title,
        date: training.date,
      })),
    };
  }
}
