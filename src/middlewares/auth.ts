import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Rol } from '../generated/prisma/client.js';
import { HttpError } from '../utils/http-error.js';

export interface UsuarioAutenticado {
  id: number;
  rol: Rol;
}

/** Exige un token valido en `Authorization: Bearer <token>` y deja el usuario en res.locals.usuario. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw HttpError.unauthorized('Debe iniciar sesion');

  let payload: jwt.JwtPayload & { rol: Rol };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { rol: Rol };
  } catch {
    throw HttpError.unauthorized('La sesion es invalida o vencio');
  }

  res.locals.usuario = { id: Number(payload.sub), rol: payload.rol } satisfies UsuarioAutenticado;
  next();
}

/** Usar despues de authenticate. Permite el acceso solo a los roles indicados. */
export function authorize(...roles: Rol[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const usuario: UsuarioAutenticado | undefined = res.locals.usuario;
    if (!usuario || !roles.includes(usuario.rol)) {
      throw HttpError.forbidden('No tiene permisos para realizar esta accion');
    }
    next();
  };
}
