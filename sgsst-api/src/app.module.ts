import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { MetricsController } from './common/observability/metrics.controller';
import { MetricsService } from './common/observability/metrics.service';
import { MetricsTokenGuard } from './common/observability/metrics-token.guard';
import { RequestObservabilityMiddleware } from './common/observability/request-observability.middleware';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { AnnualWorkPlansModule } from './modules/annual-work-plans/annual-work-plans.module';
import { ContractorsModule } from './modules/contractors/contractors.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { AuditModule } from './modules/audit/audit.module';
import { PlannedInspectionsModule } from './modules/planned-inspections/planned-inspections.module';
import { UnplannedInspectionsModule } from './modules/unplanned-inspections/unplanned-inspections.module';
import { UnsafeReportsModule } from './modules/unsafe-reports/unsafe-reports.module';
import { PpeModule } from './modules/ppe/ppe.module';
import { MedicalModule } from './modules/medical/medical.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { LegalComplianceModule } from './modules/legal-compliance/legal-compliance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RisksModule } from './modules/risks/risks.module';
import { SitesModule } from './modules/sites/sites.module';
import { SgsstAuditsModule } from './modules/sgsst-audits/sgsst-audits.module';
import { SgsstEvaluationsModule } from './modules/sgsst-evaluations/sgsst-evaluations.module';
import { SsoModule } from './modules/sso/sso.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { TrainingsModule } from './modules/trainings/trainings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    AiAssistantModule,
    AnnualWorkPlansModule,
    ContractorsModule,
    DeveloperModule,
    PlannedInspectionsModule,
    UnplannedInspectionsModule,
    UnsafeReportsModule,
    PpeModule,
    MedicalModule,
    UsersModule,
    CompaniesModule,
    DashboardModule,
    DocumentsModule,
    EmployeesModule,
    LegalComplianceModule,
    NotificationsModule,
    ReportsModule,
    RisksModule,
    SitesModule,
    SgsstAuditsModule,
    SgsstEvaluationsModule,
    SsoModule,
    IndicatorsModule,
    TrainingsModule,
    IncidentsModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [
    AppService,
    MetricsService,
    MetricsTokenGuard,
    RequestObservabilityMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestObservabilityMiddleware,
        SecurityHeadersMiddleware,
        RateLimitMiddleware,
      )
      .forRoutes('*path');
  }
}
