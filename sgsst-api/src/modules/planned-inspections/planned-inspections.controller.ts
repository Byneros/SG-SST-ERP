import {
  BadRequestException,
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
  CreateCorrectiveActionDto,
  CreateInspectionFindingDto,
  CreatePlannedInspectionDto,
  UpdateInspectionFindingDto,
  UpdateInspectionItemDto,
  UpdatePlannedInspectionDto,
} from './dto/planned-inspection.dto';
import { PlannedInspectionsService } from './planned-inspections.service';

@ApiTags('planned-inspections')
@ApiBearerAuth()
@Controller('planned-inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlannedInspectionsController {
  constructor(private readonly service: PlannedInspectionsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.findAll(user, siteId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlannedInspectionDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlannedInspectionDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SST')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }

  /** Respuesta de un item del checklist. */
  @Patch('items/:itemId')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('inspectionId', ParseUUIDPipe) inspectionId: string,
    @Body() dto: UpdateInspectionItemDto,
  ) {
    return this.service.updateItem(user, inspectionId, itemId, dto);
  }

  /** Agrega preguntas al checklist de la inspeccion. */
  @Post(':id/items')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  addItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    // Acepta `questions` (lote) o `question` (singular); normalizado aqui.
    @Body() dto: { questions?: Array<string | { question: string }>; question?: string },
  ) {
    const raw = dto?.questions ?? (dto?.question ? [dto.question] : []);
    const questions: string[] = Array.isArray(raw)
      ? raw.map((item) => (typeof item === 'string' ? item : item.question))
      : [];
    if (questions.length === 0) {
      throw new BadRequestException('Debe enviar `question` o `questions` con al menos una pregunta');
    }
    return this.service.addItems(user, id, questions);
  }

  @Post(':id/findings')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  addFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInspectionFindingDto,
  ) {
    return this.service.addFinding(user, id, dto);
  }

  @Patch('findings/:findingId')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: UpdateInspectionFindingDto,
  ) {
    return this.service.updateFinding(user, findingId, dto);
  }

  /** Accion correctiva desde hallazgo (reutiliza CorrectiveAction). */
  @Post('findings/:findingId/actions')
  @Roles('ADMIN', 'SST')
  addCorrectiveAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.service.addCorrectiveAction(user, findingId, dto);
  }
}
