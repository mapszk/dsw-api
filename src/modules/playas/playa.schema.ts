import { z } from 'zod';
import { estadoCocheraSchema } from '../cochera/cochera.schema.js';


export const crearPlayaSchema = z.object({
  sector: z.string().min(1, 'El sector es obligatorio'),
});

export const actualizarPlayaSchema = crearPlayaSchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CrearPlayaInput = z.infer<typeof crearPlayaSchema>;
export type ActualizarPlayaInput = z.infer<typeof actualizarPlayaSchema>;


export const filtrosCocherasSchema = z.object({
  estado: estadoCocheraSchema.optional(),
  techada: z
    .enum(['true', 'false'], { error: 'techada debe ser true o false' })
    .transform((valor) => valor === 'true')
    .optional(),
});

export type FiltrosCocherasInput = z.infer<typeof filtrosCocherasSchema>;