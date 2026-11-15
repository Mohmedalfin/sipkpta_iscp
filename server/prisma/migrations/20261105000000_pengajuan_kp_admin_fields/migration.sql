-- Draft only. Do not apply without a separate approval and database preflight.
-- Add category-level Berkas examination and an explicit declaration timestamp.
ALTER TABLE "pengajuan"
    ADD COLUMN "status_pemeriksaan_berkas" VARCHAR(30) NOT NULL DEFAULT 'BELUM_DIPERIKSA',
    ADD COLUMN "catatan_pemeriksaan_berkas" TEXT,
    ADD COLUMN "diperiksa_berkas_oleh_user_id" INTEGER,
    ADD COLUMN "diperiksa_berkas_at" TIMESTAMPTZ(6),
    ADD COLUMN "pernyataan_kebenaran_disetujui_at" TIMESTAMPTZ(6);

CREATE INDEX "pengajuan_diperiksa_berkas_oleh_user_id_idx" ON "pengajuan"("diperiksa_berkas_oleh_user_id");

ALTER TABLE "pengajuan"
    ADD CONSTRAINT "pengajuan_diperiksa_berkas_oleh_user_id_fkey"
    FOREIGN KEY ("diperiksa_berkas_oleh_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- The regular-active duplicate guard is deferred until its status/jalur predicate
-- is agreed and existing rows have passed a read-only duplicate preflight.
