import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as cocheraController from './cochera.controller.js';
import { actualizarCocheraSchema, crearCocheraSchema, idParamSchema } from './cochera.schema.js';

export const cocheraRouter = Router();

cocheraRouter.use(authenticate);

cocheraRouter.get('/', cocheraController.listar);
cocheraRouter.get('/:id', validate({ params: idParamSchema }), cocheraController.obtener);
cocheraRouter.post(
  '/',
  authorize(Rol.ADMIN),
  validate({ body: crearCocheraSchema }),
  cocheraController.crear,
);
cocheraRouter.put(
  '/:id',
  authorize(Rol.ADMIN),
  validate({ params: idParamSchema, body: actualizarCocheraSchema }),
  cocheraController.actualizar,
);
cocheraRouter.delete(
  '/:id',
  authorize(Rol.ADMIN),
  validate({ params: idParamSchema }),
  cocheraController.eliminar,
);