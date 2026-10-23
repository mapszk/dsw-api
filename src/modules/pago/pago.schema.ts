import { z } from 'zod';

// Todos los metodos, para filtrar: TARJETA solo aparece en pagos ya registrados
export const metodoPagoSchema = z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'ONLINE'], {
  error: 'El método debe ser EFECTIVO, TARJETA, TRANSFERENCIA u ONLINE',
});

// El ADMIN registra a mano solo efectivo y transferencia: los pagos online los crea el checkout
export const metodoPagoManualSchema = z.enum(['EFECTIVO', 'TRANSFERENCIA'], {
  error: 'El método debe ser EFECTIVO o TRANSFERENCIA',
});

export const crearPagoSchema = z.object({
  fecha: z.coerce.date({ error: 'La fecha no es válida' }).optional(),
  metodo: metodoPagoManualSchema,
  monto: z.coerce
    .number({ error: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor a 0'),
  reservaId: z.number({ error: 'La reserva es obligatoria' }).int().positive(),
});

export const actualizarPagoSchema = crearPagoSchema.omit({ reservaId: true }).partial();

export const estadoPagoSchema = z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO'], {
  error: 'El estado debe ser PENDIENTE, APROBADO o RECHAZADO',
});

export const listarPagosQuerySchema = z.object({
  estado: estadoPagoSchema.optional(),
  metodo: metodoPagoSchema.optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
export type ActualizarPagoInput = z.infer<typeof actualizarPagoSchema>;
export type ListarPagosQuery = z.infer<typeof listarPagosQuerySchema>;
