import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const tx = {
  cochera: { findUnique: vi.fn() },
  usuario: { findUnique: vi.fn() },
  tipoEstadia: { findUnique: vi.fn() },
  tipoVehiculo: { findUnique: vi.fn() },
  reserva: { findFirst: vi.fn(), create: vi.fn() },
  tarifa: { findFirst: vi.fn() },
};

const reserva = { findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() };

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)), reserva },
}));

const { app } = await import('../src/app.js');
const { calcularPrecio } = await import('../src/modules/reserva/reserva.service.js');

const admin = authHeader('ADMIN');
const tokenCliente = authHeader('CLIENTE', 5);

const manana = new Date(Date.now() + 24 * 60 * 60_000);
const enHoras = (horas: number) => new Date(manana.getTime() + horas * 60 * 60_000);

const body = {
  patente: 'ab 123 cd',
  fechaInicio: manana.toISOString(),
  fechaFin: enHoras(3).toISOString(),
  usuarioId: 1,
  cocheraId: 1,
  tipoVehiculoId: 1,
  tipoEstadiaId: 1,
};

describe('calcularPrecio', () => {
  const valor = new Prisma.Decimal('1500.50');

  it('multiplica la tarifa por las unidades exactas', () => {
    expect(calcularPrecio(valor, manana, enHoras(3), 60).toString()).toBe('4501.5');
  });

  it('cobra una unidad completa si sobran minutos', () => {
    expect(calcularPrecio(valor, manana, enHoras(3.1), 60).toString()).toBe('6002');
  });
});

describe('POST /api/reservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.cochera.findUnique.mockResolvedValue({ id: 1, estado: 'DISPONIBLE' });
    tx.usuario.findUnique.mockResolvedValue({ id: 1, rol: 'CLIENTE' });
    tx.tipoEstadia.findUnique.mockResolvedValue({ id: 1, duracionMinutos: 60 });
    tx.tipoVehiculo.findUnique.mockResolvedValue({ id: 1 });
    tx.reserva.findFirst.mockResolvedValue(null);
    tx.tarifa.findFirst.mockResolvedValue({ valor: new Prisma.Decimal(1000) });
    tx.reserva.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 1,
        ...data,
        estado: 'PENDIENTE',
        usuario: { id: 1, nombre: 'Cliente', dni: '1', email: 'c@dsw.com', telefono: null },
        cochera: { id: 1, techada: true, estado: 'DISPONIBLE', playa: { id: 1, sector: 'A' } },
        tipoVehiculo: { id: 1, tipo: 'AUTO' },
        tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
        pago: null,
      }),
    );
  });

  it('crea la reserva con el precio calculado y la patente normalizada', async () => {
    const res = await request(app).post('/api/reservas').set('Authorization', admin).send(body);

    expect(res.status).toBe(201);
    expect(res.body.patente).toBe('AB123CD');
    expect(res.body.precioTotal).toBe(3000);
    expect(res.body.usuario).not.toHaveProperty('password');
  });

  it('responde 409 si la cochera ya esta reservada en ese horario', async () => {
    tx.reserva.findFirst.mockResolvedValue({ id: 7 });

    const res = await request(app).post('/api/reservas').set('Authorization', admin).send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reservaId: 7 });
    expect(tx.reserva.create).not.toHaveBeenCalled();
  });

  it('responde 409 si otra reserva simultanea aborta la transaccion', async () => {
    tx.reserva.create.mockRejectedValue(
      new Error('TransactionWriteConflict', { cause: { kind: 'TransactionWriteConflict' } }),
    );

    const res = await request(app).post('/api/reservas').set('Authorization', admin).send(body);

    expect(res.status).toBe(409);
  });

  it('responde 409 si la cochera esta inhabilitada', async () => {
    tx.cochera.findUnique.mockResolvedValue({ id: 1, estado: 'INHABILITADA' });

    const res = await request(app).post('/api/reservas').set('Authorization', admin).send(body);

    expect(res.status).toBe(409);
  });

  it('responde 409 si no hay tarifa vigente', async () => {
    tx.tarifa.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/reservas').set('Authorization', admin).send(body);

    expect(res.status).toBe(409);
  });

  it('responde 400 si la fecha de fin no es posterior a la de inicio', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', admin)
      .send({ ...body, fechaFin: body.fechaInicio });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fechaFin).toBeDefined();
  });

  it('responde 400 si la fecha de inicio esta en el pasado', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', admin)
      .send({ ...body, fechaInicio: '2020-01-01T10:00:00Z', fechaFin: '2020-01-01T12:00:00Z' });

    expect(res.status).toBe(400);
  });
});

