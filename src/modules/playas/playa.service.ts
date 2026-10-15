import { prisma } from '../../lib/prisma.js';
import { conOcupacion, reservasEnCurso } from '../cochera/cochera.service.js';
import type {
  ActualizarPlayaInput,
  CrearPlayaInput,
  FiltrosCocherasInput,
} from './playa.schema.js';

export const listarPlayas = () => {
  return prisma.playa.findMany({ orderBy: { id: 'asc' } });
};

export const obtenerPlaya = (id: number) => {
  return prisma.playa.findUniqueOrThrow({ where: { id } });
};

export const crearPlaya = (data: CrearPlayaInput) => {
  return prisma.playa.create({ data });
};

export const actualizarPlaya = (id: number, data: ActualizarPlayaInput) => {
  return prisma.playa.update({ where: { id }, data });
};

export const eliminarPlaya = (id: number) => {
  return prisma.playa.delete({ where: { id } });
};

export const listarCocherasDePlaya = async (playaId: number, filtros: FiltrosCocherasInput) => {
  await prisma.playa.findUniqueOrThrow({ where: { id: playaId } });

  const cocheras = await prisma.cochera.findMany({
    where: { playaId, estado: filtros.estado, techada: filtros.techada },
    include: { playa: true, reservas: reservasEnCurso() },
    orderBy: { id: 'asc' },
  });
  return cocheras.map(conOcupacion);
};