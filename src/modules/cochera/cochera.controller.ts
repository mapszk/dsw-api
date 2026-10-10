import type { Request, Response } from 'express';
import * as cocheraService from './cochera.service.js';

export const listar = async (_req: Request, res: Response) => {
  const cocheras = await cocheraService.listarCocheras();
  res.json(cocheras);
};

export const obtener = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const cochera = await cocheraService.obtenerCochera(id);
  res.json(cochera);
};

export const crear = async (req: Request, res: Response) => {
  const cochera = await cocheraService.crearCochera(req.body);
  res.status(201).json(cochera);
};

export const actualizar = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  const cochera = await cocheraService.actualizarCochera(id, req.body);
  res.json(cochera);
};

export const eliminar = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };
  await cocheraService.eliminarCochera(id);
  res.status(204).send();
};