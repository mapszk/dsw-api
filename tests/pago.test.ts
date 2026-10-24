import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const db = vi.hoisted(() => ({
  pago: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  reserva: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  // SELECT ... FOR UPDATE de la reserva
  $queryRaw: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    ...db,
    // Con un callback es una transaccion interactiva; con un arreglo, una secuencial
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? arg(db) : Promise.all(arg as Promise<unknown>[]),
    ),
  },
}));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const tokenCliente = authHeader('CLIENTE', 2);

function pago(datos: Record<string, unknown> = {}) {
  return {
    id: 1,
    fecha: new Date('2026-10-20T15:00:00Z'),
    metodo: 'EFECTIVO',
    estado: 'APROBADO',
    monto: new Prisma.Decimal(3000),
    proveedor: null,
    checkoutId: null,
    pagoExternoId: null,
    reservaId: 10,
    reserva: { id: 10, patente: 'AB123CD' },
    ...datos,
  };
}

// Como Prisma, devuelve el monto como Decimal
function guardado({ data }: { data: Record<string, unknown> }) {
  return Promise.resolve(pago({ ...data, monto: new Prisma.Decimal(Number(data.monto ?? 3000)) }));
}

describe('/api/pagos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('solo lo usa el ADMIN', async () => {
    const res = await request(app).get('/api/pagos').set('Authorization', tokenCliente);

    expect(res.status).toBe(403);
  });

  it('lista los pagos filtrados por estado y metodo', async () => {
    db.pago.findMany.mockResolvedValue([pago()]);

    const res = await request(app)
      .get('/api/pagos?estado=APROBADO&metodo=EFECTIVO')
      .set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(db.pago.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'APROBADO', metodo: 'EFECTIVO' } }),
    );
    expect(res.body).toEqual([
      {
        id: 1,
        fecha: '2026-10-20T15:00:00.000Z',
        metodo: 'EFECTIVO',
        estado: 'APROBADO',
        monto: 3000,
        reservaId: 10,
        reserva: { id: 10, patente: 'AB123CD' },
      },
    ]);
  });

  it('filtra los pagos con tarjeta ya registrados', async () => {
    db.pago.findMany.mockResolvedValue([pago({ metodo: 'TARJETA' })]);

    const res = await request(app).get('/api/pagos?metodo=TARJETA').set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(res.body[0].metodo).toBe('TARJETA');
  });

  it('responde 400 con un filtro invalido', async () => {
    const res = await request(app).get('/api/pagos?estado=PAGADO').set('Authorization', admin);

    expect(res.status).toBe(400);
  });

  it('responde 404 si el pago no existe', async () => {
    db.pago.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/pagos/99').set('Authorization', admin);

    expect(res.status).toBe(404);
  });

  describe('POST', () => {
    const body = { metodo: 'TRANSFERENCIA', monto: 3000, reservaId: 10 };

    it('registra un pago manual APROBADO y deja la reserva PAGADA', async () => {
      db.reserva.findUnique.mockResolvedValue({ id: 10, estado: 'ACTIVA', pago: null });
      db.pago.create.mockImplementation(guardado);

      const res = await request(app).post('/api/pagos').set('Authorization', admin).send(body);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ metodo: 'TRANSFERENCIA', estado: 'APROBADO' });
      expect(db.reserva.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { estado: 'PAGADA' },
      });
    });

    // ONLINE lo crea el checkout; TARJETA solo queda en los pagos ya registrados
    it.each(['ONLINE', 'TARJETA'])('rechaza el metodo %s', async (metodo) => {
      const res = await request(app)
        .post('/api/pagos')
        .set('Authorization', admin)
        .send({ ...body, metodo });

      expect(res.status).toBe(400);
      expect(db.pago.create).not.toHaveBeenCalled();
    });

    it('responde 409 si la reserva no esta ACTIVA', async () => {
      db.reserva.findUnique.mockResolvedValue({ id: 10, estado: 'PENDIENTE', pago: null });

      const res = await request(app).post('/api/pagos').set('Authorization', admin).send(body);

      expect(res.status).toBe(409);
      expect(db.pago.create).not.toHaveBeenCalled();
    });

    it('responde 409 si la reserva ya tiene un pago aprobado', async () => {
      db.reserva.findUnique.mockResolvedValue({
        id: 10,
        estado: 'PAGADA',
        pago: { id: 1, estado: 'APROBADO' },
      });

      const res = await request(app).post('/api/pagos').set('Authorization', admin).send(body);

      expect(res.status).toBe(409);
    });
  });

  describe('PUT', () => {
    it('edita un pago manual sin tocar su estado', async () => {
      db.pago.findUnique.mockResolvedValue(pago());
      db.pago.update.mockImplementation(guardado);

      const res = await request(app)
        .put('/api/pagos/1')
        .set('Authorization', admin)
        .send({ monto: 2500, estado: 'RECHAZADO' });

      expect(res.status).toBe(200);
      expect(db.pago.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { monto: 2500 } }),
      );
    });

    it('responde 409 con un pago online', async () => {
      db.pago.findUnique.mockResolvedValue(pago({ metodo: 'ONLINE' }));

      const res = await request(app)
        .put('/api/pagos/1')
        .set('Authorization', admin)
        .send({ monto: 2500 });

      expect(res.status).toBe(409);
      expect(db.pago.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it.each(['EFECTIVO', 'TRANSFERENCIA'])(
      'borra un pago en %s y la reserva vuelve a ACTIVA',
      async (metodo) => {
        db.pago.findUnique.mockResolvedValue(pago({ metodo }));

        const res = await request(app).delete('/api/pagos/1').set('Authorization', admin);

        expect(res.status).toBe(204);
        expect(db.pago.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        expect(db.reserva.updateMany).toHaveBeenCalledWith({
          where: { id: 10, estado: 'PAGADA' },
          data: { estado: 'ACTIVA' },
        });
      },
    );

    // Los online quedan como historial del proveedor; los de tarjeta, como historial
    it.each([
      ['ONLINE', 'APROBADO'],
      ['ONLINE', 'PENDIENTE'],
      ['ONLINE', 'RECHAZADO'],
      ['TARJETA', 'APROBADO'],
    ])('responde 409 con un pago %s %s', async (metodo, estado) => {
      db.pago.findUnique.mockResolvedValue(pago({ metodo, estado }));

      const res = await request(app).delete('/api/pagos/1').set('Authorization', admin);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        'Solo se pueden eliminar pagos en efectivo o transferencia',
      );
      expect(db.pago.delete).not.toHaveBeenCalled();
      expect(db.reserva.updateMany).not.toHaveBeenCalled();
    });

    it('bloquea la reserva antes de leer el pago', async () => {
      db.pago.findUnique.mockResolvedValue(pago());

      await request(app).delete('/api/pagos/1').set('Authorization', admin);

      expect(db.$queryRaw).toHaveBeenCalled();
      // La primera lectura es la de obtenerPago; la que decide es la segunda, ya bloqueada
      expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        db.pago.findUnique.mock.invocationCallOrder[1],
      );
    });
  });
});
