import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { CommonModule, LogInterceptor } from './modules/common';
import * as cookieParser from 'cookie-parser';
const API_DEFAULT_PORT = 3000;
const API_DEFAULT_PREFIX = '/api/v1/';

async function bootstrap() {
  const app = await NestFactory.create(AppModule , {cors: true});
  app.use(cookieParser());
  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('cats')
    .addBearerAuth(
      { 
        // I was also testing it without prefix 'Bearer ' before the JWT
        description: `[just text field] Please enter token in following format: Bearer <JWT>`,
        name: 'Authorization',
        bearerFormat: 'Bearer', // I`ve tested not to use this field, but the result was the same
        scheme: 'Bearer',
        type: 'http', // I`ve attempted type: 'apiKey' too
        in: 'Header'
      },
      'access-token',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  app.setGlobalPrefix(process.env.API_PREFIX ?? API_DEFAULT_PREFIX);

  const logInterceptor = app.select(CommonModule).get(LogInterceptor);
  app.useGlobalInterceptors(logInterceptor);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
