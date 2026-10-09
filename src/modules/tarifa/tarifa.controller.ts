import type { Request, Response } from 'express';
import { toTarifaDto } from './tarifa.dto.js';
import * as tarifaService from './tarifa.service.js';

export async function listar(_req: Request, res: Response) {
  res.json((await tarifaService.listar()).map(toTarifaDto));
}

export async function obtenerVigente(_req: Request, res: Response) {
  res.json(toTarifaDto(await tarifaService.obtenerVigente(res.locals.query)));
}

export async function obtener(_req: Request, res: Response) {
  res.json(toTarifaDto(await tarifaService.obtener(res.locals.params.id)));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(toTarifaDto(await tarifaService.crear(req.body)));
}

export async function actualizar(req: Request, res: Response) {
  res.json(toTarifaDto(await tarifaService.actualizar(res.locals.params.id, req.body)));
}

export async function eliminar(_req: Request, res: Response) {
  await tarifaService.eliminar(res.locals.params.id);
  res.status(204).end();
}
