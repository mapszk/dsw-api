import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import * as usuarioController from './usuario.controller.js';
import { actualizarUsuarioSchema, crearUsuarioSchema } from './usuario.schema.js';

export const usuarioRouter = Router();

usuarioRouter.use(authenticate, authorize(Rol.ADMIN));

usuarioRouter.get('/', usuarioController.listar);
usuarioRouter.get('/:id', validate({ params: idParamSchema }), usuarioController.obtener);
usuarioRouter.post('/', validate({ body: crearUsuarioSchema }), usuarioController.crear);
usuarioRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: actualizarUsuarioSchema }),
  usuarioController.actualizar,
);
usuarioRouter.delete('/:id', validate({ params: idParamSchema }), usuarioController.eliminar);
