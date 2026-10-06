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
import { TasksService } from './tasks.service';
import {
  CreateTaskCommentDto,
  CreateTaskDto,
  TasksListQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

/**
 * Bandeja de tareas (S15.3). EMPLOYEE ve y comenta solo "sus tareas"
 * (assignee=me + owner en sus registros; el backend resuelve el scope y
 * el repositorio filtra por ownerId); la gestion completa es ADMIN/SST.
 */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TasksListQueryDto,
  ) {
    return this.service.findMany(user, query);
  }

  @Get('summary')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user);
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
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
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

  @Post(':id/comments')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.service.addComment(user, id, dto);
  }

  @Delete(':id/comments/:commentId')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  removeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    return this.service.removeComment(user, id, commentId);
  }
}
