import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SitesModule } from '../sites/sites.module';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { DocumentsStorageService } from './documents-storage.service';

@Module({
  imports: [AuditModule, SitesModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, DocumentsStorageService],
  exports: [DocumentsStorageService],
})
export class DocumentsModule {}
