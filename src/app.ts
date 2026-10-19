import { readFileSync } from 'node:fs';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { router } from './routes/index.js';

// La ruta es relativa a este archivo: funciona igual desde src/ (dev) y desde dist/ (build)
const openapi = parse(readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'));

export const app = express();

app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api', router);

app.use(notFound);
app.use(errorHandler);
