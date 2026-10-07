import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Mock de Prisma para que el test no dependa de una base de datos levantada
vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));

const { app } = await import('../src/app.js');

describe('GET /api/health', () => {
  it('responde 200 con status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('Rutas inexistentes', () => {
  it('responde 404 con formato de error', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Ruta no encontrada');
  });
});
