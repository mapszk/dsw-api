-- MetodoPago: se agrega ONLINE (pagos procesados por un proveedor externo).
-- TARJETA se mantiene para no alterar los pagos ya registrados; la API no la acepta en pagos nuevos
ALTER TYPE "MetodoPago" ADD VALUE 'ONLINE';

-- Estado del pago: los pagos ya registrados fueron manuales, asi que quedan APROBADOS
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
ALTER TABLE "pagos" ADD COLUMN "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE';
UPDATE "pagos" SET "estado" = 'APROBADO';

-- Datos del proveedor de los pagos online
ALTER TABLE "pagos" ADD COLUMN "proveedor" TEXT;
ALTER TABLE "pagos" ADD COLUMN "checkout_id" TEXT;
ALTER TABLE "pagos" ADD COLUMN "pago_externo_id" TEXT;
CREATE UNIQUE INDEX "pagos_proveedor_pago_externo_id_key" ON "pagos"("proveedor", "pago_externo_id");
