import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Schemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

/**
 * Valida body, params y/o query con schemas de Zod.
 * Los datos validados (ya transformados) quedan en req.body y res.locals.params / res.locals.query,
 * porque en Express 5 req.query y req.params son de solo lectura.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) res.locals.params = schemas.params.parse(req.params);
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    next();
  };
}
