import type { Request, Response } from 'express';
import * as reservaService from './reserva.service.js';

export async function listar(_req: Request, res: Response) {
  res.json(await reservaService.listar(res.locals.query));
}

export async function obtener(_req: Request, res: Response) {
  res.json(await reservaService.obtener(res.locals.params.id));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(await reservaService.crear(req.body));
}

export async function actualizar(req: Request, res: Response) {
  res.json(await reservaService.actualizar(res.locals.params.id, req.body));
}

export async function eliminar(_req: Request, res: Response) {
  await reservaService.eliminar(res.locals.params.id);
  res.status(204).end();
}
