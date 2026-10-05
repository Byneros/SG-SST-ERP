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
import { ContractorsService } from './contractors.service';
import {
  AdvanceContractorEntryDto,
  ContractorListQueryDto,
  CreateContractorDocumentDto,
  CreateContractorDto,
  CreateContractorWorkerDto,
  UpdateContractorDocumentDto,
  UpdateContractorDto,
  UpdateContractorWorkerDto,
} from './dto/contractor.dto';

@ApiTags('contractors')
@ApiBearerAuth()
@Controller('contractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractorsController {
  constructor(private readonly service: ContractorsService) {}

  // --- Contratistas -----------------------------------------------------------

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ContractorListQueryDto,
  ) {
    return this.service.findMany(user, query);
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
    @Body() dto: CreateContractorDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractorDto,
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

  // --- Personal ---------------------------------------------------------------

  @Get(':id/workers')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findWorkers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findWorkers(user, id);
  }

  @Post(':id/workers')
  @Roles('ADMIN', 'SST')
  createWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContractorWorkerDto,
  ) {
    return this.service.createWorker(user, id, dto);
  }

  @Patch(':id/workers/:workerId')
  @Roles('ADMIN', 'SST')
  updateWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Body() dto: UpdateContractorWorkerDto,
  ) {
    return this.service.updateWorker(user, id, workerId, dto);
  }

  @Delete(':id/workers/:workerId')
  @Roles('ADMIN', 'SST')
  removeWorker(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('workerId', ParseUUIDPipe) workerId: string,
  ) {
    return this.service.removeWorker(user, id, workerId);
  }

  // --- Documentos -------------------------------------------------------------

  @Get(':id/documents')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findDocuments(user, id);
  }

  @Post(':id/documents')
  @Roles('ADMIN', 'SST')
  createDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContractorDocumentDto,
  ) {
    return this.service.createDocument(user, id, dto);
  }

  @Patch(':id/documents/:documentId')
  @Roles('ADMIN', 'SST')
  updateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateContractorDocumentDto,
  ) {
    return this.service.updateDocument(user, id, documentId, dto);
  }

  @Delete(':id/documents/:documentId')
  @Roles('ADMIN', 'SST')
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.service.removeDocument(user, id, documentId);
  }

  // --- Autorizacion de ingreso ------------------------------------------------

  /** Regla: no se autoriza ingreso con documentos vencidos/pendientes. */
  @Get(':id/entry-authorization')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  getEntryAuthorization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getEntryAuthorization(user, id);
  }

  /** S13.4: avanza el flujo de ingreso (solo a la etapa siguiente). */
  @Post(':id/entry-authorization/advance')
  @Roles('ADMIN', 'SST')
  advanceEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceContractorEntryDto,
  ) {
    return this.service.advanceEntry(user, id, dto);
  }
}
