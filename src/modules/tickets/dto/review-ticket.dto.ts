import { ApiProperty } from '@nestjs/swagger';
import { Severity } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'APPROVE',
  CHANGE_SEVERITY = 'CHANGE_SEVERITY',
}

export class ReviewTicketDto {
  @IsEnum(ReviewAction)
  @ApiProperty({ enum: ReviewAction, required: false })
  action!: ReviewAction;

  @IsOptional()
  @IsEnum(Severity)
  @ApiProperty({ enum: Severity, required: false })
  newSeverity?: Severity;

  @IsString()
  @IsOptional()
  @ApiProperty()
  severityChangeReason?: string;
}
