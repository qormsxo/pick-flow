import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1730000000000 implements MigrationInterface {
  name = 'InitSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "display_name" varchar(80) NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'USER',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku" varchar(64) NOT NULL,
        "name" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "category" varchar(64) NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "tags" text[] NOT NULL DEFAULT '{}',
        "embedding" double precision[],
        "embedding_ready" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_products_sku" UNIQUE ("sku")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_products_category" ON "products" ("category")`);
    await queryRunner.query(`
      CREATE TABLE "user_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "client_event_id" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_user_events_client_event_id" UNIQUE ("client_event_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_events_user_created" ON "user_events" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "interest_vector" double precision[] NOT NULL,
        "category_weights" jsonb NOT NULL DEFAULT '{}',
        "event_count" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
