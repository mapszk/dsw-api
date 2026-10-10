import { prisma } from '../../lib/prisma.js';
import type { ActualizarCocheraInput, CrearCocheraInput } from './cochera.schema.js';

export const listarCocheras = () => {
  return prisma.cochera.findMany({ orderBy: { id: 'asc' }, include: { playa: true } });
};

export const obtenerCochera = (id: number) => {
  return prisma.cochera.findUniqueOrThrow({ where: { id }, include: { playa: true } });
};

export const crearCochera = (data: CrearCocheraInput) => {
  return prisma.cochera.create({ data });
};

export const actualizarCochera = (id: number, data: ActualizarCocheraInput) => {
  return prisma.cochera.update({ where: { id }, data });
};

export const eliminarCochera = (id: number) => {
  return prisma.cochera.delete({ where: { id } });
};