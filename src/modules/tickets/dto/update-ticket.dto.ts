import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @ApiProperty({ maxLength: 200, required: false })
  title?: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ required: false })
  description?: string;
}
