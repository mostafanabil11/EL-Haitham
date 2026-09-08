import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  // Hosting platforms terminate TLS at a load balancer and forward the real
  // client address in X-Forwarded-For. Without this every request appears to
  // come from the proxy, which would make the rate limiter count the whole
  // internet as a single caller and lock everyone out at 60 requests a minute.
  // Exactly one hop is trusted: the platform's own proxy. Trusting the header
  // blindly would let a caller spoof their address and dodge the limit.
  if (configService.isProduction) {
    app.set('trust proxy', 1);
  }

  // Security Headers
  app.use(helmet());

  // Required to read the httpOnly accessToken/refreshToken cookies set by AuthController
  app.use(cookieParser());

  // CORS — must be concrete origins (not '*') since credentials: true requires it
  app.enableCors({
    origin: configService.frontendUrls,
    credentials: true,
  });

  // Global Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Zod Validation Pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // Dev/staging only: the generated docs describe every route, DTO shape and
  // auth requirement in the API, which is a map worth handing to an attacker
  // but not to the public.
  const isProduction = configService.isProduction;
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Teaching Platform API')
      .setDescription('API for the Arabic teaching platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  // 0.0.0.0 rather than the default loopback: a container's health check and
  // proxy reach the process from outside it, and a server bound only to
  // localhost is invisible to both.
  const port = configService.port;
  await app.listen(port, '0.0.0.0');

  if (isProduction) {
    console.log(`🚀 Application listening on port ${port}`);
  } else {
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📖 Swagger docs available at: http://localhost:${port}/api`);
  }
}

bootstrap();

