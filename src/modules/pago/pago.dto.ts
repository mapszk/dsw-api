import type { EstadoPago, MetodoPago } from '../../generated/prisma/client.js';
import type { PagoConReserva } from './pago.service.js';

export interface PagoDto {
  id: number;
  fecha: string;
  metodo: MetodoPago;
  estado: EstadoPago;
  monto: number;
  reservaId: number;
  reserva: { id: number; patente: string };
}

export function toPagoDto(pago: PagoConReserva): PagoDto {
  return {
    id: pago.id,
    fecha: pago.fecha.toISOString(),
    metodo: pago.metodo,
    estado: pago.estado,
    monto: pago.monto.toNumber(),
    reservaId: pago.reservaId,
    reserva: { id: pago.reserva.id, patente: pago.reserva.patente },
  };
}
