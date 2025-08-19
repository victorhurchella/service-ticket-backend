import { Module } from '@nestjs/common';
import { SequenceService } from '../sequence/sequence.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, SequenceService],
  exports: [TicketsService],
})
export class TicketsModule {}
