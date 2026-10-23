import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  // MercadoPago: opcionales para que la API (y los tests) arranquen sin credenciales.
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  // URL publica de la API (sin /api) a la que MP manda los avisos;
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
  // A donde vuelve el cliente despues de pagar en MP
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  // Vencimiento del checkout de un pago online: mientras este vigente no se puede cobrar a mano
  PAGO_ONLINE_VENCIMIENTO_MINUTOS: z.coerce.number().int().positive().default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
