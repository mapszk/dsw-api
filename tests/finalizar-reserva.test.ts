import { beforeEach, describe, expect, it, vi } from 'vitest';

const tx = vi.hoisted(() => ({
  reserva: { findUnique: vi.fn(), update: vi.fn() },
  pago: { create: vi.fn() },
  cochera: { update: vi.fn() },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}));

import { finalizar } from '../src/modules/reserva/reserva.service.js';

describe('finalizar reserva (CU2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra el pago, libera la cochera y deja la reserva FINALIZADA', async () => {
    const precioTotal = '3000';
    tx.reserva.findUnique.mockResolvedValue({
      id: 1,
      estado: 'ACTIVA',
      cocheraId: 5,
      precioTotal,
    });
    tx.reserva.update.mockResolvedValue({ id: 1, estado: 'FINALIZADA' });

    const resultado = await finalizar(1, { metodo: 'EFECTIVO' });

    expect(tx.pago.create).toHaveBeenCalledWith({
      data: { metodo: 'EFECTIVO', monto: precioTotal, reservaId: 1 },
    });
    expect(tx.cochera.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { estado: 'DISPONIBLE' },
    });
    expect(tx.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { estado: 'FINALIZADA' } }),
    );
    expect(resultado.estado).toBe('FINALIZADA');
  });

  it('rechaza una reserva que no esta ACTIVA y no registra ningun pago', async () => {
    tx.reserva.findUnique.mockResolvedValue({ id: 1, estado: 'PENDIENTE', cocheraId: 5 });

    await expect(finalizar(1, { metodo: 'EFECTIVO' })).rejects.toThrow(
      'Solo se pueden finalizar reservas activas',
    );
    expect(tx.pago.create).not.toHaveBeenCalled();
    expect(tx.cochera.update).not.toHaveBeenCalled();
  });

  it('falla si la reserva no existe', async () => {
    tx.reserva.findUnique.mockResolvedValue(null);

    await expect(finalizar(999, { metodo: 'TARJETA' })).rejects.toThrow('Reserva no encontrada');
    expect(tx.pago.create).not.toHaveBeenCalled();
  });
});