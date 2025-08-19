import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role, Status } from '@prisma/client';
import { Roles } from 'src/commom/decorators/roles.decorator';
import {
  CurrentUser,
  ICurrentUser,
} from 'src/commom/decorators/user.decorator';
import { RolesGuard } from 'src/commom/guards/roles.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReviewTicketDto } from './dto/review-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('Tickets')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Ticket Create' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: ICurrentUser) {
    return this.tickets.create({ ...dto, createdById: user.id });
  }

  @Get()
  @ApiOperation({ summary: 'List tickets' })
  @ApiQuery({ name: 'status', required: false, enum: Status })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @Query('status') status?: Status,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.tickets.findMany({
      status: status,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Patch(':id/review')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Review Draft Ticket (MANAGER)' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewTicketDto,
    @CurrentUser() user: any,
  ) {
    return this.tickets.reviewByManager(id, {
      ...dto,
      reviewerId: user.id,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit ticket in REVIEW and return to DRAFT',
  })
  updateInReview(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.tickets.updateInReview(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete (< PENDING)' })
  softDelete(@Param('id') id: string, @Query('actorId') actorId: string) {
    return this.tickets.softDelete(id, actorId);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Ticket history' })
  history(@Param('id') id: string) {
    return this.tickets.history(id);
  }
}
