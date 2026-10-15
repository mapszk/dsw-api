import type { Request, Response } from 'express';
import { toReservaDto } from './reserva.dto.js';
import * as reservaService from './reserva.service.js';
import type { RegistrarPagoInput } from './reserva.schema.js';

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

export async function reprogramar(req: Request, res: Response) {
  res.json(
    toReservaDto(
      await reservaService.reprogramar(res.locals.params.id, req.body, res.locals.usuario),
    ),
  );
}

export async function cancelar(_req: Request, res: Response) {
  res.json(toReservaDto(await reservaService.cancelar(res.locals.params.id, res.locals.usuario)));
}

export async function eliminar(_req: Request, res: Response) {
  await reservaService.eliminar(res.locals.params.id);
  res.status(204).end();
}

export async function aprobar(_req: Request, res: Response) {
  res.json(toReservaDto(await reservaService.aprobar(res.locals.params.id)));
}

export async function registrarPago(req: Request, res: Response) {
  const data = req.body as RegistrarPagoInput;
  res.json(toReservaDto(await reservaService.registrarPago(res.locals.params.id, data)));
}
