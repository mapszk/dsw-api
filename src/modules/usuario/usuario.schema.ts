import { z } from 'zod';
import { Rol } from '../../generated/prisma/client.js';

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  telefono: z.string().trim().min(6).max(20).nullish(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 digitos'),
  email: z.string().trim().toLowerCase().pipe(z.email('Email invalido')),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  rol: z.enum(Rol).default(Rol.CLIENTE),
});

// Sin default en rol: si no se envia, no se modifica
export const actualizarUsuarioSchema = crearUsuarioSchema.extend({ rol: z.enum(Rol) }).partial();

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
