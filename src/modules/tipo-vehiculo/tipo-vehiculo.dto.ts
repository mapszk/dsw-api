import type { TipoVehiculo } from '../../generated/prisma/client.js';

export interface TipoVehiculoDto {
  id: number;
  tipo: string;
}

export function toTipoVehiculoDto(tipoVehiculo: TipoVehiculo): TipoVehiculoDto {
  return {
    id: tipoVehiculo.id,
    tipo: tipoVehiculo.tipo,
  };
}
