import type { INestApplication } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import request from 'supertest';

export type CsvRow = {
  id: string;
  ticket_number: string;
  status: 'PENDING' | 'OPEN' | 'CLOSED';
  severity: string;
  title: string;
  due_date: string;
};

export function parseCsv(content: string): CsvRow[] {
  if (!content?.trim()) return [];

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

export function countByStatus(rows: CsvRow[]) {
  const acc = { PENDING: 0, OPEN: 0, CLOSED: 0 };
  for (const r of rows) acc[r.status]++;
  return acc;
}

export async function exportPendingCsv(
  app: INestApplication,
  managerToken: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .get('/csv/export/pending')
    .set('Authorization', `Bearer ${managerToken}`)
    .expect(200);

  return res.text;
}

export async function autoProcessCsv(
  app: INestApplication,
  managerToken: string,
  csvContent: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/csv/auto-process')
    .set('Authorization', `Bearer ${managerToken}`)
    .attach('file', Buffer.from(csvContent, 'utf-8'), 'pending.csv')
    .expect(201);

  return res.text;
}

export async function importCsv(
  app: INestApplication,
  managerToken: string,
  csvContent: string,
) {
  const res = await request(app.getHttpServer())
    .post('/csv/import')
    .set('Authorization', `Bearer ${managerToken}`)
    .attach('file', Buffer.from(csvContent, 'utf-8'), 'processed.csv')
    .expect(201);

  return res.body as {
    updatedCount: number;
    skippedCount: number;
    totalRows: number;
    errorsCount: number;
  };
}
