import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import * as cocheraController from './cochera.controller.js';
import { actualizarCocheraSchema, crearCocheraSchema, idParamSchema } from './cochera.schema.js';

export const cocheraRouter = Router();

cocheraRouter.get('/', cocheraController.listar);
cocheraRouter.get('/:id', validate({ params: idParamSchema }), cocheraController.obtener);
cocheraRouter.post('/', validate({ body: crearCocheraSchema }), cocheraController.crear);
cocheraRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: actualizarCocheraSchema }),
  cocheraController.actualizar,
);
cocheraRouter.delete('/:id', validate({ params: idParamSchema }), cocheraController.eliminar);