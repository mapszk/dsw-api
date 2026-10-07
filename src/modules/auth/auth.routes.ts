import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema, registrarSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registrarSchema }), authController.registrar);
authRouter.post('/login', validate({ body: loginSchema }), authController.login);
authRouter.get('/me', authenticate, authController.perfil);
