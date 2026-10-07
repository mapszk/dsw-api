import { z } from 'zod';

const id = z.number().int().positive();

export const crearTarifaSchema = z.object({
  valor: z.number().positive().max(99_999_999.99).multipleOf(0.01),
  fechaDesde: z.coerce.date(),
  tipoVehiculoId: id,
  tipoEstadiaId: id,
});

export const actualizarTarifaSchema = crearTarifaSchema.partial();

export const tarifaVigenteQuerySchema = z.object({
  tipoVehiculoId: z.coerce.number().int().positive(),
  tipoEstadiaId: z.coerce.number().int().positive(),
  fecha: z.coerce.date().optional(),
});

export type CrearTarifaInput = z.infer<typeof crearTarifaSchema>;
export type ActualizarTarifaInput = z.infer<typeof actualizarTarifaSchema>;
export type TarifaVigenteQuery = z.infer<typeof tarifaVigenteQuerySchema>;
