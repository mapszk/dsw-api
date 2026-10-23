import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const db = vi.hoisted(() => ({
  pago: { upsert: vi.fn(), update: vi.fn() },
  reserva: { findUnique: vi.fn(), update: vi.fn() },
  // SELECT ... FOR UPDATE de la reserva
  $queryRaw: vi.fn(),
}));

const mp = vi.hoisted(() => ({ crearPreferencia: vi.fn(), obtenerPago: vi.fn() }));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { ...db, $transaction: vi.fn((callback: (tx: typeof db) => unknown) => callback(db)) },
}));

// Se reemplaza el SDK: los tests no llaman a MercadoPago
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class {},
  Preference: class {
    create = mp.crearPreferencia;
  },
  Payment: class {
    get = mp.obtenerPago;
  },
}));

const { app } = await import('../src/app.js');

const SECRETO = 'secreto-del-webhook';
env.MP_ACCESS_TOKEN = 'TEST-token';
env.MP_WEBHOOK_SECRET = SECRETO;

const admin = authHeader('ADMIN');
const duenio = authHeader('CLIENTE', 5);
const otroCliente = authHeader('CLIENTE', 6);

function reserva(datos: Record<string, unknown> = {}) {
  return {
    id: 3,
    patente: 'AB123CD',
    fechaInicio: new Date('2099-01-10T10:00:00Z'),
    fechaFin: new Date('2099-01-10T12:00:00Z'),
    estado: 'ACTIVA',
    precioTotal: new Prisma.Decimal(3000),
    usuarioId: 5,
    usuario: { id: 5, nombre: 'Cliente', dni: '1', email: 'c@dsw.com', telefono: null },
    cochera: { id: 1, techada: true, estado: 'DISPONIBLE', playa: { id: 1, sector: 'A' } },
    tipoVehiculo: { id: 1, tipo: 'AUTO' },
    tipoEstadia: { id: 1, tipo: 'HORA', duracionMinutos: 60 },
    pago: null,
    ...datos,
  };
}

function pagoOnline(datos: Record<string, unknown> = {}) {
  return {
    id: 9,
    fecha: new Date('2026-10-20T15:00:00Z'),
    metodo: 'ONLINE',
    estado: 'PENDIENTE',
    monto: new Prisma.Decimal(3000),
    proveedor: 'MERCADOPAGO',
    checkoutId: 'pref-1',
    pagoExternoId: null,
    reservaId: 3,
    ...datos,
  };
}

