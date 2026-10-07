import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../utils/http-error.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Datos invalidos', details: z.flattenError(err).fieldErrors },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: violacion de unique, P2025: registro no encontrado, P2003: FK invalida
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'Ya existe un registro con esos datos' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Recurso no encontrado' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: { message: 'El registro esta relacionado con otros datos' } });
      return;
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { message: 'JSON mal formado' } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      message: 'Error interno del servidor',
      details: env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined,
    },
  });
}
