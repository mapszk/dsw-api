import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { reservaRouter } from '../modules/reserva/reserva.routes.js';
import { tipoEstadiaRouter } from '../modules/tipo-estadia/tipo-estadia.routes.js';
import { usuarioRouter } from '../modules/usuario/usuario.routes.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});

router.use('/auth', authRouter);
router.use('/tipos-estadia', tipoEstadiaRouter);
router.use('/usuarios', usuarioRouter);
router.use('/reservas', reservaRouter);
