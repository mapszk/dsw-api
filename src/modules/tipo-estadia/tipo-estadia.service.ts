import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { ActualizarTipoEstadiaInput, CrearTipoEstadiaInput } from './tipo-estadia.schema.js';

export function listar() {
  return prisma.tipoEstadia.findMany({ orderBy: { duracionMinutos: 'asc' } });
}

export async function obtener(id: number) {
  const tipoEstadia = await prisma.tipoEstadia.findUnique({ where: { id } });
  if (!tipoEstadia) throw HttpError.notFound('Tipo de estadia no encontrado');
  return tipoEstadia;
}

export function crear(data: CrearTipoEstadiaInput) {
  return prisma.tipoEstadia.create({ data });
}

export function actualizar(id: number, data: ActualizarTipoEstadiaInput) {
  return prisma.tipoEstadia.update({ where: { id }, data });
}

export async function eliminar(id: number) {
  await prisma.tipoEstadia.delete({ where: { id } });
}
