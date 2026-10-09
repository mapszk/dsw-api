import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as tipoEstadiaController from './tipo-estadia.controller.js';
import { idParamSchema } from '../../utils/schemas.js';
import { actualizarTipoEstadiaSchema, crearTipoEstadiaSchema } from './tipo-estadia.schema.js';

export const tipoEstadiaRouter = Router();
const soloAdmin = authorize(Rol.ADMIN);

// Cualquier usuario logueado consulta; solo ADMIN modifica
tipoEstadiaRouter.use(authenticate);

tipoEstadiaRouter.get('/', tipoEstadiaController.listar);
tipoEstadiaRouter.get('/:id', validate({ params: idParamSchema }), tipoEstadiaController.obtener);
tipoEstadiaRouter.post(
  '/',
  soloAdmin,
  validate({ body: crearTipoEstadiaSchema }),
  tipoEstadiaController.crear,
);
tipoEstadiaRouter.patch(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema, body: actualizarTipoEstadiaSchema }),
  tipoEstadiaController.actualizar,
);
tipoEstadiaRouter.delete(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema }),
  tipoEstadiaController.eliminar,
);
