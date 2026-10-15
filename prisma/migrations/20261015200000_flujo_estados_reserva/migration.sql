-- Una reserva FINALIZADA siempre tenia su pago registrado: el estado pasa a llamarse PAGADA
ALTER TYPE "EstadoReserva" RENAME VALUE 'FINALIZADA' TO 'PAGADA';

-- La ocupacion de una cochera se calcula con las reservas en curso: se quita OCUPADA
UPDATE "cocheras" SET "estado" = 'DISPONIBLE' WHERE "estado" = 'OCUPADA';
ALTER TYPE "EstadoCochera" RENAME TO "EstadoCochera_old";
CREATE TYPE "EstadoCochera" AS ENUM ('DISPONIBLE', 'INHABILITADA');
ALTER TABLE "cocheras" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "cocheras" ALTER COLUMN "estado" TYPE "EstadoCochera" USING ("estado"::text::"EstadoCochera");
ALTER TABLE "cocheras" ALTER COLUMN "estado" SET DEFAULT 'DISPONIBLE';
DROP TYPE "EstadoCochera_old";
