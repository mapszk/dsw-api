import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  reserva: { findUnique: vi.fn(), update: vi.fn() },
  pago: { create: vi.fn() },
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

  it('registra el pago por el precio de la reserva y la deja PAGADA', async () => {
    const precioTotal = '3000';
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'ACTIVA',
      cocheraId: 5,
      precioTotal,
    });
    tx.reserva.update.mockResolvedValue({ id: 1, estado: 'PAGADA' });

    const resultado = await registrarPago(1, { metodo: 'EFECTIVO' });

    expect(tx.pago.create).toHaveBeenCalledWith({
      data: { metodo: 'EFECTIVO', monto: precioTotal, reservaId: 1 },
    });
    expect(tx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { estado: 'PAGADA' } }),
    );
    expect(resultado.estado).toBe('PAGADA');
  });

  it.each(['PENDIENTE', 'PAGADA', 'CANCELADA'])(
    'rechaza una reserva %s y no registra ningun pago',
    async (estado) => {
      tx.reserva.findUnique.mockResolvedValue({ id: 1, estado, cocheraId: 5 });

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
