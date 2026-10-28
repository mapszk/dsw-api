
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const tiposVehiculo = ['AUTO', 'MOTO', 'CAMIONETA'];

  const tiposEstadia = [
    { tipo: 'Por hora', duracionMinutos: 60 },
    { tipo: 'Diaria', duracionMinutos: 60 * 24 },
    { tipo: 'Mensual', duracionMinutos: 60 * 24 * 30 },
  ];

  const valores: Record<string, Record<string, number>> = {
    AUTO: {
      'Por hora': 1500,
      Diaria: 12000,
      Mensual: 150000,
    },
    MOTO: {
      'Por hora': 800,
      Diaria: 6000,
      Mensual: 80000,
    },
    CAMIONETA: {
      'Por hora': 2200,
      Diaria: 18000,
      Mensual: 220000,
    },
  };

  const fechaDesde = new Date('2026-01-01T00:00:00Z');

  // Crear o conservar los tipos de vehículo del seed.
  for (const tipo of tiposVehiculo) {
    await prisma.tipoVehiculo.upsert({
      where: { tipo },
      update: {},
      create: { tipo },
    });
  }

  // Crear o conservar los tipos de estadía del seed.
  for (const te of tiposEstadia) {
    await prisma.tipoEstadia.upsert({
      where: { tipo: te.tipo },
      update: {},
      create: te,
    });
  }

  // Trabajar solamente con los tipos definidos en este seed.
  const vehiculos = await prisma.tipoVehiculo.findMany({
    where: {
      tipo: { in: tiposVehiculo },
    },
  });

  const estadias = await prisma.tipoEstadia.findMany({
    where: {
      tipo: { in: tiposEstadia.map((te) => te.tipo) },
    },
  });

  // Crear las tarifas sin afectar otros tipos de la base.
  for (const tv of vehiculos) {
    for (const te of estadias) {
      const valor = valores[tv.tipo]?.[te.tipo];

      if (valor === undefined) {
        throw new Error(
          `No existe una tarifa configurada para ${tv.tipo} / ${te.tipo}`,
        );
      }

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
          valor,
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
        create: [
          { techada: true },
          { techada: true },
          { techada: false },
          { techada: false },
        ],
      },
    },
  });

  const usuarios = [
    {
      nombre: 'Administrador',
      dni: '00000000',
      email: 'admin@dsw.com',
      rol: 'ADMIN' as const,
    },
    {
      nombre: 'Cliente Demo',
      dni: '11111111',
      email: 'cliente@dsw.com',
      rol: 'CLIENTE' as const,
    },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        password: await bcrypt.hash('dsw12345', 10),
      },
    });
  }

  console.info(
    `Seed completo. Playa ${playa.sector} creada. ` +
      `Usuarios admin@dsw.com y cliente@dsw.com ` +
      `(password: dsw12345).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
