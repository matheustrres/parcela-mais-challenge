/*
  Warnings:

  - Added the required column `payload_hash` to the `payment_webhook_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment_webhook_events" ADD COLUMN     "error_code" TEXT,
ADD COLUMN     "payload_hash" TEXT NOT NULL,
ADD COLUMN     "retryable" BOOLEAN;

-- RenameIndex
ALTER INDEX "communication_attempts_clinic_id_patient_id_installment_id__cha" RENAME TO "communication_attempts_clinic_id_patient_id_installment_id__key";
