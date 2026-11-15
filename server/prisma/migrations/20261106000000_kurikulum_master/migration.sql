-- K3 master informasi kurikulum. Tidak mengubah tabel maupun data existing.
CREATE TABLE "kurikulum" (
    "id" SERIAL NOT NULL,
    "program_studi_id" INTEGER NOT NULL,
    "kode_kurikulum" VARCHAR(50) NOT NULL,
    "nama_kurikulum" VARCHAR(150) NOT NULL,
    "tahun_mulai_berlaku" SMALLINT NOT NULL,
    "keterangan" TEXT,
    "is_aktif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "kurikulum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kurikulum_program_studi_id_kode_kurikulum_key"
    ON "kurikulum"("program_studi_id", "kode_kurikulum");

ALTER TABLE "kurikulum" ADD CONSTRAINT "kurikulum_program_studi_id_fkey"
    FOREIGN KEY ("program_studi_id") REFERENCES "program_studi"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
