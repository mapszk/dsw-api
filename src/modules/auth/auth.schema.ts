import { z } from 'zod';
import { crearUsuarioSchema } from '../usuario/usuario.schema.js';

// El registro publico siempre crea clientes: el rol no se acepta desde afuera
export const registrarSchema = crearUsuarioSchema.omit({ rol: true });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

export type RegistrarInput = z.infer<typeof registrarSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
