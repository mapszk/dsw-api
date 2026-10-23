import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  reserva: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  pago: { create: vi.fn(), update: vi.fn() },
  // SELECT ... FOR UPDATE de la reserva
  $queryRaw: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}));

import { registrarPago } from '../src/modules/reserva/reserva.service.js';

const admin = { id: 1, rol: 'ADMIN' } as const;

describe('registrar pago de una reserva (CU2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra el pago aprobado por el precio de la reserva y la deja PAGADA', async () => {
    const precioTotal = '3000';
    tx.reserva.findUnique.mockResolvedValue({ id: 1, estado: 'ACTIVA', precioTotal, pago: null });
    tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    const { reserva: resultado } = await registrarPago(1, { metodo: 'EFECTIVO' }, admin);

    expect(tx.pago.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metodo: 'EFECTIVO',
          estado: 'APROBADO',
          monto: precioTotal,
          reservaId: 1,
        }),
      }),
    );
    expect(tx.reserva.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { estado: 'PAGADA' },
    });
    expect(resultado.estado).toBe('PAGADA');
  });

  it('reemplaza un pago online sin aprobar en lugar de crear otro', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'ACTIVA',
      precioTotal: '3000',
      pago: { id: 7, metodo: 'ONLINE', estado: 'RECHAZADO' },
    });
    tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    await registrarPago(1, { metodo: 'TRANSFERENCIA' }, admin);

    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.pago.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          metodo: 'TRANSFERENCIA',
          estado: 'APROBADO',
          proveedor: null,
          checkoutId: null,
          pagoExternoId: null,
        }),
      }),
    );
  });

  it('rechaza una reserva que ya tiene un pago aprobado', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'PAGADA',
      pago: { id: 7, metodo: 'ONLINE', estado: 'APROBADO' },
    });

    await expect(registrarPago(1, { metodo: 'EFECTIVO' }, admin)).rejects.toThrow(
      'La reserva ya tiene un pago aprobado',
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.pago.update).not.toHaveBeenCalled();
  });

  it.each(['PENDIENTE', 'PAGADA', 'CANCELADA'])(
    'rechaza una reserva %s y no registra ningun pago',
    async (estado) => {
      tx.reserva.findUnique.mockResolvedValue({ id: 1, estado, pago: null });

      await expect(registrarPago(1, { metodo: 'EFECTIVO' }, admin)).rejects.toThrow(
        'Solo se puede registrar el pago de reservas activas',
      );
      expect(tx.pago.create).not.toHaveBeenCalled();
      expect(tx.reserva.update).not.toHaveBeenCalled();
    },
  );

  it('falla si la reserva no existe', async () => {
    tx.reserva.findUnique.mockResolvedValue(null);

    await expect(registrarPago(999, { metodo: 'TRANSFERENCIA' }, admin)).rejects.toThrow(
      'Reserva no encontrada',
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
  });

  it('un CLIENTE no puede registrar pagos en efectivo o transferencia', async () => {
    await expect(
      registrarPago(1, { metodo: 'EFECTIVO' }, { id: 5, rol: 'CLIENTE' }),
    ).rejects.toThrow('Solo un administrador puede registrar pagos en efectivo o transferencia');
    expect(tx.reserva.findUnique).not.toHaveBeenCalled();
  });

  it('bloquea la reserva antes de leer el pago', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'ACTIVA',
      precioTotal: '3000',
      pago: null,
    });
    tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    await registrarPago(1, { metodo: 'EFECTIVO' }, admin);

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.reserva.findUnique.mock.invocationCallOrder[0],
    );
  });

  describe('con un pago online PENDIENTE', () => {
    const online = (datos: Record<string, unknown>) => ({
      id: 1,
      estado: 'ACTIVA',
      precioTotal: '3000',
      pago: {
        id: 7,
        metodo: 'ONLINE',
        estado: 'PENDIENTE',
        pagoExternoId: null,
        fecha: new Date(),
        ...datos,
      },
    });

    it('rechaza el cobro manual mientras el checkout esta vigente', async () => {
      tx.reserva.findUnique.mockResolvedValue(online({ fecha: new Date(Date.now() - 60_000) }));

      await expect(registrarPago(1, { metodo: 'EFECTIVO' }, admin)).rejects.toThrow(
        'La reserva tiene un pago online en curso',
      );
      expect(tx.pago.update).not.toHaveBeenCalled();
    });

    it('permite el cobro manual cuando el checkout vencio', async () => {
      tx.reserva.findUnique.mockResolvedValue(online({ fecha: new Date('2020-01-01') }));
      tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

      await registrarPago(1, { metodo: 'EFECTIVO' }, admin);

      expect(tx.pago.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: expect.objectContaining({ estado: 'APROBADO' }),
        }),
      );
    });

    it('rechaza el cobro manual si el proveedor esta procesando un pago, aunque el checkout haya vencido', async () => {
      tx.reserva.findUnique.mockResolvedValue(
        online({ pagoExternoId: '123', fecha: new Date('2020-01-01') }),
      );

      await expect(registrarPago(1, { metodo: 'EFECTIVO' }, admin)).rejects.toThrow(
        'La reserva tiene un pago online en proceso',
      );
      expect(tx.pago.update).not.toHaveBeenCalled();
    });
  });
});
