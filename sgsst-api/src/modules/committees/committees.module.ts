import { Module } from '@nestjs/common';
import { CommitteesController } from './committees.controller';
import { CommitteesRepository } from './committees.repository';
import { CommitteesService } from './committees.service';

@Module({
  controllers: [CommitteesController],
  providers: [CommitteesService, CommitteesRepository],
})
export class CommitteesModule {}
