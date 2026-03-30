import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  const frontendOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (isProd && frontendOrigins.length === 0) {
    throw new Error('FRONTEND_URL is required in production');
  }

  app.enableCors({
    origin: isProd
      ? frontendOrigins
      : frontendOrigins.length > 0
        ? frontendOrigins
        : true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const server = app.getHttpAdapter().getInstance();
  const enableSwagger = !isProd || process.env.ENABLE_SWAGGER === 'true';

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Truong Thanh API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      swaggerOptions: { persistAuthorization: true },
    });

    server.get('/', (_req, res) => res.redirect('/api/docs'));
  } else {
    server.get('/', (_req, res) => res.status(200).json({ status: 'ok' }));
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0'); // Listen on all network interfaces
  const logger = new Logger('Bootstrap');
  if (enableSwagger) {
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
    logger.log(`OpenAPI JSON: http://localhost:${port}/api-json`);
  }
  logger.log(`Root: http://localhost:${port}/`);
}
bootstrap();
