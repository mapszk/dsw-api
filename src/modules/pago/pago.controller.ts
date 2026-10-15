import type { Request, Response } from 'express';
import * as pagoService from './pago.service.js';

export const listar = async (_req: Request, res: Response) => {
  const pagos = await pagoService.listarPagos();
  res.json(pagos);
};

export const obtener = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const pago = await pagoService.obtenerPago(id);
  res.json(pago);
};

export const crear = async (req: Request, res: Response) => {
  const pago = await pagoService.crearPago(req.body);
  res.status(201).json(pago);
};

export const actualizar = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const pago = await pagoService.actualizarPago(id, req.body);
  res.json(pago);
};

export const eliminar = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  await pagoService.eliminarPago(id);
  res.status(204).send();
};