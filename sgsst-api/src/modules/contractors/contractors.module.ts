import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ContractorsController } from './contractors.controller';
import { ContractorsRepository } from './contractors.repository';
import { ContractorsService } from './contractors.service';

@Module({
  imports: [AuditModule],
  controllers: [ContractorsController],
  providers: [ContractorsService, ContractorsRepository],
})
export class ContractorsModule {}
