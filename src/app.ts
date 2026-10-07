import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { router } from './routes/index.js';

export const app = express();

app.use(express.json());

app.use('/api', router);

app.use(notFound);
app.use(errorHandler);
