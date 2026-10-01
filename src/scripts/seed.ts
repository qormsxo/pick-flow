import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProductsRepository } from '../catalog/products.repository';
import { sleep } from '../common/utils/sleep.util';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { SEED_PRODUCTS } from './seed-data';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = new Logger('Seed');
  app.useLogger(logger);

  try {
    const users = app.get(UsersService);
    const auth = app.get(AuthService);
    const catalog = app.get(CatalogService);
    const products = app.get(ProductsRepository);

    if (!(await users.findByEmail('admin@pickflow.dev'))) {
      await users.create({
        email: 'admin@pickflow.dev',
        passwordHash: await bcrypt.hash('Admin1234!', 10),
        displayName: 'Pick Flow Admin',
        role: UserRole.ADMIN,
      });
      logger.log('Created admin@pickflow.dev');
    }

    if (!(await users.findByEmail('demo@pickflow.dev'))) {
      await auth.register({
        email: 'demo@pickflow.dev',
        password: 'Demo1234!',
        displayName: '데모 유저',
      });
      logger.log('Created demo@pickflow.dev');
    }

    for (const product of SEED_PRODUCTS) {
      const existing = await products.findBySku(product.sku);
      if (existing) continue;
      await catalog.create(product);
      logger.log(`Queued embedding for ${product.sku}`);
    }

    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const all = await products.findAll();
      const ready = all.filter((item) => item.embeddingReady).length;
      if (all.length >= SEED_PRODUCTS.length && ready === all.length) {
        logger.log(`Seed complete. products=${all.length} embeddings=${ready}`);
        logger.log('demo login: demo@pickflow.dev / Demo1234!');
        logger.log('admin login: admin@pickflow.dev / Admin1234!');
        return;
      }
      await sleep(250);
    }
    throw new Error('Timed out waiting for product embeddings. Is Redis Stack running?');
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
