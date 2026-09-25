import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { PpeRepository } from './ppe.repository';
import type {
  CreatePpeDeliveryDto,
  CreatePpeItemDto,
  UpdatePpeItemDto,
} from './dto/ppe.dto';

type DeliveryResult = Awaited<
  ReturnType<PpeRepository['createDeliveryAtomically']>
>;

@Injectable()
export class PpeService {
  constructor(
    private readonly repository: PpeRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Catalogo -------------------------------------------------------------

  async findItems(currentUser: AuthenticatedUser, includeInactive?: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const canSeeInactive =
      currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN';
    return this.repository.findItems(
      companyId,
      includeInactive === 'true' && canSeeInactive,
    );
  }

  async findItem(currentUser: AuthenticatedUser, id: string) {
    const item = await this.repository.findItemByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!item) {
      throw new NotFoundException('PPE item not found');
    }
    return item;
  }

  async createItem(currentUser: AuthenticatedUser, dto: CreatePpeItemDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    const item = await this.repository.createItem(dto, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'PpeItem',
      entityId: item.id,
      after: item,
    });

    return item;
  }

  async updateItem(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdatePpeItemDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findItemByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('PPE item not found');
    }

    const updated = await this.repository.updateItemScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('PPE item not found');
    }

    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'PpeItem',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async removeItem(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findItemByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('PPE item not found');
    }

    await this.repository.removeItemScoped(id, companyId);

    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'PpeItem',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  // --- Entregas -------------------------------------------------------------

  async findDeliveries(currentUser: AuthenticatedUser, employeeId?: string) {
    const companyId = this.resolveCompanyId(currentUser);
    if (employeeId) {
      await this.assertEmployeeInScope(employeeId, companyId);
    }
    return this.repository.findDeliveries(companyId, employeeId);
  }

  /**
   * Entrega de EPP: descuenta stock atomicamente, programa la reposicion segun
   * la vida util del item y exige trabajador de la misma empresa. El
   * expediente del trabajador muestra el historial y proximos vencimientos.
   */
  async createDelivery(
    currentUser: AuthenticatedUser,
    dto: CreatePpeDeliveryDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.assertEmployeeInScope(dto.employeeId, companyId);

    const dueReplacementAt = await this.computeDueReplacement(companyId, dto);

    const result: DeliveryResult =
      await this.repository.createDeliveryAtomically(
        dto,
        companyId,
        dueReplacementAt,
      );

    if ('error' in result) {
      if (result.error === 'ITEM_NOT_FOUND') {
        throw new NotFoundException('PPE item not found');
      }
      throw new BadRequestException(
        `Stock insuficiente: quedan ${result.stock} unidades`,
      );
    }

    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'PpeDelivery',
      entityId: result.delivery.id,
      after: result.delivery,
    });

    return {
      ...result.delivery,
      itemStock: result.itemStock,
      stockBelowMin: result.belowMin,
    };
  }

  /** Expediente del trabajador: historial EPP con proximo vencimiento. */
  async findEmployeeExpediente(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    await this.assertEmployeeInScope(employeeId, companyId);

    const deliveries = await this.repository.findEmployeeDeliveries(
      employeeId,
      companyId,
    );
    return {
      employeeId,
      deliveries: deliveries.map((delivery) => ({
        ...delivery,
        // Proximo vencimiento: fecha de reposicion programada de la entrega.
        dueReplacementAt: delivery.dueReplacementAt,
      })),
    };
  }

  /** Vida util del item -> fecha de reposicion de la entrega. */
  private async computeDueReplacement(
    companyId: string,
    dto: CreatePpeDeliveryDto,
  ): Promise<Date | null> {
    const item = await this.repository.findItemByIdScoped(
      dto.itemId,
      companyId,
    );
    if (!item?.usefulLifeDays) {
      return null;
    }
    const base = dto.deliveredAt ? new Date(dto.deliveredAt) : new Date();
    return new Date(base.getTime() + item.usefulLifeDays * 24 * 60 * 60 * 1000);
  }

  /** Un trabajador de otra empresa no existe para el actor (404 cross-tenant). */
  private async assertEmployeeInScope(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }
}
