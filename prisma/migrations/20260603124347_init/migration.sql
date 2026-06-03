-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "preferred_channel" TEXT,
    "contact_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_agreements" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "total_amount_cents" INTEGER NOT NULL,
    "installments_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "debt_agreement_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "paid_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "external_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "idempotency_payload_hash" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_attempts" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "installment_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "skipped_reason" TEXT,
    "message" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "template_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "installment_id" UUID,
    "payment_id" UUID,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "external_reference" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_clinic_id_idx" ON "patients"("clinic_id");

-- CreateIndex
CREATE INDEX "patients_clinic_id_contact_status_idx" ON "patients"("clinic_id", "contact_status");

-- CreateIndex
CREATE UNIQUE INDEX "patients_clinic_id_email_key" ON "patients"("clinic_id", "email");

-- CreateIndex
CREATE INDEX "debt_agreements_clinic_id_idx" ON "debt_agreements"("clinic_id");

-- CreateIndex
CREATE INDEX "debt_agreements_clinic_id_status_idx" ON "debt_agreements"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "debt_agreements_clinic_id_patient_id_idx" ON "debt_agreements"("clinic_id", "patient_id");

-- CreateIndex
CREATE INDEX "installments_clinic_id_idx" ON "installments"("clinic_id");

-- CreateIndex
CREATE INDEX "installments_clinic_id_status_idx" ON "installments"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "installments_clinic_id_due_date_idx" ON "installments"("clinic_id", "due_date");

-- CreateIndex
CREATE INDEX "installments_clinic_id_status_due_date_idx" ON "installments"("clinic_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "installments_debt_agreement_id_installment_number_key" ON "installments"("debt_agreement_id", "installment_number");

-- CreateIndex
CREATE INDEX "payments_clinic_id_idx" ON "payments"("clinic_id");

-- CreateIndex
CREATE INDEX "payments_clinic_id_installment_id_idx" ON "payments"("clinic_id", "installment_id");

-- CreateIndex
CREATE INDEX "payments_clinic_id_paid_at_idx" ON "payments"("clinic_id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_clinic_id_idempotency_key_key" ON "payments"("clinic_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_clinic_id_external_reference_key" ON "payments"("clinic_id", "external_reference");

-- CreateIndex
CREATE INDEX "communication_attempts_clinic_id_idx" ON "communication_attempts"("clinic_id");

-- CreateIndex
CREATE INDEX "communication_attempts_clinic_id_status_idx" ON "communication_attempts"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "communication_attempts_clinic_id_scheduled_for_idx" ON "communication_attempts"("clinic_id", "scheduled_for");

-- CreateIndex
CREATE INDEX "communication_attempts_clinic_id_patient_id_created_at_idx" ON "communication_attempts"("clinic_id", "patient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_attempts_clinic_id_patient_id_installment_id__key" ON "communication_attempts"("clinic_id", "patient_id", "installment_id", "type");

-- CreateIndex
CREATE INDEX "payment_webhook_events_clinic_id_idx" ON "payment_webhook_events"("clinic_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_clinic_id_status_idx" ON "payment_webhook_events"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "payment_webhook_events_clinic_id_external_reference_idx" ON "payment_webhook_events"("clinic_id", "external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_agreements" ADD CONSTRAINT "debt_agreements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_debt_agreement_id_fkey" FOREIGN KEY ("debt_agreement_id") REFERENCES "debt_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_attempts" ADD CONSTRAINT "communication_attempts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_attempts" ADD CONSTRAINT "communication_attempts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_attempts" ADD CONSTRAINT "communication_attempts_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
