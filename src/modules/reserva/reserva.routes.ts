import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import * as reservaController from './reserva.controller.js';
import {
  actualizarReservaSchema,
  crearReservaSchema,
  listarReservasQuerySchema,
} from './reserva.schema.js';

export const reservaRouter = Router();

reservaRouter.get('/', validate({ query: listarReservasQuerySchema }), reservaController.listar);
reservaRouter.get('/:id', validate({ params: idParamSchema }), reservaController.obtener);
reservaRouter.post('/', validate({ body: crearReservaSchema }), reservaController.crear);
reservaRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: actualizarReservaSchema }),
  reservaController.actualizar,
);
reservaRouter.delete('/:id', validate({ params: idParamSchema }), reservaController.eliminar);
