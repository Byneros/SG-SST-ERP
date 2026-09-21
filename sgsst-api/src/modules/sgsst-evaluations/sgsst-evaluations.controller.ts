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
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AddEvaluationItemsDto } from './dto/add-evaluation-items.dto';
import { CreateSgsstEvaluationDto } from './dto/create-sgsst-evaluation.dto';
import { UpdateEvaluationItemDto } from './dto/update-evaluation-item.dto';
import { UpdateSgsstEvaluationDto } from './dto/update-sgsst-evaluation.dto';
import { SgsstEvaluationsService } from './sgsst-evaluations.service';

@ApiTags('sgsst-evaluations')
@ApiBearerAuth()
@Controller('sgsst-evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SgsstEvaluationsController {
  constructor(private readonly service: SgsstEvaluationsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findAll(user, query, companyId);
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
    @Body() dto: CreateSgsstEvaluationDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSgsstEvaluationDto,
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

  @Post(':id/items')
  @Roles('ADMIN', 'SST')
  addItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEvaluationItemsDto,
  ) {
    return this.service.addItems(user, id, dto);
  }

  @Patch('items/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluationItemDto,
  ) {
    return this.service.updateItem(user, id, dto);
  }
}
