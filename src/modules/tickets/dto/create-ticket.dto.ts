import { ApiProperty } from '@nestjs/swagger';
import { Severity } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MaxLength(200)
  @ApiProperty({ maxLength: 200 })
  title!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  description!: string;

  @IsDateString()
  @ApiProperty({ example: '2025-08-25T12:00:00.000Z' })
  dueDate!: string; // ISO

  @IsEnum(Severity)
  @ApiProperty({ enum: Severity })
  severity!: Severity;

  @IsOptional()
  @IsEnum(Severity)
  @ApiProperty({ enum: Severity, required: false })
  aiSuggestedSeverity?: Severity;
}
