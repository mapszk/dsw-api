import type { TipoEstadia } from '../../generated/prisma/client.js';

export interface TipoEstadiaDto {
  id: number;
  tipo: string;
  duracionMinutos: number;
}

export function toTipoEstadiaDto(tipoEstadia: TipoEstadia): TipoEstadiaDto {
  return {
    id: tipoEstadia.id,
    tipo: tipoEstadia.tipo,
    duracionMinutos: tipoEstadia.duracionMinutos,
  };
}