/** Header x-signature como lo arma MP */
function firmar(dataId: string, requestId = 'req-1', ts = '1700000000') {
  const v1 = createHmac('sha256', SECRETO)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

function aviso(dataId = '123', headers = firmar(dataId)) {
  return request(app)
    .post(`/api/webhooks/mercadopago?data.id=${dataId}&type=payment`)
    .set(headers)
    .send({ type: 'payment', data: { id: dataId } });
}

describe('POST /api/reservas/:id/pagar con metodo ONLINE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mp.crearPreferencia.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp/checkout',
      sandbox_init_point: 'https://sandbox.mp/checkout',
    });
  });

  it('crea la preferencia con el precio de la reserva y deja el pago PENDIENTE', async () => {
    db.reserva.findUnique.mockResolvedValue(reserva());

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      // El monto del body se ignora
      .send({ metodo: 'ONLINE', monto: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, initPoint: 'https://sandbox.mp/checkout' });
    expect(mp.crearPreferencia).toHaveBeenCalledWith({
      body: expect.objectContaining({
        items: [expect.objectContaining({ unit_price: 3000, quantity: 1 })],
        external_reference: '3',
        back_urls: {
          success: `${env.FRONTEND_URL}/pago/exito`,
          failure: `${env.FRONTEND_URL}/pago/fallo`,
          pending: `${env.FRONTEND_URL}/pago/pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${env.API_PUBLIC_URL}/api/webhooks/mercadopago`,
        expires: true,
        expiration_date_to: expect.any(String),
      }),
    });
    expect(db.pago.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reservaId: 3 },
        update: expect.objectContaining({
          metodo: 'ONLINE',
          estado: 'PENDIENTE',
          proveedor: 'MERCADOPAGO',
          checkoutId: 'pref-1',
        }),
      }),
    );
  });

  it('un ADMIN puede iniciar el pago de cualquier reserva', async () => {
    db.reserva.findUnique.mockResolvedValue(reserva());

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', admin)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(200);
  });

  it('responde 403 si la reserva es de otro cliente', async () => {
    db.reserva.findUnique.mockResolvedValue(reserva());

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', otroCliente)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(403);
    expect(mp.crearPreferencia).not.toHaveBeenCalled();
  });

  it('responde 409 si la reserva no esta activa', async () => {
    db.reserva.findUnique.mockResolvedValue(reserva({ estado: 'PENDIENTE' }));

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(409);
    expect(mp.crearPreferencia).not.toHaveBeenCalled();
  });

  it('responde 409 si la reserva ya tiene un pago aprobado', async () => {
    db.reserva.findUnique.mockResolvedValue(reserva({ pago: pagoOnline({ estado: 'APROBADO' }) }));

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(409);
  });

  it('un CLIENTE no puede registrar un pago en efectivo', async () => {
    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      .send({ metodo: 'EFECTIVO' });

    expect(res.status).toBe(403);
  });

  it('exige sesion', async () => {
    const res = await request(app).post('/api/reservas/3/pagar').send({ metodo: 'ONLINE' });

    expect(res.status).toBe(401);
  });

  it('responde 409 si el proveedor esta procesando un pago de la reserva', async () => {
    db.reserva.findUnique.mockResolvedValue(
      reserva({ pago: pagoOnline({ pagoExternoId: '123' }) }),
    );

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(409);
    expect(mp.crearPreferencia).not.toHaveBeenCalled();
  });

  it('vuelve a validar con la reserva bloqueada despues de crear el checkout', async () => {
    // Mientras se creaba el checkout, el ADMIN cobro en efectivo
    db.reserva.findUnique
      .mockResolvedValueOnce(reserva())
      .mockResolvedValueOnce(
        reserva({ estado: 'PAGADA', pago: pagoOnline({ metodo: 'EFECTIVO', estado: 'APROBADO' }) }),
      );

    const res = await request(app)
      .post('/api/reservas/3/pagar')
      .set('Authorization', duenio)
      .send({ metodo: 'ONLINE' });

    expect(res.status).toBe(409);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.pago.upsert).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/mercadopago', () => {
  const pagoMp = (status: string, id = 123) => ({ id, status, external_reference: '3' });

  beforeEach(() => {
    vi.clearAllMocks();
    db.reserva.findUnique.mockResolvedValue(reserva({ pago: pagoOnline() }));
  });

  it('con un pago aprobado aprueba el Pago y deja la reserva PAGADA', async () => {
    mp.obtenerPago.mockResolvedValue(pagoMp('approved'));

    const res = await aviso();

    expect(res.status).toBe(200);
    expect(mp.obtenerPago).toHaveBeenCalledWith({ id: '123' });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.pago.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: expect.objectContaining({ estado: 'APROBADO', pagoExternoId: '123' }),
    });
    expect(db.reserva.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { estado: 'PAGADA' },
    });
  });

  it.each(['rejected', 'cancelled'])('con un pago %s deja el Pago RECHAZADO', async (status) => {
    mp.obtenerPago.mockResolvedValue(pagoMp(status));

    const res = await aviso();

    expect(res.status).toBe(200);
    expect(db.pago.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { estado: 'RECHAZADO', pagoExternoId: '123' },
    });
    expect(db.reserva.update).not.toHaveBeenCalled();
  });

  it.each(['pending', 'in_process'])(
    'con un pago %s lo deja PENDIENTE y guarda su id',
    async (status) => {
      mp.obtenerPago.mockResolvedValue(pagoMp(status));

      const res = await aviso();

      expect(res.status).toBe(200);
      expect(db.pago.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { estado: 'PENDIENTE', pagoExternoId: '123' },
      });
      expect(db.reserva.update).not.toHaveBeenCalled();
    },
  );

  it('ignora un aviso viejo de otro pago mientras el proveedor procesa uno', async () => {
    db.reserva.findUnique.mockResolvedValue(
      reserva({ pago: pagoOnline({ pagoExternoId: '456' }) }),
    );
    mp.obtenerPago.mockResolvedValue(pagoMp('rejected'));

    const res = await aviso();

    expect(res.status).toBe(200);
    expect(db.pago.update).not.toHaveBeenCalled();
  });

  it('es idempotente: si el pago ya esta aprobado no hace nada', async () => {
    db.reserva.findUnique.mockResolvedValue(
      reserva({ estado: 'PAGADA', pago: pagoOnline({ estado: 'APROBADO', pagoExternoId: '123' }) }),
    );
    mp.obtenerPago.mockResolvedValue(pagoMp('approved'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await aviso();

    expect(res.status).toBe(200);
    expect(db.pago.update).not.toHaveBeenCalled();
    expect(db.reserva.update).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('avisa si se aprueba un pago de una reserva que ya se cobro a mano', async () => {
    db.reserva.findUnique.mockResolvedValue(
      reserva({
        estado: 'PAGADA',
        pago: pagoOnline({ metodo: 'EFECTIVO', estado: 'APROBADO', proveedor: null }),
      }),
    );
    mp.obtenerPago.mockResolvedValue(pagoMp('approved'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await aviso();

    expect(res.status).toBe(200);
    expect(db.pago.update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('hay que devolverlo'));
    error.mockRestore();
  });

  it('responde 401 con una firma invalida y no consulta a MP', async () => {
    const res = await aviso('123', firmar('999'));

    expect(res.status).toBe(401);
    expect(mp.obtenerPago).not.toHaveBeenCalled();
  });

  it('ignora los avisos que no son de pagos', async () => {
    const res = await request(app)
      .post('/api/webhooks/mercadopago?data.id=55&type=merchant_order')
      .set(firmar('55'))
      .send({ type: 'merchant_order', data: { id: '55' } });

    expect(res.status).toBe(200);
    expect(mp.obtenerPago).not.toHaveBeenCalled();
  });
});
