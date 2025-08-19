import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  SuggestSeverityDto,
  SuggestSeverityResponseDto,
} from './dto/suggest.dto';

@ApiTags('AI')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('severity-suggestion')
  @ApiOperation({ summary: 'OpenAI severity suggestion w/ heuristic fallback' })
  async suggest(
    @Body() dto: SuggestSeverityDto,
  ): Promise<SuggestSeverityResponseDto> {
    return this.ai.suggestSeverity(dto.title, dto.description);
  }
}
