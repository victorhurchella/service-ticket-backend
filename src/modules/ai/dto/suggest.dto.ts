import { ApiProperty } from '@nestjs/swagger';
import { Severity } from '@prisma/client';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SuggestSeverityDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class SuggestSeverityResponseDto {
  @ApiProperty({ enum: Severity, enumName: 'Severity' })
  severity!: Severity;

  @ApiProperty({ example: 'LLM', enum: ['LLM', 'HEURISTIC'] })
  source!: 'LLM' | 'HEURISTIC';

  @ApiProperty({ required: false, nullable: true })
  model?: string | null;

  @ApiProperty({ required: false, type: [String] })
  reasons?: string[];
}
