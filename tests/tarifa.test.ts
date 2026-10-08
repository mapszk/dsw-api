import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const prismaMock = {
  tarifa: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tipoVehiculo: { findUnique: vi.fn() },
  tipoEstadia: { findUnique: vi.fn() },
};

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const tokenCliente = authHeader('CLIENTE', 2);

const tarifa = {
  id: 1,
  valor: new Prisma.Decimal('1500.50'),
  fechaDesde: new Date('2026-01-01T00:00:00Z'),
  tipoVehiculoId: 1,
  tipoEstadiaId: 1,
  tipoVehiculo: { id: 1, tipo: 'AUTO' },
  tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
};

const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60_000);

const body = {
  valor: 1500.5,
  fechaDesde: enUnMes.toISOString(),
  tipoVehiculoId: 1,
  tipoEstadiaId: 1,
};

describe('/api/tarifas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tipoVehiculo.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.tipoEstadia.findUnique.mockResolvedValue({ id: 1 });
  });

  it('lista las tarifas con el valor como numero', async () => {
    prismaMock.tarifa.findMany.mockResolvedValue([tarifa]);

    const res = await request(app).get('/api/tarifas').set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(res.body[0]).toEqual({
      id: 1,
      valor: 1500.5,
      fechaDesde: '2026-01-01T00:00:00.000Z',
      tipoVehiculo: { id: 1, tipo: 'AUTO' },
      tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
    });
  });

  it('busca la tarifa vigente a la fecha indicada', async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue(tarifa);

    const res = await request(app)
      .get('/api/tarifas/vigente?tipoVehiculoId=1&tipoEstadiaId=1&fecha=2026-06-01T00:00:00Z')
      .set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(prismaMock.tarifa.findFirst.mock.calls[0][0]).toMatchObject({
      where: { fechaDesde: { lte: new Date('2026-06-01T00:00:00Z') } },
      orderBy: { fechaDesde: 'desc' },
    });
  });

  it('responde 404 si no hay tarifa vigente', async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tarifas/vigente?tipoVehiculoId=1&tipoEstadiaId=1')
      .set('Authorization', admin);

    expect(res.status).toBe(404);
  });

  it('crea la tarifa', async () => {
    prismaMock.tarifa.create.mockResolvedValue(tarifa);

    const res = await request(app).post('/api/tarifas').set('Authorization', admin).send(body);

    expect(res.status).toBe(201);
    expect(res.body.valor).toBe(1500.5);
  });

  it('responde 400 si la tarifa nueva no es futura', async () => {
    const res = await request(app)
      .post('/api/tarifas')
      .set('Authorization', admin)
      .send({ ...body, fechaDesde: new Date().toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('La fecha desde debe ser futura');
    expect(prismaMock.tarifa.create).not.toHaveBeenCalled();
  });

  it('responde 404 si el tipo de vehiculo no existe', async () => {
    prismaMock.tipoVehiculo.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/tarifas').set('Authorization', admin).send(body);

    expect(res.status).toBe(404);
    expect(prismaMock.tarifa.create).not.toHaveBeenCalled();
  });

  it('responde 400 si el valor tiene mas de dos decimales o no es positivo', async () => {
    const decimales = await request(app)
      .post('/api/tarifas')
      .set('Authorization', admin)
      .send({ ...body, valor: 10.123 });
    const negativo = await request(app)
      .post('/api/tarifas')
      .set('Authorization', admin)
      .send({ ...body, valor: -5 });

    expect(decimales.status).toBe(400);
    expect(negativo.status).toBe(400);
  });

  describe('PATCH /api/tarifas/:id', () => {
    const futura = { ...tarifa, fechaDesde: new Date(Date.now() + 24 * 60 * 60_000) };

    it('modifica una tarifa que todavia no esta vigente', async () => {
      prismaMock.tarifa.findUnique.mockResolvedValue(futura);
      prismaMock.tarifa.update.mockResolvedValue({ ...futura, valor: new Prisma.Decimal(2000) });

      const res = await request(app)
        .patch('/api/tarifas/1')
        .set('Authorization', admin)
        .send({ valor: 2000 });

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe(2000);
    });

    it('responde 409 si la tarifa ya esta vigente', async () => {
      prismaMock.tarifa.findUnique.mockResolvedValue(tarifa);

      const res = await request(app)
        .patch('/api/tarifas/1')
        .set('Authorization', admin)
        .send({ valor: 2000 });

      expect(res.status).toBe(409);
      expect(prismaMock.tarifa.update).not.toHaveBeenCalled();
    });

    it('responde 400 si se mueve la fecha desde al pasado', async () => {
      prismaMock.tarifa.findUnique.mockResolvedValue(futura);

      const res = await request(app)
        .patch('/api/tarifas/1')
        .set('Authorization', admin)
        .send({ fechaDesde: '2020-01-01T00:00:00Z' });

      expect(res.status).toBe(400);
      expect(prismaMock.tarifa.update).not.toHaveBeenCalled();
    });
  });

  it('un cliente puede consultar la tarifa vigente pero no crear tarifas', async () => {
    prismaMock.tarifa.findFirst.mockResolvedValue(tarifa);

    const vigente = await request(app)
      .get('/api/tarifas/vigente?tipoVehiculoId=1&tipoEstadiaId=1')
      .set('Authorization', tokenCliente);
    const alta = await request(app)
      .post('/api/tarifas')
      .set('Authorization', tokenCliente)
      .send(body);

    expect(vigente.status).toBe(200);
    expect(alta.status).toBe(403);
  });

  describe('DELETE /api/tarifas/:id', () => {
    it('elimina una tarifa que todavia no esta vigente', async () => {
      prismaMock.tarifa.findUnique.mockResolvedValue({
        ...tarifa,
        fechaDesde: new Date(Date.now() + 24 * 60 * 60_000),
      });

      const res = await request(app).delete('/api/tarifas/1').set('Authorization', admin);

      expect(res.status).toBe(204);
      expect(prismaMock.tarifa.delete).toHaveBeenCalled();
    });

    it('responde 409 si la tarifa ya esta vigente', async () => {
      prismaMock.tarifa.findUnique.mockResolvedValue(tarifa);

      const res = await request(app).delete('/api/tarifas/1').set('Authorization', admin);

      expect(res.status).toBe(409);
      expect(prismaMock.tarifa.delete).not.toHaveBeenCalled();
    });
  });
});
