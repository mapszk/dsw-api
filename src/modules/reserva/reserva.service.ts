import { EstadoCochera, EstadoReserva, Prisma, Rol } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import type { UsuarioAutenticado } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ActualizarReservaInput,
  CrearReservaInput,
  ListarReservasQuery,
  ReprogramarReservaInput,
} from './reserva.schema.js';

const include = {
  usuario: { omit: { password: true } },
  cochera: { include: { playa: true } },
  tipoVehiculo: true,
  tipoEstadia: true,
  pago: true,
} satisfies Prisma.ReservaInclude;

export type ReservaConRelaciones = Prisma.ReservaGetPayload<{ include: typeof include }>;

const ESTADOS_QUE_OCUPAN: EstadoReserva[] = [EstadoReserva.PENDIENTE, EstadoReserva.ACTIVA];
const ESTADOS_ELIMINABLES: EstadoReserva[] = [EstadoReserva.PENDIENTE, EstadoReserva.CANCELADA];

/** Reservas que ocupan la cochera en algun momento del rango [fechaInicio, fechaFin) */
function ocupanEnRango(fechaInicio: Date, fechaFin: Date) {
  return {
    estado: { in: ESTADOS_QUE_OCUPAN },
    fechaInicio: { lt: fechaFin },
    fechaFin: { gt: fechaInicio },
  } satisfies Prisma.ReservaWhereInput;
}

/** Tarifa vigente: la ultima que empezo a regir antes del inicio de la reserva */
function buscarTarifaVigente(
  tx: Prisma.TransactionClient,
  tipoVehiculoId: number,
  tipoEstadiaId: number,
  fechaInicio: Date,
) {
  return tx.tarifa.findFirst({
    where: { tipoVehiculoId, tipoEstadiaId, fechaDesde: { lte: fechaInicio } },
    orderBy: { fechaDesde: 'desc' },
  });
}

/** Cobra unidades completas del tipo de estadia: 61 minutos por hora son 2 horas. */
export function calcularPrecio(
  valor: Prisma.Decimal,
  fechaInicio: Date,
  fechaFin: Date,
  duracionMinutos: number,
) {
  const unidades = Math.ceil(
    (fechaFin.getTime() - fechaInicio.getTime()) / (duracionMinutos * 60_000),
  );
  return valor.mul(unidades);
}

/** Un CLIENTE solo puede ver y operar sus propias reservas: devuelve su id para filtrar */
function soloPropias(solicitante: UsuarioAutenticado) {
  return solicitante.rol === Rol.CLIENTE ? solicitante.id : undefined;
}

export function listar(filtros: ListarReservasQuery, solicitante: UsuarioAutenticado) {
  return prisma.reserva.findMany({
    where: { ...filtros, usuarioId: soloPropias(solicitante) ?? filtros.usuarioId },
    include,
    orderBy: { fechaInicio: 'desc' },
  });
}

export async function obtener(id: number, solicitante?: UsuarioAutenticado) {
  const reserva = await prisma.reserva.findUnique({ where: { id }, include });
  const propietario = solicitante && soloPropias(solicitante);
  // 404 y no 403 para no revelar que existe una reserva de otro cliente
  if (!reserva || (propietario !== undefined && reserva.usuarioId !== propietario)) {
    throw HttpError.notFound('Reserva no encontrada');
  }
  return reserva;
}

