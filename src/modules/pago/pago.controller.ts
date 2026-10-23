import type { Request, Response } from 'express';
import { toPagoDto } from './pago.dto.js';
import * as pagoService from './pago.service.js';

export const listar = async (_req: Request, res: Response) => {
  const pagos = await pagoService.listarPagos(res.locals.query);
  res.json(pagos.map(toPagoDto));
};

export const obtener = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const pago = await pagoService.obtenerPago(id);
  res.json(toPagoDto(pago));
};

export const crear = async (req: Request, res: Response) => {
  const pago = await pagoService.crearPago(req.body);
  res.status(201).json(toPagoDto(pago));
};

export const actualizar = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const pago = await pagoService.actualizarPago(id, req.body);
  res.json(toPagoDto(pago));
};

export const eliminar = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  await pagoService.eliminarPago(id);
  res.status(204).send();
};
