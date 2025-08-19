import { Module } from '@nestjs/common';
import { CsvService } from '../csv/csv.service';
import { SequenceService } from '../sequence/sequence.service';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  controllers: [AutomationController],
  providers: [AutomationService, CsvService, SequenceService],
})
export class AutomationModule {}
