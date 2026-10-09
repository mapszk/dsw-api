import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ActualizarTipoVehiculoInput,
  CrearTipoVehiculoInput,
} from './tipo-vehiculo.schema.js';

export function listar() {
  return prisma.tipoVehiculo.findMany({ orderBy: { tipo: 'asc' } });
}

export async function obtener(id: number) {
  const tipoVehiculo = await prisma.tipoVehiculo.findUnique({ where: { id } });
  if (!tipoVehiculo) throw HttpError.notFound('Tipo de vehiculo no encontrado');
  return tipoVehiculo;
}

export function crear(data: CrearTipoVehiculoInput) {
  return prisma.tipoVehiculo.create({ data });
}

export function actualizar(id: number, data: ActualizarTipoVehiculoInput) {
  return prisma.tipoVehiculo.update({ where: { id }, data });
}

export async function eliminar(id: number) {
  await prisma.tipoVehiculo.delete({ where: { id } });
}