export async function crear(input: CrearReservaInput, solicitante: UsuarioAutenticado) {
  const usuarioId = soloPropias(solicitante) ?? input.usuarioId;
  if (!usuarioId) throw HttpError.badRequest('Debe indicar el usuario de la reserva');
  const data = { ...input, usuarioId };

  if (data.fechaInicio < new Date()) {
    throw HttpError.badRequest('La fecha de inicio no puede estar en el pasado');
  }

  // Serializable: si dos reservas simultaneas pasan el control de solapamiento,
  // Postgres aborta una de las dos (P2034) en lugar de guardar ambas
  return prisma.$transaction(
    async (tx) => {
      const cochera = await tx.cochera.findUnique({ where: { id: data.cocheraId } });
      if (!cochera) throw HttpError.notFound('Cochera no encontrada');
      if (cochera.estado === EstadoCochera.INHABILITADA) {
        throw HttpError.conflict('La cochera esta inhabilitada');
      }

      const usuario = await tx.usuario.findUnique({ where: { id: data.usuarioId } });
      if (!usuario) throw HttpError.notFound('Usuario no encontrado');
      if (usuario.rol !== Rol.CLIENTE) {
        throw HttpError.badRequest('Las reservas solo pueden pertenecer a un cliente');
      }

      const tipoEstadia = await tx.tipoEstadia.findUnique({ where: { id: data.tipoEstadiaId } });
      if (!tipoEstadia) throw HttpError.notFound('Tipo de estadia no encontrado');

      const tipoVehiculo = await tx.tipoVehiculo.findUnique({ where: { id: data.tipoVehiculoId } });
      if (!tipoVehiculo) throw HttpError.notFound('Tipo de vehiculo no encontrado');

      const solapada = await tx.reserva.findFirst({
        where: { cocheraId: data.cocheraId, ...ocupanEnRango(data.fechaInicio, data.fechaFin) },
      });
      if (solapada) {
        throw HttpError.conflict('La cochera ya esta reservada en ese horario', {
          reservaId: solapada.id,
        });
      }

      const tarifa = await buscarTarifaVigente(
        tx,
        data.tipoVehiculoId,
        data.tipoEstadiaId,
        data.fechaInicio,
      );
      if (!tarifa) {
        throw HttpError.conflict('No hay tarifa vigente para ese tipo de vehiculo y estadia');
      }

      return tx.reserva.create({
        data: {
          ...data,
          precioTotal: calcularPrecio(
            tarifa.valor,
            data.fechaInicio,
            data.fechaFin,
            tipoEstadia.duracionMinutos,
          ),
        },
        include,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function actualizar(
  id: number,
  data: ActualizarReservaInput,
  solicitante: UsuarioAutenticado,
) {
  const reserva = await obtener(id, solicitante);
  if (reserva.estado !== EstadoReserva.PENDIENTE) {
    throw HttpError.conflict('Solo se pueden modificar reservas pendientes');
  }
  return prisma.reserva.update({ where: { id }, data, include });
}

/**
 * CU3 Reprogramar reserva: cambia las fechas de una reserva pendiente.
 * Si su cochera no esta libre en el nuevo horario (u hoy esta inhabilitada), la reasigna a otra
 * libre de la misma playa y con el mismo techo. Recalcula el precio con la tarifa vigente
 * a la nueva fecha de inicio.
 */
export async function reprogramar(
  id: number,
  { fechaInicio, fechaFin }: ReprogramarReservaInput,
  solicitante: UsuarioAutenticado,
) {
  if (fechaInicio < new Date()) {
    throw HttpError.badRequest('La fecha de inicio no puede estar en el pasado');
  }

  // Serializable por el mismo motivo que crear: dos reprogramaciones o altas simultaneas
  // no pueden quedarse con la misma cochera en el mismo horario
  return prisma.$transaction(
    async (tx) => {
      const reserva = await tx.reserva.findUnique({
        where: { id },
        include: { cochera: true, tipoEstadia: true },
      });
      const propietario = soloPropias(solicitante);
      if (!reserva || (propietario !== undefined && reserva.usuarioId !== propietario)) {
        throw HttpError.notFound('Reserva no encontrada');
      }
      if (reserva.estado !== EstadoReserva.PENDIENTE) {
        throw HttpError.conflict('Solo se pueden reprogramar reservas pendientes');
      }

      // La propia reserva no cuenta como solapamiento consigo misma
      const otrasEnRango = { id: { not: id }, ...ocupanEnRango(fechaInicio, fechaFin) };

      let { cocheraId } = reserva;
      const cocheraLibre =
        reserva.cochera.estado !== EstadoCochera.INHABILITADA &&
        !(await tx.reserva.findFirst({ where: { cocheraId, ...otrasEnRango } }));

      if (!cocheraLibre) {
        const alternativa = await tx.cochera.findFirst({
          where: {
            id: { not: cocheraId },
            playaId: reserva.cochera.playaId,
            techada: reserva.cochera.techada,
            estado: { not: EstadoCochera.INHABILITADA },
            reservas: { none: otrasEnRango },
          },
          orderBy: { id: 'asc' },
        });
        if (!alternativa) {
          throw HttpError.conflict('No hay cocheras disponibles en ese horario');
        }
        cocheraId = alternativa.id;
      }

      const tarifa = await buscarTarifaVigente(
        tx,
        reserva.tipoVehiculoId,
        reserva.tipoEstadiaId,
        fechaInicio,
      );
      if (!tarifa) {
        throw HttpError.conflict('No hay tarifa vigente para ese tipo de vehiculo y estadia');
      }

      return tx.reserva.update({
        where: { id },
        data: {
          fechaInicio,
          fechaFin,
          cocheraId,
          precioTotal: calcularPrecio(
            tarifa.valor,
            fechaInicio,
            fechaFin,
            reserva.tipoEstadia.duracionMinutos,
          ),
        },
        include,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Cancela una reserva: pasa a CANCELADA y queda en el historial (no se borra).
 * Un CLIENTE solo cancela sus reservas pendientes. Un ADMIN tambien cancela una ACTIVA
 * (el vehiculo ya ingreso), y en ese caso se libera la cochera.
 */
export async function cancelar(id: number, solicitante: UsuarioAutenticado) {
  const reserva = await obtener(id, solicitante);
  const cancelables: EstadoReserva[] =
    solicitante.rol === Rol.ADMIN
      ? [EstadoReserva.PENDIENTE, EstadoReserva.ACTIVA]
      : [EstadoReserva.PENDIENTE];
  if (!cancelables.includes(reserva.estado)) {
    throw HttpError.conflict(
      solicitante.rol === Rol.ADMIN
        ? 'Solo se pueden cancelar reservas pendientes o activas'
        : 'Solo se pueden cancelar reservas pendientes',
    );
  }

  return prisma.$transaction(async (tx) => {
    if (reserva.estado === EstadoReserva.ACTIVA) {
      await tx.cochera.update({
        where: { id: reserva.cochera.id },
        data: { estado: EstadoCochera.DISPONIBLE },
      });
    }
    return tx.reserva.update({
      where: { id },
      data: { estado: EstadoReserva.CANCELADA },
      include,
    });
  });
}

export async function eliminar(id: number) {
  const reserva = await obtener(id);
  if (!ESTADOS_ELIMINABLES.includes(reserva.estado)) {
    throw HttpError.conflict('Solo se pueden eliminar reservas pendientes o canceladas');
  }
  await prisma.reserva.delete({ where: { id } });
}
