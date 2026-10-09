import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { COOKIE_SESION } from '../../middlewares/auth.js';
import { toUsuarioDto } from '../usuario/usuario.dto.js';
import * as usuarioService from '../usuario/usuario.service.js';
import * as authService from './auth.service.js';

// httpOnly: el token no es accesible desde JavaScript (protege ante XSS).
// sameSite lax: el navegador no la manda en pedidos POST/PATCH/DELETE desde otros sitios (CSRF).
// secure: en produccion solo viaja por HTTPS.
const opcionesCookie: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};

function iniciarSesion(res: Response, token: string, expira: Date) {
  res.cookie(COOKIE_SESION, token, { ...opcionesCookie, expires: expira });
}

export async function registrar(req: Request, res: Response) {
  const { token, expira, usuario } = await authService.registrar(req.body);
  iniciarSesion(res, token, expira);
  res.status(201).json({ usuario: toUsuarioDto(usuario) });
}

export async function login(req: Request, res: Response) {
  const { token, expira, usuario } = await authService.login(req.body);
  iniciarSesion(res, token, expira);
  res.json({ usuario: toUsuarioDto(usuario) });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_SESION, opcionesCookie);
  res.status(204).end();
}

export async function perfil(_req: Request, res: Response) {
  res.json(toUsuarioDto(await usuarioService.obtener(res.locals.usuario.id)));
}
