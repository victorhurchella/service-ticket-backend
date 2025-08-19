import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Severity, Status } from '@prisma/client';
import { PrismaService } from 'src/database/service/prisma.service';
import { SequenceService } from '../sequence/sequence.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReviewAction, ReviewTicketDto } from './dto/review-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequence: SequenceService,
  ) {}

  async create(dto: CreateTicketDto & { createdById: string }) {
    const due = new Date(dto.dueDate);
    if (isNaN(due.getTime())) throw new BadRequestException('Invalid dueDate');

    const year = new Date().getUTCFullYear();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const {
        year: y,
        sequence,
        ticketNumber,
      } = await this.sequence.allocateTicketNumber(year, tx);

      const ticket = await tx.ticket.create({
        data: {
          id: crypto.randomUUID(),
          ticketNumber,
          year: y,
          sequence,
          title: dto.title,
          description: dto.description,
          dueDate: due,
          severity: dto.severity,
          aiSuggestedSeverity: dto.aiSuggestedSeverity ?? null,
          status: Status.DRAFT,
          createdById: dto.createdById,
        },
      });

      await this.recordHistory(
        tx,
        ticket.id,
        dto.createdById,
        null,
        Status.DRAFT,
        null,
        dto.severity,
        'created',
      );

      return ticket;
    });
  }

  async findMany(params: {
    status?: Status;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, q, page = 1, pageSize = 20 } = params;
    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { ticketNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateInReview(
    ticketId: string,
    associateId: string,
    dto: UpdateTicketDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.deletedAt)
      throw new NotFoundException('Ticket not found');

    if (ticket.status !== Status.REVIEW)
      throw new BadRequestException(
        'Only tickets in REVIEW can be edited by associate',
      );

    if (ticket.createdById !== associateId)
      throw new ForbiddenException('Only the original associate can edit');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          title: dto.title ?? ticket.title,
          description: dto.description ?? ticket.description,
          status: Status.DRAFT,
        },
      });

      await this.recordHistory(
        tx,
        ticketId,
        associateId,
        Status.REVIEW,
        Status.DRAFT,
        null,
        null,
        'associate edited (title/description)',
      );

      return updated;
    });
  }

  async reviewByManager(
    ticketId: string,
    dto: ReviewTicketDto & { reviewerId: string },
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.deletedAt)
      throw new NotFoundException('Ticket not found');

    if (ticket.status !== Status.DRAFT)
      throw new BadRequestException('Only DRAFT tickets can be reviewed');

    if (ticket.createdById === dto.reviewerId)
      throw new ForbiddenException('Manager cannot review own ticket');

    if (dto.action === ReviewAction.APPROVE) {
      return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: Status.PENDING,
            reviewedById: dto.reviewerId,
          },
        });
        await this.recordHistory(
          tx,
          ticketId,
          dto.reviewerId,
          Status.DRAFT,
          Status.PENDING,
          null,
          null,
          'approved',
        );
        return updated;
      });
    }

    if (dto.action === ReviewAction.CHANGE_SEVERITY) {
      if (!dto.newSeverity)
        throw new BadRequestException('newSeverity is required');
      if (!dto.severityChangeReason?.trim())
        throw new BadRequestException('severityChangeReason is required');

      const from = ticket.severity;
      const to = dto.newSeverity;

      const rank = (s: Severity) =>
        (({ VERY_HIGH: 5, HIGH: 4, MEDIUM: 3, LOW: 2, EASY: 1 }) as const)[s];

      const elevated = rank(to) > rank(from);
      const newStatus = elevated ? Status.REVIEW : Status.PENDING;

      return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            severity: to,
            status: newStatus,
            reviewedById: dto.reviewerId,
          },
        });

        await this.recordHistory(
          tx,
          ticketId,
          dto.reviewerId,
          Status.DRAFT,
          newStatus,
          from,
          to,
          `severity changed: ${dto.severityChangeReason}`,
        );

        return updated;
      });
    }

    throw new BadRequestException('Unsupported action');
  }

  async softDelete(ticketId: string, actorId: string) {
    const t = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t || t.deletedAt) throw new NotFoundException('Ticket not found');
    if (
      t.status === Status.PENDING ||
      t.status === Status.OPEN ||
      t.status === Status.CLOSED
    ) {
      throw new BadRequestException(
        'Cannot delete ticket with status >= PENDING',
      );
    }

    const deleted = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { deletedAt: new Date() },
    });

    await this.recordHistory(
      this.prisma,
      ticketId,
      actorId,
      t.status,
      t.status,
      null,
      null,
      'soft deleted',
    );
    return deleted;
  }

  async history(ticketId: string) {
    const t = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!t) throw new NotFoundException('Ticket not found');

    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recordHistory(
    tx: Prisma.TransactionClient | PrismaService,
    ticketId: string,
    userId: string | null,
    fromStatus: Status | null,
    toStatus: Status | null,
    fromSeverity: Severity | null,
    toSeverity: Severity | null,
    reason?: string | null,
  ) {
    await tx.ticketHistory.create({
      data: {
        ticketId,
        userId,
        fromStatus,
        toStatus,
        fromSeverity,
        toSeverity,
        reason: reason ?? null,
      },
    });
  }
}
