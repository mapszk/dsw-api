import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const tx = {
  reserva: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  cochera: { findFirst: vi.fn() },
  tarifa: { findFirst: vi.fn() },
};

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)) },
}));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const duenio = authHeader('CLIENTE', 5);
const otroCliente = authHeader('CLIENTE', 6);

const manana = new Date(Date.now() + 24 * 60 * 60_000);
const enHoras = (horas: number) => new Date(manana.getTime() + horas * 60 * 60_000);

const nuevasFechas = { fechaInicio: enHoras(24), fechaFin: enHoras(26) };
const body = {
  fechaInicio: nuevasFechas.fechaInicio.toISOString(),
  fechaFin: nuevasFechas.fechaFin.toISOString(),
};

const cochera = { id: 1, techada: true, estado: 'DISPONIBLE', playaId: 1 };

const reservaPendiente = {
  id: 3,
  estado: 'PENDIENTE',
  usuarioId: 5,
  cocheraId: 1,
  tipoVehiculoId: 1,
  tipoEstadiaId: 1,
  fechaInicio: manana,
  fechaFin: enHoras(3),
  cochera,
  tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
};

function reprogramar(token = duenio, datos: object = body) {
  return request(app).post('/api/reservas/3/reprogramar').set('Authorization', token).send(datos);
}

describe('POST /api/reservas/:id/reprogramar (CU3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.reserva.findUnique.mockResolvedValue(reservaPendiente);
    tx.reserva.findFirst.mockResolvedValue(null);
    tx.tarifa.findFirst.mockResolvedValue({ valor: new Prisma.Decimal(1000) });
    tx.reserva.update.mockImplementation(({ data }) =>
      Promise.resolve({
        ...reservaPendiente,
        ...data,
        patente: 'AB123CD',
        usuario: { id: 5, nombre: 'Cliente', dni: '1', email: 'c@dsw.com', telefono: null },
        cochera: { ...cochera, id: data.cocheraId, playa: { id: 1, sector: 'A' } },
        tipoVehiculo: { id: 1, tipo: 'AUTO' },
        pago: null,
      }),
    );
  });

  it('mantiene la cochera si sigue libre y recalcula el precio', async () => {
    const res = await reprogramar();

    expect(res.status).toBe(200);
    // Ignora la propia reserva al buscar solapamientos
    expect(tx.reserva.findFirst.mock.calls[0][0].where).toMatchObject({
      cocheraId: 1,
      id: { not: 3 },
    });
    expect(tx.cochera.findFirst).not.toHaveBeenCalled();
    const { data } = tx.reserva.update.mock.calls[0][0];
    expect(data).toMatchObject({ ...nuevasFechas, cocheraId: 1 });
    // 2 horas a $1000 la hora
    expect(data.precioTotal.toString()).toBe('2000');
  });

  it('usa la tarifa vigente a la nueva fecha de inicio', async () => {
    await reprogramar();

    expect(tx.tarifa.findFirst.mock.calls[0][0].where).toEqual({
      tipoVehiculoId: 1,
      tipoEstadiaId: 1,
      fechaDesde: { lte: nuevasFechas.fechaInicio },
    });
  });

  it('reasigna a otra cochera de la misma playa y techo si la actual esta ocupada', async () => {
    tx.reserva.findFirst.mockResolvedValue({ id: 9 });
    tx.cochera.findFirst.mockResolvedValue({ id: 2 });

    const res = await reprogramar();

    expect(res.status).toBe(200);
    expect(tx.cochera.findFirst.mock.calls[0][0].where).toMatchObject({
      id: { not: 1 },
      playaId: 1,
      techada: true,
      estado: { not: 'INHABILITADA' },
    });
    expect(tx.reserva.update.mock.calls[0][0].data.cocheraId).toBe(2);
    expect(res.body.cochera.id).toBe(2);
  });

  it('reasigna si la cochera actual quedo inhabilitada', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      ...reservaPendiente,
      cochera: { ...cochera, estado: 'INHABILITADA' },
    });
    tx.cochera.findFirst.mockResolvedValue({ id: 2 });

    const res = await reprogramar();

    expect(res.status).toBe(200);
    expect(tx.reserva.update.mock.calls[0][0].data.cocheraId).toBe(2);
  });

  it('responde 409 si no hay ninguna cochera libre', async () => {
    tx.reserva.findFirst.mockResolvedValue({ id: 9 });
    tx.cochera.findFirst.mockResolvedValue(null);

    const res = await reprogramar();

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('No hay cocheras disponibles en ese horario');
    expect(tx.reserva.update).not.toHaveBeenCalled();
  });

  it('responde 409 si no hay tarifa vigente a la nueva fecha', async () => {
    tx.tarifa.findFirst.mockResolvedValue(null);

    const res = await reprogramar();

    expect(res.status).toBe(409);
    expect(tx.reserva.update).not.toHaveBeenCalled();
  });

  it('responde 409 si la reserva no esta pendiente', async () => {
    tx.reserva.findUnique.mockResolvedValue({ ...reservaPendiente, estado: 'ACTIVA' });

    const res = await reprogramar();

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Solo se pueden reprogramar reservas pendientes');
  });

  it('responde 404 si un cliente reprograma una reserva ajena', async () => {
    const res = await reprogramar(otroCliente);

    expect(res.status).toBe(404);
    expect(tx.reserva.update).not.toHaveBeenCalled();
  });

  it('permite al admin reprogramar la reserva de cualquier cliente', async () => {
    const res = await reprogramar(admin);

    expect(res.status).toBe(200);
  });

  it('responde 400 si la nueva fecha de inicio esta en el pasado', async () => {
    const res = await reprogramar(duenio, {
      fechaInicio: '2020-01-01T10:00:00Z',
      fechaFin: '2020-01-01T12:00:00Z',
    });

    expect(res.status).toBe(400);
    expect(tx.reserva.findUnique).not.toHaveBeenCalled();
  });

  it('responde 400 si la fecha de fin no es posterior a la de inicio', async () => {
    const res = await reprogramar(duenio, { ...body, fechaFin: body.fechaInicio });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fechaFin).toBeDefined();
  });
});
