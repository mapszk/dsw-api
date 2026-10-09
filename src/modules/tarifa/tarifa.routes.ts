import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import * as tarifaController from './tarifa.controller.js';
import {
  actualizarTarifaSchema,
  crearTarifaSchema,
  tarifaVigenteQuerySchema,
} from './tarifa.schema.js';

export const tarifaRouter = Router();
const soloAdmin = authorize(Rol.ADMIN);

// Cualquier usuario logueado consulta; solo ADMIN modifica
tarifaRouter.use(authenticate);

tarifaRouter.get('/', tarifaController.listar);
// Antes de /:id para que "vigente" no se tome como id
tarifaRouter.get(
  '/vigente',
  validate({ query: tarifaVigenteQuerySchema }),
  tarifaController.obtenerVigente,
);
tarifaRouter.get('/:id', validate({ params: idParamSchema }), tarifaController.obtener);
tarifaRouter.post('/', soloAdmin, validate({ body: crearTarifaSchema }), tarifaController.crear);
tarifaRouter.patch(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema, body: actualizarTarifaSchema }),
  tarifaController.actualizar,
);
tarifaRouter.delete(
  '/:id',
  soloAdmin,
  validate({ params: idParamSchema }),
  tarifaController.eliminar,
);
