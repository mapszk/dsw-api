import { z } from 'zod';

export const estadoCocheraSchema = z.enum(['DISPONIBLE', 'INHABILITADA'], {
  error: 'El estado debe ser DISPONIBLE o INHABILITADA',
});

export const crearCocheraSchema = z.object({
  techada: z.boolean({ error: 'techada debe ser true o false' }),
  estado: estadoCocheraSchema.optional(),
  playaId: z.number({ error: 'La playa es obligatoria' }).int().positive(),
});

export const actualizarCocheraSchema = crearCocheraSchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CrearCocheraInput = z.infer<typeof crearCocheraSchema>;
export type ActualizarCocheraInput = z.infer<typeof actualizarCocheraSchema>;