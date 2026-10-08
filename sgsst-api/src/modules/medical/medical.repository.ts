import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Repositorio de solo lectura de medicina laboral para el asistente IA
 * (Fase H2, S16 extendido).
 *
 * Criterio de fase 1 (restringido): sin datos clinicos ni historia;
 * solo conteos agregados por concepto ocupacional, tipo de examen y
 * estado de casos PVE. Nunca expone EMPLOYEE (el asistente ya lo
 * excluye por allowedRoles, y aqui ademas solo hay agregaciones).
 */
@Injectable()
export class MedicalAssistantRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Examenes ocupacionales agregados por concepto y tipo (sin diagnostico). */
  async examSummary(companyId: string) {
    const exams = await this.prisma.medicalExam.findMany({
      where: { companyId },
      select: { concept: true, examType: true, nextDueAt: true },
    });
    const byConcept: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const now = Date.now();
    let nextDueSoon = 0;
    for (const exam of exams) {
      byConcept[exam.concept] = (byConcept[exam.concept] ?? 0) + 1;
      byType[exam.examType] = (byType[exam.examType] ?? 0) + 1;
      if (
        exam.nextDueAt &&
        new Date(exam.nextDueAt).getTime() >= now &&
        new Date(exam.nextDueAt).getTime() <= now + 30 * 24 * 3600 * 1000
      ) {
        nextDueSoon++;
      }
    }
    return {
      total: exams.length,
      byConcept,
      byType,
      nextDueIn30Days: nextDueSoon,
    };
  }

  /** Vigilancia epidemiologica (PVE): casos por estado y programa. */
  async pveSummary(companyId: string) {
    const cases = await this.prisma.pveCase.findMany({
      where: { companyId },
      select: {
        status: true,
        absenceDays: true,
        nextFollowUpAt: true,
        program: { select: { name: true } },
      },
    });
    const byStatus: Record<string, number> = {};
    const byProgram = new Map<string, number>();
    let absenceDays = 0;
    let withFollowUp = 0;
    for (const pveCase of cases) {
      byStatus[pveCase.status] = (byStatus[pveCase.status] ?? 0) + 1;
      const programName = pveCase.program.name;
      byProgram.set(programName, (byProgram.get(programName) ?? 0) + 1);
      absenceDays += pveCase.absenceDays;
      if (pveCase.nextFollowUpAt) withFollowUp++;
    }
    return {
      total: cases.length,
      byStatus,
      byProgram: Object.fromEntries(byProgram),
      totalAbsenceDays: absenceDays,
      withFollowUpScheduled: withFollowUp,
    };
  }
}
