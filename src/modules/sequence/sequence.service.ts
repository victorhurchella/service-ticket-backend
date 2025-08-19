import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/service/prisma.service';

@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateTicketNumber(
    year: number,
    tx: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const updated = await tx.ticketSequence.update({
      where: { year },
      data: { lastValue: { increment: 1 } },
    });

    const sequence = updated.lastValue;
    const ticketNumber = `TKT-${year}-${String(sequence).padStart(6, '0')}`;

    return { year, sequence, ticketNumber };
  }
}
