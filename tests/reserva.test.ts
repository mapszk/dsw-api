import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';

const tx = {
  cochera: { findUnique: vi.fn() },
  usuario: { findUnique: vi.fn() },
  tipoEstadia: { findUnique: vi.fn() },
  tipoVehiculo: { findUnique: vi.fn() },
  reserva: { findFirst: vi.fn(), create: vi.fn() },
  tarifa: { findFirst: vi.fn() },
};

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)) },
}));

const { app } = await import('../src/app.js');
const { calcularPrecio } = await import('../src/modules/reserva/reserva.service.js');

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
    tx.reserva.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));
  });

  it('crea la reserva con el precio calculado y la patente normalizada', async () => {
    const res = await request(app).post('/api/reservas').send(body);

    expect(res.status).toBe(201);
    expect(res.body.patente).toBe('AB123CD');
    expect(res.body.precioTotal).toBe('3000');
  });

  it('responde 409 si la cochera ya esta reservada en ese horario', async () => {
    tx.reserva.findFirst.mockResolvedValue({ id: 7 });

    const res = await request(app).post('/api/reservas').send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ reservaId: 7 });
    expect(tx.reserva.create).not.toHaveBeenCalled();
  });

  it('responde 409 si otra reserva simultanea aborta la transaccion', async () => {
    tx.reserva.create.mockRejectedValue(
      new Error('TransactionWriteConflict', { cause: { kind: 'TransactionWriteConflict' } }),
    );

    const res = await request(app).post('/api/reservas').send(body);

    expect(res.status).toBe(409);
  });

  it('responde 409 si la cochera esta inhabilitada', async () => {
    tx.cochera.findUnique.mockResolvedValue({ id: 1, estado: 'INHABILITADA' });

    const res = await request(app).post('/api/reservas').send(body);

    expect(res.status).toBe(409);
  });

  it('responde 409 si no hay tarifa vigente', async () => {
    tx.tarifa.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/reservas').send(body);

    expect(res.status).toBe(409);
  });

  it('responde 400 si la fecha de fin no es posterior a la de inicio', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .send({ ...body, fechaFin: body.fechaInicio });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fechaFin).toBeDefined();
  });

  it('responde 400 si la fecha de inicio esta en el pasado', async () => {
    const res = await request(app)
      .post('/api/reservas')
      .send({ ...body, fechaInicio: '2020-01-01T10:00:00Z', fechaFin: '2020-01-01T12:00:00Z' });

    expect(res.status).toBe(400);
  });
});
