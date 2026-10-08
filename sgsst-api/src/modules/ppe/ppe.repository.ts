import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreatePpeDeliveryDto,
  CreatePpeItemDto,
  UpdatePpeItemDto,
} from './dto/ppe.dto';

const itemInclude = {
  deliveries: {
    orderBy: { deliveredAt: 'desc' as const },
    take: 10,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, document: true },
      },
    },
  },
} as const;

const deliveryInclude = {
  item: {
    select: { id: true, name: true, type: true, standard: true, size: true },
  },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      document: true,
      position: true,
    },
  },
} as const;

@Injectable()
export class PpeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Catalogo -------------------------------------------------------------

  findItems(companyId: string, includeInactive = false) {
    return this.prisma.ppeItem.findMany({
      where: { companyId, isActive: includeInactive ? undefined : true },
      orderBy: { name: 'asc' },
    });
  }

  findItemByIdScoped(id: string, companyId: string) {
    return this.prisma.ppeItem.findFirst({
      where: { id, companyId },
      include: itemInclude,
    });
  }

  createItem(dto: CreatePpeItemDto, companyId: string) {
    return this.prisma.ppeItem.create({
      data: {
        name: dto.name,
        type: dto.type,
        standard: dto.standard,
        size: dto.size,
        usefulLifeDays: dto.usefulLifeDays,
        stockMin: dto.stockMin ?? 0,
        stock: dto.stock ?? 0,
        companyId,
      },
    });
  }

  async updateItemScoped(id: string, companyId: string, dto: UpdatePpeItemDto) {
    const result = await this.prisma.ppeItem.updateMany({
      where: { id, companyId },
      data: {
        name: dto.name,
        type: dto.type,
        standard: dto.standard,
        size: dto.size,
        usefulLifeDays: dto.usefulLifeDays,
        stockMin: dto.stockMin,
        // Ajuste manual de inventario (compras/bajas) va por aqui, con traza.
        stock: dto.stock,
        isActive: dto.isActive,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findItemByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR); bloqueado si el item tiene entregas (FK restrict). */
  async removeItemScoped(id: string, companyId: string) {
    const before = await this.findItemByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.ppeItem.delete({ where: { id } });
    return before;
  }

  // --- Entregas -------------------------------------------------------------

  findDeliveries(companyId: string, employeeId?: string) {
    return this.prisma.ppeDelivery.findMany({
      where: {
        companyId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: deliveryInclude,
      orderBy: { deliveredAt: 'desc' },
    });
  }

  findDeliveryByIdScoped(id: string, companyId: string) {
    return this.prisma.ppeDelivery.findFirst({
      where: { id, companyId },
      include: deliveryInclude,
    });
  }

  /**
   * Entrega atomica: valida stock suficiente, descuenta existencias y crea la
   * entrega con fecha de reposicion (vida util del item) en una transaccion.
   * Si el stock resultante quedara por debajo del minimo se refleja en el item
   * (el dashboard/alertas lo reportan; la entrega no se bloquea por eso).
   */
  async createDeliveryAtomically(
    dto: CreatePpeDeliveryDto,
    companyId: string,
    dueReplacementAt: Date | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.ppeItem.findFirst({
        where: { id: dto.itemId, companyId },
        select: { id: true, stock: true, stockMin: true, usefulLifeDays: true },
      });
      if (!item) {
        return { error: 'ITEM_NOT_FOUND' as const };
      }
      const quantity = dto.quantity ?? 1;
      if (item.stock < quantity) {
        return { error: 'INSUFFICIENT_STOCK' as const, stock: item.stock };
      }

      const delivery = await tx.ppeDelivery.create({
        data: {
          itemId: dto.itemId,
          employeeId: dto.employeeId,
          quantity,
          deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(),
          dueReplacementAt,
          signature: dto.signature,
          notes: dto.notes,
          companyId,
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              type: true,
              standard: true,
              size: true,
            },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              document: true,
              position: true,
            },
          },
        },
      });

      await tx.ppeItem.update({
        where: { id: dto.itemId },
        data: { stock: { decrement: quantity } },
      });

      const updatedItem = await tx.ppeItem.findUnique({
        where: { id: dto.itemId },
        select: { id: true, stock: true, stockMin: true },
      });

      return {
        delivery,
        itemStock: updatedItem?.stock ?? item.stock - quantity,
        belowMin: (updatedItem?.stock ?? 0) < (updatedItem?.stockMin ?? 0),
      };
    });
  }

  /** Expediente del trabajador: historial de EPP con proximos vencimientos. */
  findEmployeeDeliveries(employeeId: string, companyId: string) {
    return this.prisma.ppeDelivery.findMany({
      where: { employeeId, companyId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            type: true,
            standard: true,
            size: true,
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
    });
  }

  /**
   * Asistente IA (fase H3): catalogo activo con stock y estado frente al
   * minimo. Solo lectura y siempre scoped por companyId.
   */
  findStockSummary(companyId: string) {
    return this.prisma.ppeItem.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        stock: true,
        stockMin: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Asistente IA (fase H3): entregas con reposicion vencida o proxima (30
   * dias). Solo lectura y siempre scoped por companyId.
   */
  findExpiringDeliveries(companyId: string, take: number) {
    return this.prisma.ppeDelivery.findMany({
      where: {
        companyId,
        dueReplacementAt: {
          not: null,
          lte: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      },
      select: {
        id: true,
        quantity: true,
        deliveredAt: true,
        dueReplacementAt: true,
        item: { select: { name: true, type: true } },
        employee: {
          select: { firstName: true, lastName: true, position: true },
        },
      },
      orderBy: { dueReplacementAt: 'asc' },
      take,
    });
  }
}
