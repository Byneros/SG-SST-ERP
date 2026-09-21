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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { DocumentListQueryDto } from './dto/document-list-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsStorageService } from './documents-storage.service';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentsStorageService: DocumentsStorageService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DocumentListQueryDto,
    @Query('companyId') companyId?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.documentsService.findAll(
      user,
      query,
      companyId,
      siteId,
    );
  }

  @Get(':id/download')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const document = await this.documentsService.findOne(id, user);
    const content = await this.documentsStorageService.readDocument(
      document.fileUrl,
    );
    const fileName = document.fileName ?? `${document.name}.bin`;
    response.setHeader(
      'Content-Type',
      document.mimeType ?? 'application/octet-stream',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    response.send(content);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(
      {
        ...dto,
        // Fuente única de verdad: un companyId ajeno del cliente se rechaza con 403.
        companyId: resolveCompanyScope(user, dto.companyId),
      },
      user,
    );
  }

  @Post('upload')
  @Roles('ADMIN', 'SST')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: unknown) {
    return this.documentsStorageService.upload(file as never);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(
      id,
      {
        ...dto,
        // El cliente nunca decide la empresa: el scope autenticado manda.
        companyId: resolveCompanyScope(user, dto.companyId),
      },
      user,
    );
  }

  @Post(':id/versions')
  @Roles('ADMIN', 'SST')
  createVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentVersionDto,
  ) {
    return this.documentsService.createVersion(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SST')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.remove(id, user);
  }
}
