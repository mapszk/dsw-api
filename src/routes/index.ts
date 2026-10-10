import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { reservaRouter } from '../modules/reserva/reserva.routes.js';
import { tarifaRouter } from '../modules/tarifa/tarifa.routes.js';
import { tipoEstadiaRouter } from '../modules/tipo-estadia/tipo-estadia.routes.js';
import { tipoVehiculoRouter } from '../modules/tipo-vehiculo/tipo-vehiculo.routes.js';
import { usuarioRouter } from '../modules/usuario/usuario.routes.js';
import { playaRouter } from '../modules/playas/playa.routes.js';
import { cocheraRouter } from '../modules/cochera/cochera.routes.js';
import { pagoRouter } from '../modules/pago/pago.routes.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
router.use('/playas', playaRouter);
router.use('/auth', authRouter);
router.use('/tipos-estadia', tipoEstadiaRouter);
router.use('/tipos-vehiculo', tipoVehiculoRouter);
router.use('/tarifas', tarifaRouter);
router.use('/usuarios', usuarioRouter);
router.use('/reservas', reservaRouter);
router.use('/cocheras', cocheraRouter);
router.use('/pagos', pagoRouter);