import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { NotificationsQueueService } from './notifications-queue.service';
import { NotificationsService } from './notifications.service';
import { ExternalDeliveriesQueryDto } from './dto/external-deliveries-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsQueueService: NotificationsQueueService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ) {
    return this.notificationsService.findForUser(user, query);
  }

  @Patch(':id/read')
  @Roles('ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Patch('read-all')
  @Roles('ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Post('generate-due-alerts')
  @Roles('ADMIN', 'SST')
  generateDueAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsQueueService.enqueueDueAlerts(user);
  }

  @Get('task-escalation/capabilities')
  @Roles('ADMIN', 'SST')
  getTaskEscalationCapabilities() {
    return this.notificationsService.getTaskEscalationCapabilities();
  }

  /** S16.1: pasada manual de escalamiento de tareas vencidas por empresa. */
  @Post('task-escalation/run')
  @Roles('ADMIN', 'SST')
  runTaskEscalation(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsQueueService.enqueueTaskEscalation(user);
  }

  @Post('retry-external-deliveries')
  @Roles('ADMIN')
  retryExternalDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsQueueService.enqueueExternalDeliveryRetries(user);
  }

  @Get('external-deliveries')
  @Roles('ADMIN')
  findExternalDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExternalDeliveriesQueryDto,
  ) {
    return this.notificationsService.findExternalDeliveries(user, query);
  }

  @Post('external-deliveries/:id/retry')
  @Roles('ADMIN')
  retryExternalDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.retryExternalDeliveryForUser(user, id);
  }
}
