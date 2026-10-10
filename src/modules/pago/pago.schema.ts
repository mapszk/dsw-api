import { z } from 'zod';

export const metodoPagoSchema = z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], {
  error: 'El método debe ser EFECTIVO, TARJETA o TRANSFERENCIA',
});

export const crearPagoSchema = z.object({
  fecha: z.coerce.date({ error: 'La fecha no es válida' }).optional(),
  metodo: metodoPagoSchema,
  monto: z.coerce.number({ error: 'El monto debe ser un número' }).positive('El monto debe ser mayor a 0'),
  reservaId: z.number({ error: 'La reserva es obligatoria' }).int().positive(),
});

export const actualizarPagoSchema = crearPagoSchema.omit({ reservaId: true }).partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
export type ActualizarPagoInput = z.infer<typeof actualizarPagoSchema>;