import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Trust the first hop so req.ip resolves correctly behind a reverse proxy.
    // (Set NestJS to trust the proxy at the Express level.)
  });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

  const config = app.get(ConfigService);
  const webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';

  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(config.get('API_PORT') ?? 4000);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`BranV API listening on http://localhost:${port}/api`);
  logger.log(`CORS origin: ${webOrigin}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap BranV API', err);
  process.exit(1);
});