describe('Reservas segun el rol', () => {
  const reservaDe = (usuarioId: number) => ({
    id: 3,
    patente: 'AB123CD',
    fechaInicio: manana,
    fechaFin: enHoras(3),
    precioTotal: new Prisma.Decimal(3000),
    estado: 'PENDIENTE',
    usuarioId,
    usuario: { id: usuarioId, nombre: 'Cliente', dni: '1', email: 'c@dsw.com', telefono: null },
    cochera: { id: 1, techada: true, estado: 'DISPONIBLE', playa: { id: 1, sector: 'A' } },
    tipoVehiculo: { id: 1, tipo: 'AUTO' },
    tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
    pago: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde 401 sin token', async () => {
    const res = await request(app).get('/api/reservas');

    expect(res.status).toBe(401);
  });

  it('un cliente lista solo sus reservas aunque pida las de otro', async () => {
    reserva.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/reservas?usuarioId=1&estado=PENDIENTE')
      .set('Authorization', tokenCliente);

    expect(res.status).toBe(200);
    expect(reserva.findMany.mock.calls[0][0].where).toEqual({ usuarioId: 5, estado: 'PENDIENTE' });
  });

  it('un admin puede filtrar por cualquier usuario', async () => {
    reserva.findMany.mockResolvedValue([]);

    await request(app).get('/api/reservas?usuarioId=1').set('Authorization', admin);

    expect(reserva.findMany.mock.calls[0][0].where).toEqual({ usuarioId: 1 });
  });

  it('un cliente ve el detalle de su reserva', async () => {
    reserva.findUnique.mockResolvedValue(reservaDe(5));

    const res = await request(app).get('/api/reservas/3').set('Authorization', tokenCliente);

    expect(res.status).toBe(200);
  });

  it('responde 404 si un cliente pide la reserva de otro', async () => {
    reserva.findUnique.mockResolvedValue(reservaDe(1));

    const res = await request(app).get('/api/reservas/3').set('Authorization', tokenCliente);

    expect(res.status).toBe(404);
  });

  it('un cliente reserva a su nombre aunque envie otro usuarioId', async () => {
    tx.cochera.findUnique.mockResolvedValue({ id: 1, estado: 'DISPONIBLE' });
    tx.usuario.findUnique.mockResolvedValue({ id: 5, rol: 'CLIENTE' });
    tx.tipoEstadia.findUnique.mockResolvedValue({ id: 1, duracionMinutos: 60 });
    tx.tipoVehiculo.findUnique.mockResolvedValue({ id: 1 });
    tx.reserva.findFirst.mockResolvedValue(null);
    tx.tarifa.findFirst.mockResolvedValue({ valor: new Prisma.Decimal(1000) });
    tx.reserva.create.mockResolvedValue(reservaDe(5));

    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', tokenCliente)
      .send({ ...body, usuarioId: 1 });

    expect(res.status).toBe(201);
    expect(tx.usuario.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(tx.reserva.create.mock.calls[0][0].data.usuarioId).toBe(5);
  });

  it('responde 400 si un admin no indica el usuario', async () => {
    const sinUsuario = { ...body, usuarioId: undefined };

    const res = await request(app)
      .post('/api/reservas')
      .set('Authorization', admin)
      .send(sinUsuario);

    expect(res.status).toBe(400);
    expect(tx.reserva.create).not.toHaveBeenCalled();
  });

  it('responde 403 si un cliente intenta eliminar una reserva', async () => {
    const res = await request(app).delete('/api/reservas/3').set('Authorization', tokenCliente);

    expect(res.status).toBe(403);
    expect(reserva.delete).not.toHaveBeenCalled();
  });
});
