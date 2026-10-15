import { prisma } from '../../lib/prisma.js';
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

  return prisma.cochera.findMany({
    where: { playaId, estado: filtros.estado, techada: filtros.techada },
    include: { playa: true },
    orderBy: { id: 'asc' },
  });
};