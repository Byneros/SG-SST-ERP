import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTrainingDto } from './dto/update-training.dto';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateTrainingDto } from './dto/create-training.dto';
import { TrainingsRepository } from './trainings.repository';
import { SitesRepository } from '../sites/sites.repository';
import { DocumentsRepository } from '../documents/documents.repository';
import type {
  CreateTrainingAttendeeDto,
  UpdateTrainingAttendeeDto,
} from './dto/training-attendee.dto';
import type { TrainingAttendeeCreateData } from './trainings.repository';

/** Máximo de asistentes por capacitación (regla de negocio #58). */
const MAX_ATTENDEES = 200;

@Injectable()
export class TrainingsService {
  constructor(
    private readonly trainingsRepository: TrainingsRepository,
    private readonly sitesRepository: SitesRepository,
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: una capacitación de otra empresa no existe para el actor.
    const training = await this.trainingsRepository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!training) {
      throw new NotFoundException('Training not found');
    }
    assertCompanyScope(currentUser, training.companyId);
    return training;
  }

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** La sede debe existir y pertenecer a la empresa del scope. */
  private async assertSiteInScope(siteId: string, companyId: string) {
    const site = await this.sitesRepository.findByIdScoped(siteId, companyId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  /** La evidencia documental debe ser un documento de la empresa (#58). */
  private async assertEvidenceInScope(evidenceId: string, companyId: string) {
    const doc = await this.documentsRepository.findByIdScoped(
      evidenceId,
      companyId,
    );
    if (!doc) {
      throw new NotFoundException('Evidence document not found');
    }
  }

  /** Vencimiento derivado: fecha + vigencia (meses de 30 días). */
  private deriveExpiry(from: Date, validityMonths: number): Date {
    return new Date(from.getTime() + validityMonths * 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Normaliza un asistente (#58): nombre/employee y evidencia en scope.
   * El vencimiento se calcula al PASAR (status PASSED) si falta
   * (fecha de la capacitación + validityMonths).
   */
  private resolveAttendeeExpiry(
    dto: { expiresAt?: string | null; status?: string },
    trainingDate: Date,
    validityMonths?: number | null,
  ): Date | null {
    if (dto.expiresAt) {
      return new Date(dto.expiresAt);
    }
    if (dto.status === 'PASSED' && validityMonths) {
      return this.deriveExpiry(trainingDate, validityMonths);
    }
    return null;
  }

  /**
   * Validaciones de negocio para asistentes inline y por endpoint.
   * Devuelve los nombres de los empleados resueltos (para congelar el nombre
   * del asistente cuando el DTO no lo trae).
   */
  private async validateAttendeeInputs(
    attendees: CreateTrainingAttendeeDto[],
    companyId: string,
  ): Promise<Map<string, string>> {
    if (attendees.length > MAX_ATTENDEES) {
      throw new BadRequestException(
        `Máximo ${MAX_ATTENDEES} asistentes por capacitación`,
      );
    }
    const employeeNames = new Map<string, string>();
    for (const a of attendees) {
      if (!a.employeeId && !a.name) {
        throw new BadRequestException(
          'Cada asistente requiere employeeId o name',
        );
      }
      let name = a.name;
      if (a.employeeId) {
        const employee = await this.trainingsRepository.findEmployeeScoped(
          a.employeeId,
          companyId,
        );
        if (!employee) {
          throw new NotFoundException('Employee not found');
        }
        const fullName = `${employee.firstName} ${employee.lastName}`.trim();
        employeeNames.set(a.employeeId, fullName);
        if (!name) {
          name = fullName;
        }
      }
      if (!name || name === `employee:${a.employeeId}`) {
        throw new BadRequestException(
          'Cada asistente requiere employeeId o name',
        );
      }
      if (a.evidenceId) {
        await this.assertEvidenceInScope(a.evidenceId, companyId);
      }
    }
    return employeeNames;
  }

  /** Nombre congelable del trabajador (scope por empresa). */
  private async resolveEmployeeName(
    employeeId?: string | null,
    companyId?: string,
  ): Promise<string | null> {
    if (!employeeId || !companyId) {
      return null;
    }
    const employee = await this.trainingsRepository.findEmployeeScoped(
      employeeId,
      companyId,
    );
    return employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : null;
  }

  async findAll(
    currentUser: AuthenticatedUser,
    companyId?: string,
    siteId?: string,
  ) {
    const scopedCompanyId = this.resolveCompanyId(currentUser, companyId);
    // Filtro por sede: una sede ajena no existe para el actor (404).
    if (siteId && siteId !== 'none') {
      await this.assertSiteInScope(siteId, scopedCompanyId);
    }
    return this.trainingsRepository.findAll(scopedCompanyId, siteId);
  }

  async create(currentUser: AuthenticatedUser, dto: CreateTrainingDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    // La sede debe ser de la empresa de la capacitacion.
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    const trainingDate = new Date(dto.date);
    // #58: asistentes inline con validaciones de negocio.
    const { attendees, ...trainingDto } = dto;
    let processed: TrainingAttendeeCreateData[] | undefined;
    if (attendees?.length) {
      const employeeNames = await this.validateAttendeeInputs(
        attendees,
        companyId,
      );
      processed = attendees.map((a) => ({
        employeeId: a.employeeId,
        name: a.name ?? employeeNames.get(a.employeeId!) ?? 'Sin nombre',
        score: a.score,
        status: a.status,
        expiresAt: this.resolveAttendeeExpiry(
          a,
          trainingDate,
          dto.validityMonths,
        ),
        evidenceId: a.evidenceId,
        notes: a.notes,
      }));
    }
    return this.trainingsRepository.create(trainingDto, companyId, processed);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateTrainingDto,
  ) {
    await this.findOne(currentUser, id);
    // Sede del update: de la misma empresa; null desasigna; undefined no toca.
    if (dto.siteId !== undefined && dto.siteId !== null) {
      await this.assertSiteInScope(
        dto.siteId,
        this.resolveCompanyId(currentUser),
      );
    }
    // Update restrictivo por empresa (defensa en profundidad).
    const updated = await this.trainingsRepository.updateScoped(
      id,
      this.resolveCompanyId(currentUser),
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Training not found');
    }
    return updated;
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    await this.findOne(currentUser, id);
    const removed = await this.trainingsRepository.removeScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!removed) {
      throw new NotFoundException('Training not found');
    }
    return { success: true };
  }

  //----- asistentes (#58) -----------------------------------------------------

  async createAttendee(
    currentUser: AuthenticatedUser,
    trainingId: string,
    dto: CreateTrainingAttendeeDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const training = await this.trainingsRepository.findByIdScoped(
      trainingId,
      companyId,
    );
    if (!training) {
      throw new NotFoundException('Training not found');
    }
    if (training.attendees.length >= MAX_ATTENDEES) {
      throw new BadRequestException(
        `Máximo ${MAX_ATTENDEES} asistentes por capacitación`,
      );
    }
    await this.validateAttendeeInputs([dto], companyId);
    return this.trainingsRepository.createAttendee(trainingId, {
      employeeId: dto.employeeId ?? null,
      name:
        dto.name ??
        (await this.resolveEmployeeName(dto.employeeId, companyId)) ??
        'Sin nombre',
      score: dto.score,
      status: dto.status,
      expiresAt: this.resolveAttendeeExpiry(
        dto,
        training.date,
        training.validityMonths,
      ),
      evidenceId: dto.evidenceId,
      notes: dto.notes,
    });
  }

  async updateAttendee(
    currentUser: AuthenticatedUser,
    attendeeId: string,
    dto: UpdateTrainingAttendeeDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const attendee = await this.trainingsRepository.findAttendeeScoped(
      attendeeId,
      companyId,
    );
    if (!attendee) {
      throw new NotFoundException('Training attendee not found');
    }
    if (dto.evidenceId) {
      await this.assertEvidenceInScope(dto.evidenceId, companyId);
    }
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : // Al aprobar la evaluación se deriva el vencimiento si falta
          // (fecha de la capacitación + vigencia del certificado).
          dto.status === 'PASSED' && attendee.training.validityMonths
          ? this.deriveExpiry(attendee.training.date, attendee.training.validityMonths)
          : undefined;
    const updated = await this.trainingsRepository.updateAttendee(attendeeId, {
      ...(dto.score !== undefined ? { score: dto.score } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(dto.evidenceId !== undefined ? { evidenceId: dto.evidenceId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
    return updated;
  }

  async removeAttendee(currentUser: AuthenticatedUser, attendeeId: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const attendee = await this.trainingsRepository.findAttendeeScoped(
      attendeeId,
      companyId,
    );
    if (!attendee) {
      throw new NotFoundException('Training attendee not found');
    }
    await this.trainingsRepository.removeAttendee(attendeeId);
    return { id: attendeeId, deleted: true };
  }

  /**
   * Dashboard de vencimientos (#58): resumen vencidos/próximos 30 días y
   * detalle de certificados por vencer, scoped por empresa.
   */
  async expirations(
    currentUser: AuthenticatedUser,
    windowDays: number,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const now = new Date();
    const soon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const [expired, expiringSoon] =
      await this.trainingsRepository.countAttendeeExpirationBuckets(
        companyId,
        now,
        soon,
      );
    const items = await this.trainingsRepository.findExpiringAttendees(
      companyId,
      now,
      soon,
    );
    return {
      windowDays,
      summary: { expired, expiringSoon },
      items,
    };
  }
}
