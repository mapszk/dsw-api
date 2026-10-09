import { Router } from 'express';
import { Rol } from '../../generated/prisma/client.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import * as reservaController from './reserva.controller.js';
import {
  actualizarReservaSchema,
  crearReservaSchema,
  listarReservasQuerySchema,
  reprogramarReservaSchema,
} from './reserva.schema.js';

export const reservaRouter = Router();

// ADMIN gestiona todas las reservas; un CLIENTE solo las suyas (lo controla el service)
reservaRouter.use(authenticate);

reservaRouter.get('/', validate({ query: listarReservasQuerySchema }), reservaController.listar);
reservaRouter.get('/:id', validate({ params: idParamSchema }), reservaController.obtener);
reservaRouter.post('/', validate({ body: crearReservaSchema }), reservaController.crear);
reservaRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: actualizarReservaSchema }),
  reservaController.actualizar,
);
// CU3: el cliente puede reprogramar sus reservas; ADMIN, cualquiera
reservaRouter.post(
  '/:id/reprogramar',
  validate({ params: idParamSchema, body: reprogramarReservaSchema }),
  reservaController.reprogramar,
);
// Un CLIENTE cancela sus reservas (quedan en el historial); eliminar es solo para ADMIN
reservaRouter.post(
  '/:id/cancelar',
  validate({ params: idParamSchema }),
  reservaController.cancelar,
);
reservaRouter.delete(
  '/:id',
  authorize(Rol.ADMIN),
  validate({ params: idParamSchema }),
  reservaController.eliminar,
);
