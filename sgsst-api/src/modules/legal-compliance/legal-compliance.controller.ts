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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CompanyLegalRequirementsQueryDto } from './dto/company-legal-requirements-query.dto';
import { CreateLegalNormDto } from './dto/create-legal-norm.dto';
import { CreateLegalRequirementDto } from './dto/create-legal-requirement.dto';
import { LegalRequirementsQueryDto } from './dto/legal-requirements-query.dto';
import { LinkLegalEvidenceDto } from './dto/link-legal-evidence.dto';
import { UpdateCompanyLegalRequirementDto } from './dto/update-company-legal-requirement.dto';
import { UpdateLegalNormDto } from './dto/update-legal-norm.dto';
import { UpdateLegalRequirementDto } from './dto/update-legal-requirement.dto';
import { LegalComplianceService } from './legal-compliance.service';

@Controller('legal-compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LegalComplianceController {
  constructor(
    private readonly legalComplianceService: LegalComplianceService,
  ) {}

  @Get('norms')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findNorms(@Query() query: LegalRequirementsQueryDto) {
    return this.legalComplianceService.findNorms(query);
  }

  @Post('norms')
  @Roles('ADMIN')
  createNorm(@Body() dto: CreateLegalNormDto) {
    return this.legalComplianceService.createNorm(dto);
  }

  @Patch('norms/:id')
  @Roles('ADMIN')
  updateNorm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalNormDto,
  ) {
    return this.legalComplianceService.updateNorm(id, dto);
  }

  @Delete('norms/:id')
  @Roles('ADMIN')
  deactivateNorm(@Param('id', ParseUUIDPipe) id: string) {
    return this.legalComplianceService.deactivateNorm(id);
  }

  @Get('requirements')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findRequirements(@Query() query: LegalRequirementsQueryDto) {
    return this.legalComplianceService.findRequirements(query);
  }

  @Post('requirements')
  @Roles('ADMIN')
  createRequirement(@Body() dto: CreateLegalRequirementDto) {
    return this.legalComplianceService.createRequirement(dto);
  }

  @Patch('requirements/:id')
  @Roles('ADMIN')
  updateRequirement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalRequirementDto,
  ) {
    return this.legalComplianceService.updateRequirement(id, dto);
  }

  @Delete('requirements/:id')
  @Roles('ADMIN')
  deactivateRequirement(@Param('id', ParseUUIDPipe) id: string) {
    return this.legalComplianceService.deactivateRequirement(id);
  }

  @Post('seed-defaults')
  @Roles('ADMIN')
  seedDefaults() {
    return this.legalComplianceService.seedDefaults();
  }

  @Get('companies/:companyId/requirements')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findCompanyRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: CompanyLegalRequirementsQueryDto,
  ) {
    return this.legalComplianceService.findCompanyRequirements(
      user,
      companyId,
      query,
    );
  }

  @Post('companies/:companyId/requirements/sync')
  @Roles('ADMIN', 'SST')
  syncCompanyRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.legalComplianceService.syncCompanyRequirements(user, companyId);
  }

  @Get('companies/:companyId/summary')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.legalComplianceService.summary(user, companyId);
  }

  @Get('companies/:companyId/reports')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  reports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.legalComplianceService.managementReports(user, companyId);
  }

  @Patch('company-requirements/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateCompanyRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyLegalRequirementDto,
  ) {
    return this.legalComplianceService.updateCompanyRequirement(user, id, dto);
  }

  @Post('company-requirements/:id/evidences')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  linkEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkLegalEvidenceDto,
  ) {
    return this.legalComplianceService.linkEvidence(user, id, dto);
  }
}
