-- MetodoPago: se quita TARJETA (los pagos con tarjeta pasan a EFECTIVO) y se agrega MERCADOPAGO
UPDATE "pagos" SET "metodo" = 'EFECTIVO' WHERE "metodo" = 'TARJETA';
ALTER TYPE "MetodoPago" RENAME TO "MetodoPago_old";
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO');
ALTER TABLE "pagos" ALTER COLUMN "metodo" TYPE "MetodoPago" USING ("metodo"::text::"MetodoPago");
DROP TYPE "MetodoPago_old";

-- Estado del pago: los pagos ya registrados fueron manuales, asi que quedan APROBADOS
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
ALTER TABLE "pagos" ADD COLUMN "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE';
UPDATE "pagos" SET "estado" = 'APROBADO';

-- Datos de MercadoPago
ALTER TABLE "pagos" ADD COLUMN "mp_preference_id" TEXT;
ALTER TABLE "pagos" ADD COLUMN "mp_payment_id" TEXT;
CREATE UNIQUE INDEX "pagos_mp_payment_id_key" ON "pagos"("mp_payment_id");
