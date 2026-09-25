import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  CreatePpeDeliveryDto,
  CreatePpeItemDto,
  UpdatePpeItemDto,
} from './dto/ppe.dto';
import { PpeService } from './ppe.service';

@ApiTags('ppe')
@ApiBearerAuth()
@Controller('ppe')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PpeController {
  constructor(private readonly service: PpeService) {}

  // --- Catalogo -------------------------------------------------------------

  @Get('items')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.service.findItems(user, includeInactive);
  }

  @Get('items/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findItem(user, id);
  }

  @Post('items')
  @Roles('ADMIN', 'SST')
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePpeItemDto,
  ) {
    return this.service.createItem(user, dto);
  }

  @Patch('items/:id')
  @Roles('ADMIN', 'SST')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePpeItemDto,
  ) {
    return this.service.updateItem(user, id, dto);
  }

  @Delete('items/:id')
  @Roles('ADMIN', 'SST')
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeItem(user, id);
  }

  // --- Entregas -------------------------------------------------------------

  @Get('deliveries')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findDeliveries(user, employeeId);
  }

  /** Expediente del trabajador: historial EPP + proximos vencimientos. */
  @Get('employee/:employeeId')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findEmployeeExpediente(
    @CurrentUser() user: AuthenticatedUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.service.findEmployeeExpediente(user, employeeId);
  }

  /** Entrega con descuento de stock y fecha de reposicion. */
  @Post('deliveries')
  @Roles('ADMIN', 'SST')
  createDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePpeDeliveryDto,
  ) {
    return this.service.createDelivery(user, dto);
  }
}
