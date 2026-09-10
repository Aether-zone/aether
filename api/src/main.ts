import { ENV, JsonLogger } from '@aether-zone/organon';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import type { Env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // The console is served from another origin in development, so it reaches
    // this api from the browser as a cross-origin request.
    cors: true,
    // The application logger has to exist before the app does, so it is built
    // here rather than by a module; the module gets the same options.
    logger: new JsonLogger({
      level: process.env.LOG_LEVEL as never,
      base: { service: 'aether' },
    }),
  });

  /*
   * The environment comes from `ConfigModule`, which organon registers with
   * `envFilePath` — so the hand-rolled `process.loadEnvFile` loop that used to
   * live here is gone, along with the question of which of three files won.
   * `PORT` arrives validated, as a number rather than a string that looks
   * like one.
   */
  const env = app.get<Env>(ENV);

  await app.listen(env.PORT);
}

void bootstrap();
