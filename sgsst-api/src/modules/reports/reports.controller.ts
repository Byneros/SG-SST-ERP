import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ReportExportsQueryDto } from './dto/report-exports-query.dto';
import { ReportsQueueService } from './reports-queue.service';
import type { ReportFormat, ReportKind } from './reports.service';
import { ReportsService } from './reports.service';
import { DocumentsStorageService } from '../documents/documents-storage.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsQueueService: ReportsQueueService,
    private readonly documentsStorageService: DocumentsStorageService,
  ) {}

  @Get('exports')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findExports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportsQueryDto,
  ) {
    return this.reportsService.findExports(user, query);
  }

  @Get('metrics')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  metrics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportsQueryDto,
  ) {
    return this.reportsService.metrics(user, query);
  }

  @Get('metrics/history')
  @Roles('ADMIN')
  metricHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportExportsQueryDto,
  ) {
    return this.reportsService.metricHistory(user, query);
  }

  @Post('exports/:id/retry')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  async retryExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const reportExport = await this.reportsService.prepareRetry(user, id);
    return this.reportsQueueService.enqueue({
      user,
      kind: reportExport.kind,
      format: reportExport.format as ReportFormat,
      companyId: reportExport.requestedCompanyId ?? undefined,
      exportId: reportExport.id,
    });
  }

  @Get('exports/:id/download')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  async downloadExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const reportExport = await this.reportsService.getDownloadableExport(
      user,
      id,
    );
    const content = await this.documentsStorageService.readReport(
      reportExport.storageKey!,
    );
    response.setHeader(
      'Content-Type',
      reportExport.mimeType ?? 'application/octet-stream',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(reportExport.fileName!)}`,
    );
    response.send(content);
  }

  @Get(':kind.csv')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  async csv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: ReportKind,
    @Query('companyId') companyId: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const content = await this.generateAndAudit(
      () => this.reportsService.csv(user, kind, companyId),
      {
        user,
        kind,
        format: 'csv',
        companyId,
        request,
      },
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${kind}.csv"`,
    );
    response.send(content);
  }

  @Get(':kind.pdf')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: ReportKind,
    @Query('companyId') companyId: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const content = await this.generateAndAudit(
      () => this.reportsService.pdf(user, kind, companyId),
      {
        user,
        kind,
        format: 'pdf',
        companyId,
        request,
      },
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${kind}.pdf"`,
    );
    response.send(content);
  }

  @Post(':kind.:format/schedule')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: ReportKind,
    @Param('format') format: ReportFormat,
    @Query('companyId') companyId: string | undefined,
  ) {
    return this.reportsQueueService.enqueue({ user, kind, format, companyId });
  }

  private async generateAndAudit<T>(
    action: () => Promise<T>,
    metadata: {
      user: AuthenticatedUser;
      kind: string;
      format: ReportFormat;
      companyId?: string;
      request: Request;
    },
  ) {
    try {
      const content = await action();
      await this.reportsService.logExport({
        user: metadata.user,
        kind: metadata.kind,
        format: metadata.format,
        requestedCompanyId: metadata.companyId,
        request: metadata.request,
        status: 'SUCCESS',
      });
      return content;
    } catch (error) {
      await this.reportsService.logExport({
        user: metadata.user,
        kind: metadata.kind,
        format: metadata.format,
        requestedCompanyId: metadata.companyId,
        request: metadata.request,
        status: 'FAILED',
        error,
      });
      throw error;
    }
  }
}
