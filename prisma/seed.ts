import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const tiposVehiculo = [
    { tipo: 'AUTO', ajuste: 1 },
    { tipo: 'MOTO', ajuste: 0.5 },
    { tipo: 'CAMIONETA', ajuste: 1.5 },
  ];
  const tiposEstadia = ['HORA', 'DIA', 'MES'];
  const preciosBase: Record<string, number> = { HORA: 1500, DIA: 12000, MES: 150000 };

  for (const tv of tiposVehiculo) {
    await prisma.tipoVehiculo.upsert({ where: { tipo: tv.tipo }, update: {}, create: tv });
  }
  for (const tipo of tiposEstadia) {
    await prisma.tipoEstadia.upsert({ where: { tipo }, update: {}, create: { tipo } });
  }

  const vehiculos = await prisma.tipoVehiculo.findMany();
  const estadias = await prisma.tipoEstadia.findMany();
  for (const tv of vehiculos) {
    for (const te of estadias) {
      await prisma.tarifa.upsert({
        where: { tipoVehiculoId_tipoEstadiaId: { tipoVehiculoId: tv.id, tipoEstadiaId: te.id } },
        update: {},
        create: { tipoVehiculoId: tv.id, tipoEstadiaId: te.id, precio: preciosBase[te.tipo] },
      });
    }
  }

  const playa = await prisma.playa.upsert({
    where: { sector: 'A' },
    update: {},
    create: {
      sector: 'A',
      cocheras: { create: [{ techada: true }, { techada: true }, { techada: false }] },
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'admin@dsw.com' },
    update: {},
    create: { email: 'admin@dsw.com', password: await bcrypt.hash('admin123', 10), rol: 'ADMIN' },
  });

  console.info(`Seed completo. Playa ${playa.sector} creada. Usuario admin@dsw.com / admin123`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
