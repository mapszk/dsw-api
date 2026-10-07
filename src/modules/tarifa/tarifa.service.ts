import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type {
  ActualizarTarifaInput,
  CrearTarifaInput,
  TarifaVigenteQuery,
} from './tarifa.schema.js';

const include = {
  tipoVehiculo: true,
  tipoEstadia: true,
} satisfies Prisma.TarifaInclude;

export type TarifaConRelaciones = Prisma.TarifaGetPayload<{ include: typeof include }>;

export function listar() {
  return prisma.tarifa.findMany({
    include,
    orderBy: [{ tipoVehiculoId: 'asc' }, { tipoEstadiaId: 'asc' }, { fechaDesde: 'desc' }],
  });
}

export async function obtener(id: number) {
  const tarifa = await prisma.tarifa.findUnique({ where: { id }, include });
  if (!tarifa) throw HttpError.notFound('Tarifa no encontrada');
  return tarifa;
}

/** La tarifa vigente es la ultima que empezo a regir antes de la fecha indicada (por defecto, ahora). */
export async function obtenerVigente({
  tipoVehiculoId,
  tipoEstadiaId,
  fecha = new Date(),
}: TarifaVigenteQuery) {
  const tarifa = await prisma.tarifa.findFirst({
    where: { tipoVehiculoId, tipoEstadiaId, fechaDesde: { lte: fecha } },
    include,
    orderBy: { fechaDesde: 'desc' },
  });
  if (!tarifa)
    throw HttpError.notFound('No hay tarifa vigente para ese tipo de vehiculo y estadia');
  return tarifa;
}

export async function crear(data: CrearTarifaInput) {
  await validarTipos(data);
  return prisma.tarifa.create({ data, include });
}

// Las tarifas que ya empezaron a regir son historial: solo se editan las futuras
export async function actualizar(id: number, data: ActualizarTarifaInput) {
  const ahora = new Date();
  const tarifa = await obtener(id);
  if (tarifa.fechaDesde <= ahora) {
    throw HttpError.conflict('Solo se pueden modificar tarifas que todavia no estan vigentes');
  }
  if (data.fechaDesde && data.fechaDesde <= ahora) {
    throw HttpError.badRequest('La fecha desde debe ser futura');
  }
  await validarTipos(data);
  return prisma.tarifa.update({ where: { id }, data, include });
}

export async function eliminar(id: number) {
  const tarifa = await obtener(id);
  if (tarifa.fechaDesde <= new Date()) {
    throw HttpError.conflict('Solo se pueden eliminar tarifas que todavia no estan vigentes');
  }
  await prisma.tarifa.delete({ where: { id } });
}

// Sin este control, un id inexistente llega a la FK y se informaria como conflicto (409)
async function validarTipos({ tipoVehiculoId, tipoEstadiaId }: ActualizarTarifaInput) {
  if (tipoVehiculoId !== undefined) {
    const tipoVehiculo = await prisma.tipoVehiculo.findUnique({ where: { id: tipoVehiculoId } });
    if (!tipoVehiculo) throw HttpError.notFound('Tipo de vehiculo no encontrado');
  }
  if (tipoEstadiaId !== undefined) {
    const tipoEstadia = await prisma.tipoEstadia.findUnique({ where: { id: tipoEstadiaId } });
    if (!tipoEstadia) throw HttpError.notFound('Tipo de estadia no encontrado');
  }
}
