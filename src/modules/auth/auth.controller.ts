import type { Request, Response } from 'express';
import { toUsuarioDto } from '../usuario/usuario.dto.js';
import * as usuarioService from '../usuario/usuario.service.js';
import * as authService from './auth.service.js';

export async function registrar(req: Request, res: Response) {
  const { token, usuario } = await authService.registrar(req.body);
  res.status(201).json({ token, usuario: toUsuarioDto(usuario) });
}

export async function login(req: Request, res: Response) {
  const { token, usuario } = await authService.login(req.body);
  res.json({ token, usuario: toUsuarioDto(usuario) });
}

export async function perfil(_req: Request, res: Response) {
  res.json(toUsuarioDto(await usuarioService.obtener(res.locals.usuario.id)));
}
