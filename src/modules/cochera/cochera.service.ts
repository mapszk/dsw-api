import { EstadoReserva, type Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import type { ActualizarCocheraInput, CrearCocheraInput } from './cochera.schema.js';

/**
 * La ocupacion no se guarda en la cochera: esta ocupada ahora si tiene una reserva aprobada
 * (ACTIVA o PAGADA) cuyo horario incluye este momento. Fuera de ese rango queda libre.
 */
export function reservasEnCurso(ahora = new Date()) {
  return {
    where: {
      estado: { in: [EstadoReserva.ACTIVA, EstadoReserva.PAGADA] },
      fechaInicio: { lte: ahora },
      fechaFin: { gt: ahora },
    },
    select: { id: true },
  } satisfies Prisma.ReservaFindManyArgs;
}

/** Reemplaza las reservas en curso por el campo calculado `ocupada` */
export function conOcupacion<T extends { reservas: { id: number }[] }>({
  reservas,
  ...cochera
}: T) {
  return { ...cochera, ocupada: reservas.length > 0 };
}

export const listarCocheras = async () => {
  const cocheras = await prisma.cochera.findMany({
    orderBy: { id: 'asc' },
    include: { playa: true, reservas: reservasEnCurso() },
  });
  return cocheras.map(conOcupacion);
};

export const obtenerCochera = async (id: number) => {
  const cochera = await prisma.cochera.findUniqueOrThrow({
    where: { id },
    include: { playa: true, reservas: reservasEnCurso() },
  });
  return conOcupacion(cochera);
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