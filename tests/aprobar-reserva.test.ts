import { beforeEach, describe, expect, it, vi } from 'vitest';

const reserva = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));

vi.mock('../src/lib/prisma.js', () => ({ prisma: { reserva } }));

import { aprobar } from '../src/modules/reserva/reserva.service.js';

const manana = () => new Date(Date.now() + 24 * 60 * 60_000);

function pendiente(datos: Record<string, unknown> = {}) {
  return {
    id: 1,
    estado: 'PENDIENTE',
    fechaFin: manana(),
    cochera: { id: 5, estado: 'DISPONIBLE' },
    ...datos,
  };
}

describe('aprobar reserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pasa la reserva a ACTIVA sin tocar el estado de la cochera', async () => {
    reserva.findUnique.mockResolvedValue(pendiente());
    reserva.update.mockResolvedValue({ id: 1, estado: 'ACTIVA' });

    const resultado = await aprobar(1);

    expect(reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { estado: 'ACTIVA' } }),
    );
    expect(resultado.estado).toBe('ACTIVA');
  });

  it('rechaza una reserva que no esta pendiente', async () => {
    reserva.findUnique.mockResolvedValue(pendiente({ estado: 'ACTIVA' }));

    await expect(aprobar(1)).rejects.toThrow('Solo se pueden aprobar reservas pendientes');
    expect(reserva.update).not.toHaveBeenCalled();
  });

  it('rechaza una reserva vencida', async () => {
    reserva.findUnique.mockResolvedValue(pendiente({ fechaFin: new Date('2020-01-01') }));

    await expect(aprobar(1)).rejects.toThrow('La reserva esta vencida');
    expect(reserva.update).not.toHaveBeenCalled();
  });

  it('rechaza si la cochera esta inhabilitada', async () => {
    reserva.findUnique.mockResolvedValue(pendiente({ cochera: { id: 5, estado: 'INHABILITADA' } }));

    await expect(aprobar(1)).rejects.toThrow('La cochera esta inhabilitada');
    expect(reserva.update).not.toHaveBeenCalled();
  });
});
