import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/commom/decorators/roles.decorator';
import { CurrentUser } from 'src/commom/decorators/user.decorator';
import { RolesGuard } from 'src/commom/guards/roles.guard';
import { AutomationService } from './automation.service';
import { CronSecretGuard } from './guards/cron-secret.guard';

@ApiTags('Automation')
@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Post('nightly')
  @UseGuards(CronSecretGuard)
  @ApiOperation({ summary: 'Nightly routine: export → auto-process → import' })
  @ApiSecurity('cron')
  @ApiHeader({
    name: 'x-cron-secret',
    description: 'CRON secret',
    required: true,
  })
  nightly() {
    return this.automation.runNightly(null);
  }

  @Post('run-now')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Run automation at the moment (MANAGER)' })
  @ApiBearerAuth('bearer')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  runNow(@CurrentUser() user: { id: string }) {
    return this.automation.runNightly(user.id);
  }
}
