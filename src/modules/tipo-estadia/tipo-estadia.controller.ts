import type { Request, Response } from 'express';
import { toTipoEstadiaDto } from './tipo-estadia.dto.js';
import * as tipoEstadiaService from './tipo-estadia.service.js';

export async function listar(_req: Request, res: Response) {
  res.json((await tipoEstadiaService.listar()).map(toTipoEstadiaDto));
}

export async function obtener(_req: Request, res: Response) {
  res.json(toTipoEstadiaDto(await tipoEstadiaService.obtener(res.locals.params.id)));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(toTipoEstadiaDto(await tipoEstadiaService.crear(req.body)));
}

export async function actualizar(req: Request, res: Response) {
  res.json(toTipoEstadiaDto(await tipoEstadiaService.actualizar(res.locals.params.id, req.body)));
}

export async function eliminar(_req: Request, res: Response) {
  await tipoEstadiaService.eliminar(res.locals.params.id);
  res.status(204).end();
}
