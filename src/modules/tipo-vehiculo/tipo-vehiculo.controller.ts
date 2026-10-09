import type { Request, Response } from 'express';
import { toTipoVehiculoDto } from './tipo-vehiculo.dto.js';
import * as tipoVehiculoService from './tipo-vehiculo.service.js';

export async function listar(_req: Request, res: Response) {
  res.json((await tipoVehiculoService.listar()).map(toTipoVehiculoDto));
}

export async function obtener(_req: Request, res: Response) {
  res.json(toTipoVehiculoDto(await tipoVehiculoService.obtener(res.locals.params.id)));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(toTipoVehiculoDto(await tipoVehiculoService.crear(req.body)));
}

export async function actualizar(req: Request, res: Response) {
  res.json(toTipoVehiculoDto(await tipoVehiculoService.actualizar(res.locals.params.id, req.body)));
}

export async function eliminar(_req: Request, res: Response) {
  await tipoVehiculoService.eliminar(res.locals.params.id);
  res.status(204).end();
}
