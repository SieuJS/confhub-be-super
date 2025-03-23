import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { CommonModule, LogInterceptor } from './modules/common';

const API_DEFAULT_PORT = 3000;
const API_DEFAULT_PREFIX = '/api/v1/';

async function bootstrap() {
  const app = await NestFactory.create(AppModule , {cors: true});

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('cats')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  app.setGlobalPrefix(process.env.API_PREFIX ?? API_DEFAULT_PREFIX);

  const logInterceptor = app.select(CommonModule).get(LogInterceptor);
  app.useGlobalInterceptors(logInterceptor);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
