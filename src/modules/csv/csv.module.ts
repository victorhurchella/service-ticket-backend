import { Module } from '@nestjs/common';
import { SequenceService } from '../sequence/sequence.service';
import { TicketsService } from '../tickets/tickets.service';
import { CsvController } from './csv.controller';
import { CsvService } from './csv.service';

@Module({
  controllers: [CsvController],
  providers: [CsvService, TicketsService, SequenceService],
})
export class CsvModule {}
