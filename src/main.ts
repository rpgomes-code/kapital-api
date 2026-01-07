import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Required for Better Auth to handle raw request body
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.enableCors();

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Kapital API')
    .setDescription('Investment portfolio tracking and management API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Bearer token',
        in: 'header',
      },
      'bearer-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('brokers', 'Broker management endpoints')
    .addTag('accounts', 'Account management endpoints')
    .addTag('assets', 'Asset management endpoints')
    .addTag('transactions', 'Transaction management endpoints')
    .addTag('portfolio', 'Portfolio analysis endpoints')
    .addTag('watchlists', 'Watchlist management endpoints')
    .addTag('yahoo-finance', 'Yahoo Finance market data endpoints')
    .addTag('stonks', 'Stock search and quotes endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Expose OpenAPI JSON endpoint
  SwaggerModule.setup('api-docs', app, document);

  // Scalar API Reference - using URL to reference the OpenAPI spec
  app.use(
    '/docs',
    apiReference({
      url: '/api-docs-json',
      theme: 'purple',
    }),
  );

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 API running on: ${await app.getUrl()}`);
  console.log(`📚 API Docs (Scalar): ${await app.getUrl()}/docs`);
  console.log(`📋 OpenAPI JSON: ${await app.getUrl()}/api-docs`);
}
bootstrap();
