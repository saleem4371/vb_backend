import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

   app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3000",
      "https://venuebook-psi.vercel.app"
    ],
    credentials: true,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });


  // ✅ Register multipart
  // await app.register(multipart as any, {
  //   limits: {
  //     fileSize: 5 * 1024 * 1024, // 5MB
  //   },
  // });
await app.register(multipart as any);
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
