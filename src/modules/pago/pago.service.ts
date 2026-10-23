import {
  EstadoPago,
  EstadoReserva,
  MetodoPago,
  Prisma,
  Rol,
} from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import type { UsuarioAutenticado } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import type { ProveedorPago } from './proveedor-pago.js';
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
 * Bloquea la reserva hasta el fin de la transaccion. Todas las operaciones
 * que cambian el pago de una reserva la bloquean primero: si dos corren a la vez, la segunda espera
 * y ve lo que confirmo la primera. Se bloquea la reserva porque el pago puede no existir todavia.
 */
async function bloquearReserva(tx: Prisma.TransactionClient, reservaId: number) {
  await tx.$queryRaw`SELECT id FROM reservas WHERE id = ${reservaId} FOR UPDATE`;
}

const vencimientoMs = () => env.PAGO_ONLINE_VENCIMIENTO_MINUTOS * 60_000;

type PagoActual = {
  metodo: MetodoPago;
  estado: EstadoPago;
  pagoExternoId: string | null;
  fecha: Date;
};

/**
 * Pago online PENDIENTE que el proveedor ya esta procesando
 */
function pagoOnlineEnProceso(pago: PagoActual | null) {
  return (
    pago?.metodo === MetodoPago.ONLINE &&
    pago.estado === EstadoPago.PENDIENTE &&
    pago.pagoExternoId !== null
  );
}

/** Checkout online abierto, en el que el cliente todavia puede pagar */
function checkoutVigente(pago: PagoActual | null) {
  return (
    pago?.metodo === MetodoPago.ONLINE &&
    pago.estado === EstadoPago.PENDIENTE &&
    pago.pagoExternoId === null &&
    pago.fecha.getTime() + vencimientoMs() > Date.now()
  );
}

/**
 * Registra un pago manual (efectivo o transferencia) de una reserva ACTIVA: el pago queda APROBADO
 * y la reserva PAGADA. Lo usan el CRUD de pagos y el CU2, siempre dentro de una transaccion.
 * Si la reserva tenia un pago online rechazado o con el checkout vencido, se reemplaza: reservaId
 * es unico. Con un pago online en curso no se permite, para no cobrarle dos veces al cliente.
 */
export async function registrarPagoManual(
  tx: Prisma.TransactionClient,
  reservaId: number,
  { metodo, monto, fecha }: PagoManual,
) {
  await bloquearReserva(tx, reservaId);
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
  if (pagoOnlineEnProceso(reserva.pago)) {
    throw HttpError.conflict('La reserva tiene un pago online en proceso');
  }
  if (checkoutVigente(reserva.pago)) {
    throw HttpError.conflict(
      `La reserva tiene un pago online en curso: se puede cobrar a mano cuando venza (${env.PAGO_ONLINE_VENCIMIENTO_MINUTOS} min desde que se inicio)`,
    );
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

/** Reglas para iniciar un pago online, antes y despues de crear el checkout */
function validarPagoOnline<
  R extends { usuarioId: number; estado: EstadoReserva; pago: PagoActual | null },
>(reserva: R | null, solicitante: UsuarioAutenticado) {
  if (!reserva) throw HttpError.notFound('Reserva no encontrada');
  if (solicitante.rol === Rol.CLIENTE && reserva.usuarioId !== solicitante.id) {
    throw HttpError.forbidden('No puede pagar una reserva de otro cliente');
  }
  if (reserva.estado !== EstadoReserva.ACTIVA) {
    throw HttpError.conflict('Solo se pueden pagar reservas activas');
  }
  if (reserva.pago?.estado === EstadoPago.APROBADO) {
    throw HttpError.conflict('La reserva ya tiene un pago aprobado');
  }
  // Un checkout vigente sin pago si se puede reemplazar: solo cambia el link
  if (pagoOnlineEnProceso(reserva.pago)) {
    throw HttpError.conflict('La reserva tiene un pago online en proceso');
  }
  return reserva;
}

export async function iniciarPagoOnline(
  proveedor: ProveedorPago,
  reservaId: number,
  solicitante: UsuarioAutenticado,
) {
  const consulta = { where: { id: reservaId }, include: { pago: true } };
  const reserva = validarPagoOnline(await prisma.reserva.findUnique(consulta), solicitante);

  // El checkout se crea fuera de la transaccion para no tener la reserva bloqueada mientras
  // responde el proveedor. Si en el medio cambio algo, el checkout queda sin usar y vence solo.
  const fecha = new Date();
  const monto = reserva.precioTotal;
  const checkout = await proveedor.crearCheckout(
    { id: reservaId, patente: reserva.patente },
    monto,
    new Date(fecha.getTime() + vencimientoMs()),
  );

  await prisma.$transaction(async (tx) => {
    await bloquearReserva(tx, reservaId);
    validarPagoOnline(await tx.reserva.findUnique(consulta), solicitante);

    // Un nuevo intento reemplaza al pago online anterior: reservaId es unico
    const data = {
      metodo: MetodoPago.ONLINE,
      estado: EstadoPago.PENDIENTE,
      monto,
      fecha,
      proveedor: proveedor.nombre,
      checkoutId: checkout.checkoutId,
      pagoExternoId: null,
    };
    await tx.pago.upsert({
      where: { reservaId },
      create: { ...data, reservaId },
      update: data,
    });
  });

  return { initPoint: checkout.url };
}

/**
 * Procesa el aviso de un pago online: lo consulta en el proveedor y actualiza el Pago de la
 * reserva.
 */
export async function procesarAvisoOnline(proveedor: ProveedorPago, pagoExternoId: string) {
  const externo = await proveedor.consultarPago(pagoExternoId);
  if (!externo.reservaId) return;
  const { reservaId } = externo;
  const aprobado = externo.estado === EstadoPago.APROBADO;

  await prisma.$transaction(async (tx) => {
    await bloquearReserva(tx, reservaId);
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { pago: true },
    });
    const pago = reserva?.pago;

    // El pago ya no es este intento online (se cobro a mano, se borro o ya se aprobo otro pago)
    if (
      !reserva ||
      !pago ||
      pago.proveedor !== proveedor.nombre ||
      pago.estado === EstadoPago.APROBADO
    ) {
      if (aprobado && pago?.pagoExternoId !== externo.pagoExternoId) {
        // No deberia pasar con los bloqueos, pero si pasa el cliente pago dos veces
        console.error(
          `Pago ${proveedor.nombre} ${externo.pagoExternoId} aprobado para la reserva ${reservaId}, que ya no lo esperaba (se cobro o borro el pago): hay que devolverlo`,
        );
      }
      return;
    }

    // Aviso viejo de otro pago mientras el proveedor procesa uno: solo una aprobacion lo reemplaza
    if (pagoOnlineEnProceso(pago) && pago.pagoExternoId !== externo.pagoExternoId && !aprobado) {
      return;
    }

    await tx.pago.update({
      where: { id: pago.id },
      data: {
        estado: externo.estado,
        // Con el id guardado, un pago PENDIENTE bloquea los cobros manuales hasta que se resuelva
        pagoExternoId: externo.pagoExternoId,
        ...(aprobado && { fecha: new Date() }),
      },
    });
    if (!aprobado) return;

    if (reserva.estado === EstadoReserva.ACTIVA) {
      await tx.reserva.update({
        where: { id: reservaId },
        data: { estado: EstadoReserva.PAGADA },
      });
    } else {
      console.error(
        `Pago ${proveedor.nombre} ${externo.pagoExternoId} aprobado para la reserva ${reservaId} en estado ${reserva.estado}: hay que devolverlo`,
      );
    }
  });
}
