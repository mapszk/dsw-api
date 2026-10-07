import type { Request, Response } from 'express';
import { toReservaDto } from './reserva.dto.js';
import * as reservaService from './reserva.service.js';

export async function listar(_req: Request, res: Response) {
  res.json((await reservaService.listar(res.locals.query, res.locals.usuario)).map(toReservaDto));
}

export async function obtener(_req: Request, res: Response) {
  res.json(toReservaDto(await reservaService.obtener(res.locals.params.id, res.locals.usuario)));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(toReservaDto(await reservaService.crear(req.body, res.locals.usuario)));
}

export async function actualizar(req: Request, res: Response) {
  res.json(
    toReservaDto(
      await reservaService.actualizar(res.locals.params.id, req.body, res.locals.usuario),
    ),
  );
}

export async function eliminar(_req: Request, res: Response) {
  await reservaService.eliminar(res.locals.params.id);
  res.status(204).end();
}
