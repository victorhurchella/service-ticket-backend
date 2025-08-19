import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationModule } from './modules/automation/automation.module';
import { CsvModule } from './modules/csv/csv.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DatabaseModule,
    TicketsModule,
    UsersModule,
    AuthModule,
    CsvModule,
    AutomationModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
