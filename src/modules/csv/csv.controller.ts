import {
  Controller,
  Get,
  Header,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles } from 'src/commom/decorators/roles.decorator';
import { CurrentUser } from 'src/commom/decorators/user.decorator';
import { RolesGuard } from 'src/commom/guards/roles.guard';
import { CsvService } from './csv.service';

@ApiTags('CSV')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('csv')
export class CsvController {
  constructor(private readonly csv: CsvService) {}

  @Get('export/pending')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Export PENDING tickets as CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv')
  async exportPending(@Res() res: Response) {
    const { filename, content } = await this.csv.exportPendingCsv();
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Post('auto-process')
  @Roles(Role.MANAGER)
  @ApiOperation({
    summary: 'Auto-processor (~30/30/30): receive CSV and return processed CSV',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @Header('Content-Type', 'text/csv')
  @UseInterceptors(FileInterceptor('file'))
  async autoProcess(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.csv.autoProcessCsv(file.buffer);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Post('import')
  @Roles('MANAGER')
  @ApiOperation({
    summary: 'Import CSV and update only in status: PENDING, OPEN, CLOSED',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.csv.importCsv(file.buffer, user.id);
  }
}
