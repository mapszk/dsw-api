import { toTipoEstadiaDto, type TipoEstadiaDto } from '../tipo-estadia/tipo-estadia.dto.js';
import { toTipoVehiculoDto, type TipoVehiculoDto } from '../tipo-vehiculo/tipo-vehiculo.dto.js';
import type { TarifaConRelaciones } from './tarifa.service.js';

export interface TarifaDto {
  id: number;
  valor: number;
  fechaDesde: string;
  tipoVehiculo: TipoVehiculoDto;
  tipoEstadia: TipoEstadiaDto;
}

export function toTarifaDto(tarifa: TarifaConRelaciones): TarifaDto {
  return {
    id: tarifa.id,
    valor: tarifa.valor.toNumber(),
    fechaDesde: tarifa.fechaDesde.toISOString(),
    tipoVehiculo: toTipoVehiculoDto(tarifa.tipoVehiculo),
    tipoEstadia: toTipoEstadiaDto(tarifa.tipoEstadia),
  };
}
