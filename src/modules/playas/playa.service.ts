import { prisma } from '../../lib/prisma.js';
import type { ActualizarPlayaInput, CrearPlayaInput } from './playa.schema.js';

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