-- Draf aditif Fase 3. Tidak menghapus atau menimpa data dan indeks existing.
ALTER TABLE "auth_sessions"
ADD COLUMN "active_role_id" INTEGER,
ADD COLUMN "role_version" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "auth_sessions_active_role_id_idx" ON "auth_sessions"("active_role_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_role_id_fkey"
FOREIGN KEY ("active_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
