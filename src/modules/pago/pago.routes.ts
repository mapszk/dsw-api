import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import * as pagoController from './pago.controller.js';
import { actualizarPagoSchema, crearPagoSchema, idParamSchema } from './pago.schema.js';

export const pagoRouter = Router();

pagoRouter.get('/', pagoController.listar);
pagoRouter.get('/:id', validate({ params: idParamSchema }), pagoController.obtener);
pagoRouter.post('/', validate({ body: crearPagoSchema }), pagoController.crear);
pagoRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: actualizarPagoSchema }),
  pagoController.actualizar,
);
pagoRouter.delete('/:id', validate({ params: idParamSchema }), pagoController.eliminar);