import { z } from 'zod';

export const crearTipoVehiculoSchema = z.object({
  tipo: z.string().trim().min(1).max(50).toUpperCase(),
});

export const actualizarTipoVehiculoSchema = crearTipoVehiculoSchema.partial();

export type CrearTipoVehiculoInput = z.infer<typeof crearTipoVehiculoSchema>;
export type ActualizarTipoVehiculoInput = z.infer<typeof actualizarTipoVehiculoSchema>;
