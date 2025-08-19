import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const cfg = new DocumentBuilder()
    .setTitle('Service Ticket – API')
    .setDescription('REST API of Service Ticket Management System')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-cron-secret',
        in: 'header',
        description: 'Secret to /automation/nightly',
      },
      'cron',
    )
    .build();

  const doc = SwaggerModule.createDocument(app, cfg);

  SwaggerModule.setup('docs', app, doc, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Service Ticket – API Docs',
  });
}
