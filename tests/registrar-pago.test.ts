import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  reserva: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  pago: { create: vi.fn(), update: vi.fn() },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}));

import { registrarPago } from '../src/modules/reserva/reserva.service.js';

describe('registrar pago de una reserva (CU2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra el pago aprobado por el precio de la reserva y la deja PAGADA', async () => {
    const precioTotal = '3000';
    tx.reserva.findUnique.mockResolvedValue({ id: 1, estado: 'ACTIVA', precioTotal, pago: null });
    tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    const resultado = await registrarPago(1, { metodo: 'EFECTIVO' });

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

  it('reemplaza un pago de MercadoPago sin aprobar en lugar de crear otro', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'ACTIVA',
      precioTotal: '3000',
      pago: { id: 7, metodo: 'MERCADOPAGO', estado: 'RECHAZADO' },
    });
    tx.reserva.findUniqueOrThrow.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    await registrarPago(1, { metodo: 'TRANSFERENCIA' });

    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.pago.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          metodo: 'TRANSFERENCIA',
          estado: 'APROBADO',
          mpPreferenceId: null,
          mpPaymentId: null,
        }),
      }),
    );
  });

  it('rechaza una reserva que ya tiene un pago aprobado', async () => {
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'PAGADA',
      pago: { id: 7, metodo: 'MERCADOPAGO', estado: 'APROBADO' },
    });

    await expect(registrarPago(1, { metodo: 'EFECTIVO' })).rejects.toThrow(
      'La reserva ya tiene un pago aprobado',
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.pago.update).not.toHaveBeenCalled();
  });

  it.each(['PENDIENTE', 'PAGADA', 'CANCELADA'])(
    'rechaza una reserva %s y no registra ningun pago',
    async (estado) => {
      tx.reserva.findUnique.mockResolvedValue({ id: 1, estado, pago: null });

      await expect(registrarPago(1, { metodo: 'EFECTIVO' })).rejects.toThrow(
        'Solo se puede registrar el pago de reservas activas',
      );
      expect(tx.pago.create).not.toHaveBeenCalled();
      expect(tx.reserva.update).not.toHaveBeenCalled();
    },
  );

  it('falla si la reserva no existe', async () => {
    tx.reserva.findUnique.mockResolvedValue(null);

    await expect(registrarPago(999, { metodo: 'TRANSFERENCIA' })).rejects.toThrow(
      'Reserva no encontrada',
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
  });
});
