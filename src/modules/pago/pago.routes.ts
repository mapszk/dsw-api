import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { mercadopago } from './mercadopago.service.js';
import * as pagoController from './pago.controller.js';
import {
  actualizarPagoSchema,
  crearPagoSchema,
  idParamSchema,
  listarPagosQuerySchema,
} from './pago.schema.js';

export const pagoRouter = Router();

pagoRouter.use(authenticate, authorize(Rol.ADMIN));

pagoRouter.get('/', validate({ query: listarPagosQuerySchema }), pagoController.listar);
pagoRouter.get('/:id', validate({ params: idParamSchema }), pagoController.obtener);
pagoRouter.post('/', validate({ body: crearPagoSchema }), pagoController.crear);
pagoRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: actualizarPagoSchema }),
  pagoController.actualizar,
);
pagoRouter.delete('/:id', validate({ params: idParamSchema }), pagoController.eliminar);

export const webhookRouter = Router();

webhookRouter.post('/mercadopago', pagoController.webhook(mercadopago));
