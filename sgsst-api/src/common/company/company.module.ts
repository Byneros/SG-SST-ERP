import { Module } from '@nestjs/common';
import { Controller } from '@nestjs/common';

@Controller('company')
export class CompanyController {}
import { Injectable } from '@nestjs/common';

@Injectable()
export class CompanyService {}

@Module({
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
