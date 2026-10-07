import type { EstadoCochera, EstadoReserva, MetodoPago } from '../../generated/prisma/client.js';
import { toTipoEstadiaDto, type TipoEstadiaDto } from '../tipo-estadia/tipo-estadia.dto.js';
import type { ReservaConRelaciones } from './reserva.service.js';

export interface ReservaDto {
  id: number;
  patente: string;
  fechaInicio: string;
  fechaFin: string;
  precioTotal: number;
  estado: EstadoReserva;
  usuario: { id: number; nombre: string; dni: string; email: string; telefono: string | null };
  cochera: {
    id: number;
    techada: boolean;
    estado: EstadoCochera;
    playa: { id: number; sector: string };
  };
  tipoVehiculo: { id: number; tipo: string };
  tipoEstadia: TipoEstadiaDto;
  pago: { id: number; fecha: string; metodo: MetodoPago; monto: number } | null;
}

export function toReservaDto(reserva: ReservaConRelaciones): ReservaDto {
  const { usuario, cochera, tipoVehiculo, pago } = reserva;
  return {
    id: reserva.id,
    patente: reserva.patente,
    fechaInicio: reserva.fechaInicio.toISOString(),
    fechaFin: reserva.fechaFin.toISOString(),
    precioTotal: reserva.precioTotal.toNumber(),
    estado: reserva.estado,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      dni: usuario.dni,
      email: usuario.email,
      telefono: usuario.telefono,
    },
    cochera: {
      id: cochera.id,
      techada: cochera.techada,
      estado: cochera.estado,
      playa: { id: cochera.playa.id, sector: cochera.playa.sector },
    },
    tipoVehiculo: { id: tipoVehiculo.id, tipo: tipoVehiculo.tipo },
    tipoEstadia: toTipoEstadiaDto(reserva.tipoEstadia),
    pago: pago && {
      id: pago.id,
      fecha: pago.fecha.toISOString(),
      metodo: pago.metodo,
      monto: pago.monto.toNumber(),
    },
  };
}
