import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Severity, Status, Ticket } from '@prisma/client';
import PromisePool from '@supercharge/promise-pool';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from 'src/database/service/prisma.service';

type ExportRow = {
  id: string;
  ticket_number: string;
  status: Status;
  severity: Severity;
  title: string;
  due_date: string; // ISO
};

type ImportRow = {
  id?: string;
  ticket_number?: string;
  status: string; // PENDING | OPEN | CLOSED (case-insensitive)
};

@Injectable()
export class CsvService {
  constructor(private readonly prisma: PrismaService) {}

  async exportPendingCsv(): Promise<{ filename: string; content: string }> {
    const tickets = await this.prisma.ticket.findMany({
      where: { status: Status.PENDING, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        ticketNumber: true,
        status: true,
        severity: true,
        title: true,
        dueDate: true,
      },
    });

    const rows: ExportRow[] = tickets.map((ticket: Ticket) => ({
      id: ticket.id,
      ticket_number: ticket.ticketNumber,
      status: ticket.status,
      severity: ticket.severity,
      title: ticket.title,
      due_date: ticket.dueDate.toISOString(),
    }));

    const header = [
      'id',
      'ticket_number',
      'status',
      'severity',
      'title',
      'due_date',
    ];
    const content = stringify(rows, { header: true, columns: header });

    const filename = `pending_tickets_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    return { filename, content };
  }

  async autoProcessCsv(
    inputCsv: Buffer,
  ): Promise<{ filename: string; content: string }> {
    const records = parse(inputCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!records.length) throw new BadRequestException('Empty or invalid CSV');

    const shuffled = [...records].sort(() => Math.random() - 0.5);

    const n = shuffled.length;
    const third = Math.floor(n / 3);
    const twoThird = third * 2;

    const toOpen = new Set(
      shuffled.slice(0, third).map((row: ImportRow) => row.id),
    );
    const toClosed = new Set(
      shuffled.slice(third, twoThird).map((row: ImportRow) => row.id),
    );

    const processed: ExportRow[] = records.map((row: ExportRow) => {
      let newStatus: Status = Status.PENDING;

      if (toOpen.has(row.id)) newStatus = Status.OPEN;
      else if (toClosed.has(row.id)) newStatus = Status.CLOSED;

      return { ...row, status: newStatus };
    });

    const header = [
      'id',
      'ticket_number',
      'status',
      'severity',
      'title',
      'due_date',
    ];

    const content = stringify(processed, { header: true, columns: header });

    const filename = `processed_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`;

    return { filename, content };
  }

  async importCsv(inputCsv: Buffer, actorId: string | null = null) {
    const rows = parse(inputCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!rows.length) throw new BadRequestException('Empty or invalid CSV');

    const normalizeStatus = (s: string): Status | null => {
      const v = s?.toUpperCase().trim();
      if (v === 'PENDING') return Status.PENDING;
      if (v === 'OPEN') return Status.OPEN;
      if (v === 'CLOSED') return Status.CLOSED;
      return null;
    };

    let updatedCount = 0;
    let skippedCount = 0;

    await PromisePool.for(rows)
      .withConcurrency(4)
      .process(async (row: ImportRow) => {
        const newStatus = normalizeStatus(row.status);

        if (!newStatus) {
          return { updated: false, skipped: true, reason: 'invalid-status' };
        }

        return await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const t = await tx.ticket.findFirst({
              where: {
                deletedAt: null,
                OR: [
                  row.id ? { id: row.id } : undefined,
                  row.ticket_number
                    ? { ticketNumber: row.ticket_number }
                    : undefined,
                ].filter(Boolean) as any,
              },
            });

            if (!t) {
              skippedCount += 1;
              return { updated: false, skipped: true, reason: 'not-found' };
            }

            if (t.status === newStatus) {
              skippedCount += 1;
              return { updated: false, skipped: true, reason: 'same-status' };
            }

            const updated = await tx.ticket.update({
              where: { id: t.id },
              data: { status: newStatus },
            });

            await tx.ticketHistory.create({
              data: {
                ticketId: t.id,
                userId: actorId, // null = external
                fromStatus: t.status,
                toStatus: newStatus,
                fromSeverity: null,
                toSeverity: null,
                reason: 'csv import',
              },
            });

            updatedCount += 1;
            return { updated: true, skipped: false, ticketId: updated.id };
          },
        );
      });

    return {
      updatedCount,
      skippedCount,
      totalRows: rows.length,
    };
  }
}
