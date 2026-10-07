import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const tiposVehiculo = ['AUTO', 'MOTO', 'CAMIONETA'];
  const tiposEstadia = [
    { tipo: 'HORA', duracionMinutos: 60 },
    { tipo: 'DIA', duracionMinutos: 60 * 24 },
    { tipo: 'MES', duracionMinutos: 60 * 24 * 30 },
  ];
  const valores: Record<string, Record<string, number>> = {
    AUTO: { HORA: 1500, DIA: 12000, MES: 150000 },
    MOTO: { HORA: 800, DIA: 6000, MES: 80000 },
    CAMIONETA: { HORA: 2200, DIA: 18000, MES: 220000 },
  };
  const fechaDesde = new Date('2026-01-01T00:00:00Z');

  for (const tipo of tiposVehiculo) {
    await prisma.tipoVehiculo.upsert({ where: { tipo }, update: {}, create: { tipo } });
  }
  for (const te of tiposEstadia) {
    await prisma.tipoEstadia.upsert({ where: { tipo: te.tipo }, update: {}, create: te });
  }

  const vehiculos = await prisma.tipoVehiculo.findMany();
  const estadias = await prisma.tipoEstadia.findMany();
  for (const tv of vehiculos) {
    for (const te of estadias) {
      await prisma.tarifa.upsert({
        where: {
          tipoVehiculoId_tipoEstadiaId_fechaDesde: {
            tipoVehiculoId: tv.id,
            tipoEstadiaId: te.id,
            fechaDesde,
          },
        },
        update: {},
        create: {
          tipoVehiculoId: tv.id,
          tipoEstadiaId: te.id,
          fechaDesde,
          valor: valores[tv.tipo][te.tipo],
        },
      });
    }
  }

  const playa = await prisma.playa.upsert({
    where: { sector: 'A' },
    update: {},
    create: {
      sector: 'A',
      cocheras: {
        create: [{ techada: true }, { techada: true }, { techada: false }, { techada: false }],
      },
    },
  });

  const usuarios = [
    { nombre: 'Administrador', dni: '00000000', email: 'admin@dsw.com', rol: 'ADMIN' as const },
    { nombre: 'Cliente Demo', dni: '11111111', email: 'cliente@dsw.com', rol: 'CLIENTE' as const },
  ];
  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password: await bcrypt.hash('dsw12345', 10) },
    });
  }

  console.info(
    `Seed completo. Playa ${playa.sector} creada. Usuarios admin@dsw.com y cliente@dsw.com (password: dsw12345)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
