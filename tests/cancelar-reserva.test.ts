import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const tx = {
  reserva: { update: vi.fn() },
  cochera: { update: vi.fn() },
};

const reserva = { findUnique: vi.fn(), delete: vi.fn() };

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)), reserva },
}));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const duenio = authHeader('CLIENTE', 5);
const otroCliente = authHeader('CLIENTE', 6);

function reservaEn(estado: string) {
  return {
    id: 3,
    patente: 'AB123CD',
    fechaInicio: new Date('2099-01-10T10:00:00Z'),
    fechaFin: new Date('2099-01-10T12:00:00Z'),
    precioTotal: new Prisma.Decimal(3000),
    estado,
    usuarioId: 5,
    usuario: { id: 5, nombre: 'Cliente', dni: '1', email: 'c@dsw.com', telefono: null },
    cochera: { id: 1, techada: true, estado: 'DISPONIBLE', playa: { id: 1, sector: 'A' } },
    tipoVehiculo: { id: 1, tipo: 'AUTO' },
    tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
    pago: null,
  };
}

function cancelar(token: string) {
  return request(app).post('/api/reservas/3/cancelar').set('Authorization', token);
}

describe('POST /api/reservas/:id/cancelar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.reserva.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...reservaEn('PENDIENTE'), ...data }),
    );
  });

  it('un cliente cancela su reserva pendiente y queda en el historial', async () => {
    reserva.findUnique.mockResolvedValue(reservaEn('PENDIENTE'));

    const res = await cancelar(duenio);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CANCELADA');
    expect(tx.reserva.update.mock.calls[0][0]).toMatchObject({
      where: { id: 3 },
      data: { estado: 'CANCELADA' },
    });
    expect(reserva.delete).not.toHaveBeenCalled();
    expect(tx.cochera.update).not.toHaveBeenCalled();
  });

  it('responde 404 si un cliente cancela una reserva ajena', async () => {
    reserva.findUnique.mockResolvedValue(reservaEn('PENDIENTE'));

    const res = await cancelar(otroCliente);

    expect(res.status).toBe(404);
    expect(tx.reserva.update).not.toHaveBeenCalled();
  });

  it('un cliente no puede cancelar una reserva activa', async () => {
    reserva.findUnique.mockResolvedValue(reservaEn('ACTIVA'));

    const res = await cancelar(duenio);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Solo se pueden cancelar reservas pendientes');
  });

  it('el admin cancela una reserva activa y libera la cochera', async () => {
    reserva.findUnique.mockResolvedValue(reservaEn('ACTIVA'));

    const res = await cancelar(admin);

    expect(res.status).toBe(200);
    expect(tx.cochera.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: 'DISPONIBLE' },
    });
    expect(tx.reserva.update.mock.calls[0][0].data).toEqual({ estado: 'CANCELADA' });
  });

  it.each(['FINALIZADA', 'CANCELADA'])('responde 409 si la reserva esta %s', async (estado) => {
    reserva.findUnique.mockResolvedValue(reservaEn(estado));

    const res = await cancelar(admin);

    expect(res.status).toBe(409);
    expect(tx.reserva.update).not.toHaveBeenCalled();
  });

  it('responde 401 sin sesion', async () => {
    const res = await request(app).post('/api/reservas/3/cancelar');

    expect(res.status).toBe(401);
  });

  it('un cliente no puede eliminar una reserva, ni siquiera cancelada', async () => {
    const res = await request(app).delete('/api/reservas/3').set('Authorization', duenio);

    expect(res.status).toBe(403);
    expect(reserva.delete).not.toHaveBeenCalled();
  });

  it('el admin puede eliminar una reserva cancelada', async () => {
    reserva.findUnique.mockResolvedValue(reservaEn('CANCELADA'));
    reserva.delete.mockResolvedValue({});

    const res = await request(app).delete('/api/reservas/3').set('Authorization', admin);

    expect(res.status).toBe(204);
  });
});
