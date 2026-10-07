import { EstadoCochera, EstadoReserva, Prisma, Rol } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ActualizarReservaInput,
  CrearReservaInput,
  ListarReservasQuery,
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

export function listar(filtros: ListarReservasQuery) {
  return prisma.reserva.findMany({
    where: filtros,
    include,
    orderBy: { fechaInicio: 'desc' },
  });
}

export async function obtener(id: number) {
  const reserva = await prisma.reserva.findUnique({ where: { id }, include });
  if (!reserva) throw HttpError.notFound('Reserva no encontrada');
  return reserva;
}

export async function crear(data: CrearReservaInput) {
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
        where: {
          cocheraId: data.cocheraId,
          estado: { in: ESTADOS_QUE_OCUPAN },
          fechaInicio: { lt: data.fechaFin },
          fechaFin: { gt: data.fechaInicio },
        },
      });
      if (solapada) {
        throw HttpError.conflict('La cochera ya esta reservada en ese horario', {
          reservaId: solapada.id,
        });
      }

      // Tarifa vigente: la ultima que empezo a regir antes del inicio de la reserva
      const tarifa = await tx.tarifa.findFirst({
        where: {
          tipoVehiculoId: data.tipoVehiculoId,
          tipoEstadiaId: data.tipoEstadiaId,
          fechaDesde: { lte: data.fechaInicio },
        },
        orderBy: { fechaDesde: 'desc' },
      });
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

export async function actualizar(id: number, data: ActualizarReservaInput) {
  const reserva = await obtener(id);
  if (reserva.estado !== EstadoReserva.PENDIENTE) {
    throw HttpError.conflict('Solo se pueden modificar reservas pendientes');
  }
  return prisma.reserva.update({ where: { id }, data, include });
}

export async function eliminar(id: number) {
  const reserva = await obtener(id);
  if (!ESTADOS_ELIMINABLES.includes(reserva.estado)) {
    throw HttpError.conflict('Solo se pueden eliminar reservas pendientes o canceladas');
  }
  await prisma.reserva.delete({ where: { id } });
}
