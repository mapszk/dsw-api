import { z } from 'zod';

export const crearPlayaSchema = z.object({
  sector: z.string().min(1, 'El sector es obligatorio'),
});

export const actualizarPlayaSchema = crearPlayaSchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CrearPlayaInput = z.infer<typeof crearPlayaSchema>;
export type ActualizarPlayaInput = z.infer<typeof actualizarPlayaSchema>;