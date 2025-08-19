import { Injectable } from '@nestjs/common';
import type { Status } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { CsvService } from '../csv/csv.service';

type ExportRow = {
  id: string;
  ticket_number: string;
  status: Status;
  severity: string;
  title: string;
  due_date: string;
};

@Injectable()
export class AutomationService {
  constructor(private readonly csv: CsvService) {}

  async runNightly(actorId: string | null) {
    const exported = await this.csv.exportPendingCsv();
    const exportedRows = this.parseRows(exported.content);
    const exportedCount = exportedRows.length;

    const processed = await this.csv.autoProcessCsv(
      Buffer.from(exported.content, 'utf-8'),
    );
    const processedRows = this.parseRows(processed.content);
    const dist = this.distribution(processedRows);

    const importResult = await this.csv.importCsv(
      Buffer.from(processed.content, 'utf-8'),
      actorId,
    );

    return {
      exportedCount,
      processedDistribution: dist,
      importResult,
      timestamps: {
        startedAt: new Date().toISOString(),
      },
    };
  }

  private parseRows(csvContent: string): ExportRow[] {
    const rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<ExportRow>;

    return rows ?? [];
  }

  private distribution(rows: ExportRow[]) {
    const summary = { PENDING: 0, OPEN: 0, CLOSED: 0 };

    for (const r of rows) {
      if (r.status === 'OPEN') summary.OPEN += 1;
      else if (r.status === 'CLOSED') summary.CLOSED += 1;
      else summary.PENDING += 1;
    }

    return summary;
  }
}
