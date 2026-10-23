import { EstadoPago, EstadoReserva, MetodoPago, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { ActualizarPagoInput, CrearPagoInput, ListarPagosQuery } from './pago.schema.js';

const include = {
  reserva: { select: { id: true, patente: true } },
} satisfies Prisma.PagoInclude;

export type PagoConReserva = Prisma.PagoGetPayload<{ include: typeof include }>;

type PagoManual = Pick<CrearPagoInput, 'metodo'> & Partial<Pick<CrearPagoInput, 'monto' | 'fecha'>>;

export const listarPagos = (filtros: ListarPagosQuery) => {
  return prisma.pago.findMany({ where: filtros, orderBy: { id: 'asc' }, include });
};

export const obtenerPago = async (id: number) => {
  const pago = await prisma.pago.findUnique({ where: { id }, include });
  if (!pago) throw HttpError.notFound('Pago no encontrado');
  return pago;
};

/**
 * Registra un pago manual (efectivo o transferencia) de una reserva ACTIVA: el pago queda APROBADO
 * y la reserva PAGADA. Lo usan el CRUD de pagos y el CU2, siempre dentro de una transaccion.
 * Si la reserva tenia un pago online sin aprobar, se reemplaza: reservaId es unico.
 */
export async function registrarPagoManual(
  tx: Prisma.TransactionClient,
  reservaId: number,
  { metodo, monto, fecha }: PagoManual,
) {
  const reserva = await tx.reserva.findUnique({
    where: { id: reservaId },
    include: { pago: true },
  });
  if (!reserva) throw HttpError.notFound('Reserva no encontrada');
  if (reserva.pago?.estado === EstadoPago.APROBADO) {
    throw HttpError.conflict('La reserva ya tiene un pago aprobado');
  }
  if (reserva.estado !== EstadoReserva.ACTIVA) {
    throw HttpError.conflict('Solo se puede registrar el pago de reservas activas');
  }

  const data = {
    metodo,
    estado: EstadoPago.APROBADO,
    // Sin monto, se cobra el precio de la reserva
    monto: monto ?? reserva.precioTotal,
    fecha: fecha ?? new Date(),
    proveedor: null,
    checkoutId: null,
    pagoExternoId: null,
  };
  const pago = reserva.pago
    ? await tx.pago.update({ where: { id: reserva.pago.id }, data, include })
    : await tx.pago.create({ data: { ...data, reservaId }, include });
  await tx.reserva.update({ where: { id: reservaId }, data: { estado: EstadoReserva.PAGADA } });
  return pago;
}

export const crearPago = ({ reservaId, ...data }: CrearPagoInput) => {
  return prisma.$transaction((tx) => registrarPagoManual(tx, reservaId, data));
};

// Los pagos online los actualiza el aviso del proveedor; el estado de un pago nunca se edita a mano
export const actualizarPago = async (id: number, data: ActualizarPagoInput) => {
  const pago = await obtenerPago(id);
  if (pago.metodo === MetodoPago.ONLINE) {
    throw HttpError.conflict('Los pagos online no se pueden modificar');
  }
  return prisma.pago.update({ where: { id }, data, include });
};

export const eliminarPago = async (id: number) => {
  const pago = await obtenerPago(id);
  if (pago.metodo === MetodoPago.ONLINE) {
    // Anular un pago online aprobado requeriria un reembolso (fuera del alcance)
    if (pago.estado === EstadoPago.APROBADO) {
      throw HttpError.conflict('Un pago online aprobado no se puede eliminar');
    }
    await prisma.pago.delete({ where: { id } });
    return;
  }

  // Sin el pago manual, la reserva vuelve a estar pendiente de pago
  await prisma.$transaction([
    prisma.pago.delete({ where: { id } }),
    prisma.reserva.updateMany({
      where: { id: pago.reservaId, estado: EstadoReserva.PAGADA },
      data: { estado: EstadoReserva.ACTIVA },
    }),
  ]);
};
