import { z } from 'zod';
import { EstadoReserva } from '../../generated/prisma/client.js';

const id = z.number().int().positive();

// Patente argentina sin espacios ni guiones: ABC123 (vieja) o AB123CD (Mercosur)
const patente = z
  .string()
  .transform((valor) => valor.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/, 'Patente invalida'));

export const crearReservaSchema = z
  .object({
    patente,
    fechaInicio: z.coerce.date(),
    fechaFin: z.coerce.date(),
    // Obligatorio para ADMIN; si reserva un CLIENTE se usa el usuario logueado
    usuarioId: id.optional(),
    cocheraId: id,
    tipoVehiculoId: id,
    tipoEstadiaId: id,
  })
  .refine((data) => data.fechaFin > data.fechaInicio, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['fechaFin'],
  });

// Fechas, cochera y tipos cambian el precio y la disponibilidad: se modifican con los casos de uso
export const actualizarReservaSchema = z.object({ patente });

export const reprogramarReservaSchema = z
  .object({
    fechaInicio: z.coerce.date(),
    fechaFin: z.coerce.date(),
  })
  .refine((data) => data.fechaFin > data.fechaInicio, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['fechaFin'],
  });

export const listarReservasQuerySchema = z.object({
  estado: z.enum(EstadoReserva).optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  cocheraId: z.coerce.number().int().positive().optional(),
});

export type CrearReservaInput = z.infer<typeof crearReservaSchema>;
export type ActualizarReservaInput = z.infer<typeof actualizarReservaSchema>;
export type ReprogramarReservaInput = z.infer<typeof reprogramarReservaSchema>;
export type ListarReservasQuery = z.infer<typeof listarReservasQuerySchema>;
