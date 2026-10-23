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
    { tipo: 'Por hora', duracionMinutos: 60 },
    { tipo: 'Diaria', duracionMinutos: 60 * 24 },
    { tipo: 'Mensual', duracionMinutos: 60 * 24 * 30 },
  ];
  const valores: Record<string, Record<string, number>> = {
    AUTO: { 'Por hora': 1500, Diaria: 12000, Mensual: 150000 },
    MOTO: { 'Por hora': 800, Diaria: 6000, Mensual: 80000 },
    CAMIONETA: { 'Por hora': 2200, Diaria: 18000, Mensual: 220000 },
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

  // Reservas pasadas del cliente con un pago de cada metodo y estado. Al ser pasadas no
  // ocupan cocheras en fechas futuras. Se identifican por la patente para no duplicarlas.
  const cliente = await prisma.usuario.findUniqueOrThrow({ where: { email: 'cliente@dsw.com' } });
  const cochera = await prisma.cochera.findFirstOrThrow({
    where: { playaId: playa.id },
    orderBy: { id: 'asc' },
  });
  const auto = vehiculos.find((tv) => tv.tipo === 'AUTO')!;
  const porHora = estadias.find((te) => te.tipo === 'Por hora')!;
  const reservasConPago = [
    { patente: 'SEED001', dia: 1, estado: 'PAGADA', metodo: 'EFECTIVO', estadoPago: 'APROBADO' },
    {
      patente: 'SEED002',
      dia: 2,
      estado: 'PAGADA',
      metodo: 'TRANSFERENCIA',
      estadoPago: 'APROBADO',
    },
    { patente: 'SEED003', dia: 3, estado: 'PAGADA', metodo: 'MERCADOPAGO', estadoPago: 'APROBADO' },
    {
      patente: 'SEED004',
      dia: 4,
      estado: 'ACTIVA',
      metodo: 'MERCADOPAGO',
      estadoPago: 'PENDIENTE',
    },
    {
      patente: 'SEED005',
      dia: 5,
      estado: 'ACTIVA',
      metodo: 'MERCADOPAGO',
      estadoPago: 'RECHAZADO',
    },
  ] as const;
  for (const r of reservasConPago) {
    // 2 horas de AUTO por hora
    const precioTotal = valores.AUTO['Por hora'] * 2;
    const datosReserva = {
      patente: r.patente,
      fechaInicio: new Date(`2026-09-0${r.dia}T13:00:00Z`),
      fechaFin: new Date(`2026-09-0${r.dia}T15:00:00Z`),
      precioTotal,
      estado: r.estado,
      usuarioId: cliente.id,
      cocheraId: cochera.id,
      tipoVehiculoId: auto.id,
      tipoEstadiaId: porHora.id,
    };
    const reserva =
      (await prisma.reserva.findFirst({ where: { patente: r.patente } })) ??
      (await prisma.reserva.create({ data: datosReserva }));
    const esMercadoPago = r.metodo === 'MERCADOPAGO';
    await prisma.pago.upsert({
      where: { reservaId: reserva.id },
      update: {},
      create: {
        fecha: datosReserva.fechaFin,
        metodo: r.metodo,
        estado: r.estadoPago,
        monto: precioTotal,
        reservaId: reserva.id,
        mpPreferenceId: esMercadoPago ? `seed-preferencia-${r.patente}` : null,
        mpPaymentId:
          esMercadoPago && r.estadoPago !== 'PENDIENTE' ? `seed-pago-${r.patente}` : null,
      },
    });
  }

  console.info(
    `Seed completo. Playa ${playa.sector} creada. Usuarios admin@dsw.com y cliente@dsw.com (password: dsw12345). ${reservasConPago.length} reservas con pagos de ejemplo`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
