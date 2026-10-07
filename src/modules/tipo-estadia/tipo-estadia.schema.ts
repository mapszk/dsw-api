import { z } from 'zod';

export const crearTipoEstadiaSchema = z.object({
  tipo: z.string().trim().min(1).max(50).toUpperCase(),
  duracionMinutos: z.number().int().positive(),
});

export const actualizarTipoEstadiaSchema = crearTipoEstadiaSchema.partial();

export type CrearTipoEstadiaInput = z.infer<typeof crearTipoEstadiaSchema>;
export type ActualizarTipoEstadiaInput = z.infer<typeof actualizarTipoEstadiaSchema>;
