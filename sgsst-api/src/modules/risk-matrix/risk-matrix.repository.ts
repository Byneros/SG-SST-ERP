import { Injectable } from '@nestjs/common';
import {
  HazardControlSource,
  HazardType,
  RiskGtcLevel,
  RiskLevel,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Repositorio de la matriz GTC-45 (#57). El alcance multi-tenant vive en
 *  RiskProcess (companyId); los hijos se acotan vía la cadena de padres. */
@Injectable()
export class RiskMatrixRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProcessById(id: string) {
    return this.prisma.riskProcess.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  findActivityById(id: string) {
    return this.prisma.riskActivity.findUnique({
      where: { id },
      include: { process: { select: { id: true, companyId: true } } },
    });
  }

  findHazardById(id: string) {
    return this.prisma.riskHazard.findUnique({
      where: { id },
      include: {
        activity: { select: { id: true, process: { select: { companyId: true } } } },
        valorations: true,
        controls: true,
      },
    });
  }

  findCompanyTree(companyId: string) {
    return this.prisma.riskProcess.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      include: {
        activities: {
          orderBy: { createdAt: 'asc' },
          include: {
            hazards: {
              orderBy: { createdAt: 'asc' },
              include: {
                valorations: true,
                controls: true,
                risk: { select: { id: true, title: true, level: true } },
              },
            },
          },
        },
      },
    });
  }

  //----- procesos -------------------------------------------------------------
  createProcess(data: { name: string; description: string | null; companyId: string }) {
    return this.prisma.riskProcess.create({ data });
  }

  updateProcess(id: string, data: { name?: string; description?: string | null }) {
    return this.prisma.riskProcess.update({ where: { id }, data });
  }

  deleteProcess(id: string) {
    return this.prisma.riskProcess.delete({ where: { id } });
  }

 //----- actividades ----------------------------------------------------------
  createActivity(data: { name: string; description: string | null; processId: string }) {
    return this.prisma.riskActivity.create({ data });
  }

  updateActivity(id: string, data: { name?: string; description?: string | null }) {
    return this.prisma.riskActivity.update({ where: { id }, data });
  }

  deleteActivity(id: string) {
    return this.prisma.riskActivity.delete({ where: { id } });
  }

  //----- peligros -------------------------------------------------------------
  createHazard(data: {
    name: string;
    hazardType: HazardType;
    activityId: string;
  }) {
    return this.prisma.riskHazard.create({ data });
  }

  updateHazard(id: string, data: { name?: string; hazardType?: HazardType }) {
    return this.prisma.riskHazard.update({ where: { id }, data });
  }

  deleteHazard(id: string) {
    return this.prisma.riskHazard.delete({ where: { id } });
  }

  //----- valoración (1:1 por peligro) ---------------------------------------
  upsertValoracion(
    hazardId: string,
    data: { probability: number; severity: number; riskLevel: RiskGtcLevel },
  ) {
    return this.prisma.riskValoracion.upsert({
      where: { hazardId },
      update: {
        probability: data.probability,
        severity: data.severity,
        riskLevel: data.riskLevel,
      },
      create: {
        hazardId,
        probability: data.probability,
        severity: data.severity,
        riskLevel: data.riskLevel,
      },
    });
  }

  //----- controles -----------------------------------------------------------
  createControl(data: {
    source: HazardControlSource;
    type: string | null;
    effectiveness: string | null;
    hazardId: string;
  }) {
    return this.prisma.hazardControl.create({ data });
  }

  findControlById(id: string) {
    return this.prisma.hazardControl.findUnique({
      where: { id },
      include: { hazard: { select: { activity: { select: { process: { select: { companyId: true } } } } } } },
    });
  }

  updateControl(
    id: string,
    data: {
      source?: HazardControlSource;
      type?: string | null;
      effectiveness?: string | null;
    },
  ) {
    return this.prisma.hazardControl.update({ where: { id }, data });
  }

  deleteControl(id: string) {
    return this.prisma.hazardControl.delete({ where: { id } });
  }

  //----- riesgo vinculado (resultado final) ---------------------------------
  findRiskByHazardId(hazardId: string) {
    return this.prisma.risk.findUnique({ where: { hazardId } });
  }

  createLinkedRisk(data: {
    title: string;
    description: string | null;
    level: RiskLevel;
    hazardId: string;
    companyId: string;
    siteId: string | null;
  }) {
    return this.prisma.risk.create({ data });
  }

  updateLinkedRisk(riskId: string, data: { level: RiskLevel }) {
    return this.prisma.risk.update({ where: { id: riskId }, data });
  }
}
