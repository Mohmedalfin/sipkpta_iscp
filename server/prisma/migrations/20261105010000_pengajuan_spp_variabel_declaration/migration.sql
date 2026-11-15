-- Draft only. Do not apply without separate database approval and preflight.
-- Nullable preserves existing and in-progress records; submit validation will require a value.
ALTER TABLE "pengajuan"
    ADD COLUMN "sudah_bayar_spp_variabel" BOOLEAN;
