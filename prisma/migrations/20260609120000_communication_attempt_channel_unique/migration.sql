DROP INDEX "communication_attempts_clinic_id_patient_id_installment_id__key";

CREATE UNIQUE INDEX "communication_attempts_clinic_id_patient_id_installment_id__channel_key"
ON "communication_attempts"(
  "clinic_id",
  "patient_id",
  "installment_id",
  "type",
  "channel"
);
