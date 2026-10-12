import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as playaController from './playa.controller.js';
import {
  actualizarPlayaSchema,
  crearPlayaSchema,
  filtrosCocherasSchema,
  idParamSchema,
} from './playa.schema.js';

export const playaRouter = Router();

playaRouter.use(authenticate);

playaRouter.get('/', playaController.listar);
playaRouter.get('/:id', validate({ params: idParamSchema }), playaController.obtener);
playaRouter.get(
  '/:id/cocheras',
  validate({ params: idParamSchema, query: filtrosCocherasSchema }),
  playaController.listarCocheras,
);
playaRouter.post(
  '/',
  authorize(Rol.ADMIN),
  validate({ body: crearPlayaSchema }),
  playaController.crear,
);
playaRouter.put(
  '/:id',
  authorize(Rol.ADMIN),
  validate({ params: idParamSchema, body: actualizarPlayaSchema }),
  playaController.actualizar,
);
playaRouter.delete(
  '/:id',
  authorize(Rol.ADMIN),
  validate({ params: idParamSchema }),
  playaController.eliminar,
);