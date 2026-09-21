import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AddEvaluationItemsDto } from './dto/add-evaluation-items.dto';
import { CreateSgsstEvaluationDto } from './dto/create-sgsst-evaluation.dto';
import { UpdateEvaluationItemDto } from './dto/update-evaluation-item.dto';
import { UpdateSgsstEvaluationDto } from './dto/update-sgsst-evaluation.dto';

const evaluationInclude = {
  company: { select: { id: true, name: true, nit: true } },
  items: {
    orderBy: [
      { section: 'asc' as const },
      { numeral: 'asc' as const },
      { createdAt: 'asc' as const },
    ],
  },
} satisfies Prisma.SgsstEvaluationInclude;

@Injectable()
export class SgsstEvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: ListQueryDto,
    companyId?: string,
  ) {
    const scope = this.companyScope.resolveCompanyId(user, companyId);

    if (!scope) {
      return {
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.SgsstEvaluationWhereInput = {
      companyId: scope,
      isActive: query.isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { period: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sgsstEvaluation.findMany({
        where,
        include: evaluationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sgsstEvaluation.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const evaluation = await this.prisma.sgsstEvaluation.findUnique({
      where: { id },
      include: evaluationInclude,
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    // Aislamiento: la evaluación de otra empresa no existe para el actor (404).
    if (evaluation.companyId !== this.companyScope.resolveCompanyId(user)) {
      throw new NotFoundException('Evaluation not found');
    }

    this.companyScope.validate(user, evaluation.companyId);

    return evaluation;
  }

  async create(user: AuthenticatedUser, dto: CreateSgsstEvaluationDto) {
    const companyId = this.companyScope.resolveCompanyId(user, dto.companyId);

    if (!companyId) {
      throw new NotFoundException('Company ID is required');
    }

    return this.prisma.sgsstEvaluation.create({
      data: {
        name: dto.name,
        standard: dto.standard ?? 'RES_0312_2019',
        riskClass: dto.riskClass,
        period: dto.period,
        notes: dto.notes,
        companyId,
        items: dto.items?.length
          ? {
              create: dto.items.map((item) => ({
                numeral: item.numeral,
                section: item.section,
                question: item.question,
                maxScore: item.maxScore ?? 0,
              })),
            }
          : undefined,
      },
      include: evaluationInclude,
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateSgsstEvaluationDto,
  ) {
    await this.findOne(user, id);

    const data: Prisma.SgsstEvaluationUncheckedUpdateInput = {
      name: dto.name,
      standard: dto.standard,
      riskClass: dto.riskClass,
      period: dto.period,
      status: dto.status as never,
      notes: dto.notes,
      deletedAt:
        dto.isActive === undefined
          ? undefined
          : dto.isActive
            ? null
            : new Date(),
    };

    const updated = await this.prisma.sgsstEvaluation.update({
      where: { id },
      data,
      include: evaluationInclude,
    });

    return this.recalculate(updated.id);
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.findOne(user, id);

    await this.prisma.sgsstEvaluation.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    return { id, deleted: true };
  }

  /** Agrega items a una evaluación existente. */
  async addItems(
    user: AuthenticatedUser,
    id: string,
    dto: AddEvaluationItemsDto,
  ) {
    await this.findOne(user, id);

    await this.prisma.evaluationItem.createMany({
      data: dto.items.map((item) => ({
        evaluationId: id,
        numeral: item.numeral,
        section: item.section,
        question: item.question,
        maxScore: item.maxScore ?? 0,
      })),
    });

    return this.findOne(user, id);
  }

  /** Responde un item y recalcula el cumplimiento total de la evaluación. */
  async updateItem(
    user: AuthenticatedUser,
    itemId: string,
    dto: UpdateEvaluationItemDto,
  ) {
    const item = await this.prisma.evaluationItem.findUnique({
      where: { id: itemId },
      include: { evaluation: { select: { id: true, companyId: true } } },
    });

    if (!item) {
      throw new NotFoundException('Evaluation item not found');
    }

    // Aislamiento: el item de otra empresa no existe para el actor (404).
    if (
      item.evaluation.companyId !== this.companyScope.resolveCompanyId(user)
    ) {
      throw new NotFoundException('Evaluation item not found');
    }

    this.companyScope.validate(user, item.evaluation.companyId);

    const status = dto.status ?? item.status;
    const maxScore = item.maxScore;
    let score = dto.score !== undefined ? dto.score : item.score;

    if (status === 'COMPLIANT') {
      score = maxScore;
    } else if (status === 'NOT_APPLICABLE') {
      score = null;
    } else if (status === 'NON_COMPLIANT') {
      score = 0;
    }

    await this.prisma.evaluationItem.update({
      where: { id: itemId },
      data: { status: status as never, score, notes: dto.notes },
    });

    return this.recalculate(item.evaluation.id);
  }

  /** Recalcula score/maxScore/compliancePercent y cierra la evaluación si corresponde. */
  private async recalculate(evaluationId: string) {
    const evaluation = await this.prisma.sgsstEvaluation.findUnique({
      where: { id: evaluationId },
      include: evaluationInclude,
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    const applicable = evaluation.items.filter(
      (item) => item.status !== 'NOT_APPLICABLE' && item.status !== 'PENDING',
    );
    const maxScore = applicable.reduce(
      (sum, item) => sum + (item.maxScore ?? 0),
      0,
    );
    const score = applicable.reduce((sum, item) => sum + (item.score ?? 0), 0);
    const pending = evaluation.items.filter(
      (item) => item.status === 'PENDING',
    ).length;
    const compliancePercent =
      maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : null;

    return this.prisma.sgsstEvaluation.update({
      where: { id: evaluationId },
      data: {
        score,
        maxScore,
        compliancePercent,
        status:
          pending === 0 && evaluation.items.length > 0
            ? 'COMPLETED'
            : 'IN_PROGRESS',
      },
      include: evaluationInclude,
    });
  }
}
