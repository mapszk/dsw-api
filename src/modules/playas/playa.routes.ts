import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import * as playaController from './playa.controller.js';
import { actualizarPlayaSchema, crearPlayaSchema, idParamSchema } from './playa.schema.js';

export const playaRouter = Router();

playaRouter.get('/', playaController.listar);
playaRouter.get('/:id', validate({ params: idParamSchema }), playaController.obtener);
playaRouter.post('/', validate({ body: crearPlayaSchema }), playaController.crear);
playaRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: actualizarPlayaSchema }),
  playaController.actualizar,
);
playaRouter.delete('/:id', validate({ params: idParamSchema }), playaController.eliminar);