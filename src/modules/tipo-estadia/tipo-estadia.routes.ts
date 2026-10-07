import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import * as tipoEstadiaController from './tipo-estadia.controller.js';
import { idParamSchema } from '../../utils/schemas.js';
import { actualizarTipoEstadiaSchema, crearTipoEstadiaSchema } from './tipo-estadia.schema.js';

export const tipoEstadiaRouter = Router();

tipoEstadiaRouter.get('/', tipoEstadiaController.listar);
tipoEstadiaRouter.get('/:id', validate({ params: idParamSchema }), tipoEstadiaController.obtener);
tipoEstadiaRouter.post(
  '/',
  validate({ body: crearTipoEstadiaSchema }),
  tipoEstadiaController.crear,
);
tipoEstadiaRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: actualizarTipoEstadiaSchema }),
  tipoEstadiaController.actualizar,
);
tipoEstadiaRouter.delete(
  '/:id',
  validate({ params: idParamSchema }),
  tipoEstadiaController.eliminar,
);
