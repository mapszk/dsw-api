import type { Request, Response } from 'express';
import * as playaService from './playa.service.js';

export const listar = async (_req: Request, res: Response) => {
  const playas = await playaService.listarPlayas();
  res.json(playas);
};

export const obtener = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const playa = await playaService.obtenerPlaya(id);
  res.json(playa);
};

export const crear = async (req: Request, res: Response) => {
  const playa = await playaService.crearPlaya(req.body);
  res.status(201).json(playa);
};

export const actualizar = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const playa = await playaService.actualizarPlaya(id, req.body);
  res.json(playa);
};

export const eliminar = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  await playaService.eliminarPlaya(id);
  res.status(204).send();
};