import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { tipoEstadiaRouter } from '../modules/tipo-estadia/tipo-estadia.routes.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});

router.use('/tipos-estadia', tipoEstadiaRouter);
