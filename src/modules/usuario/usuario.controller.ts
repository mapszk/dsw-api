import type { Request, Response } from 'express';
import { toUsuarioDto } from './usuario.dto.js';
import * as usuarioService from './usuario.service.js';

export async function listar(_req: Request, res: Response) {
  res.json((await usuarioService.listar()).map(toUsuarioDto));
}

export async function obtener(_req: Request, res: Response) {
  res.json(toUsuarioDto(await usuarioService.obtener(res.locals.params.id)));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(toUsuarioDto(await usuarioService.crear(req.body)));
}

export async function actualizar(req: Request, res: Response) {
  res.json(toUsuarioDto(await usuarioService.actualizar(res.locals.params.id, req.body)));
}

export async function eliminar(_req: Request, res: Response) {
  await usuarioService.eliminar(res.locals.params.id);
  res.status(204).end();
}
