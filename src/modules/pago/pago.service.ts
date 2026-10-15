import { prisma } from '../../lib/prisma.js';
import type { ActualizarPagoInput, CrearPagoInput } from './pago.schema.js';

export const listarPagos = () => {
  return prisma.pago.findMany({ orderBy: { id: 'asc' }, include: { reserva: true } });
};

export const obtenerPago = (id: number) => {
  return prisma.pago.findUniqueOrThrow({ where: { id }, include: { reserva: true } });
};

export const crearPago = (data: CrearPagoInput) => {
  return prisma.pago.create({ data });
};

export const actualizarPago = (id: number, data: ActualizarPagoInput) => {
  return prisma.pago.update({ where: { id }, data });
};

export const eliminarPago = (id: number) => {
  return prisma.pago.delete({ where: { id } });
};