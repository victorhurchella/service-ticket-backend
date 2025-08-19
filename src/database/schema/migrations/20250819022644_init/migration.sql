-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ASSOCIATE', 'MANAGER');

-- CreateEnum
CREATE TYPE "public"."Severity" AS ENUM ('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'EASY');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('DRAFT', 'REVIEW', 'PENDING', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "severity" "public"."Severity" NOT NULL,
    "ai_suggested_severity" "public"."Severity",
    "status" "public"."Status" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets_history" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" UUID NOT NULL,
    "user_id" UUID,
    "from_status" "public"."Status",
    "to_status" "public"."Status",
    "from_severity" "public"."Severity",
    "to_severity" "public"."Severity",
    "reason" VARCHAR(500),

    CONSTRAINT "tickets_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets_sequence" (
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,

    CONSTRAINT "tickets_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "public"."tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "public"."tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_severity_idx" ON "public"."tickets"("severity");

-- CreateIndex
CREATE INDEX "tickets_due_date_idx" ON "public"."tickets"("due_date");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "public"."tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_created_by_id_idx" ON "public"."tickets"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_year_sequence_key" ON "public"."tickets"("year", "sequence");

-- CreateIndex
CREATE INDEX "tickets_history_ticket_id_idx" ON "public"."tickets_history"("ticket_id");

-- CreateIndex
CREATE INDEX "tickets_history_user_id_idx" ON "public"."tickets_history"("user_id");

-- CreateIndex
CREATE INDEX "tickets_history_created_at_idx" ON "public"."tickets_history"("created_at");

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets_history" ADD CONSTRAINT "tickets_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets_history" ADD CONSTRAINT "tickets_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
