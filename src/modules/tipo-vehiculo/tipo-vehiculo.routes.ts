import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as tipoVehiculoController from './tipo-vehiculo.controller.js';
import { idParamSchema } from '../../utils/schemas.js';
import { actualizarTipoVehiculoSchema, crearTipoVehiculoSchema } from './tipo-vehiculo.schema.js';

export const tipoVehiculoRouter = Router();
const soloAdmin = authorize(Rol.ADMIN);

// Cualquier usuario logueado consulta; solo ADMIN modifica
tipoVehiculoRouter.use(authenticate);

tipoVehiculoRouter.get('/', tipoVehiculoController.listar);
tipoVehiculoRouter.get('/:id', validate({ params: idParamSchema }), tipoVehiculoController.obtener);
tipoVehiculoRouter.post(
  '/',
  soloAdmin,
  validate({ body: crearTipoVehiculoSchema }),
  tipoVehiculoController.crear,
);
tipoVehiculoRouter.patch(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema, body: actualizarTipoVehiculoSchema }),
  tipoVehiculoController.actualizar,
);
tipoVehiculoRouter.delete(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema }),
  tipoVehiculoController.eliminar,
);
