import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

const { app } = await import('../src/app.js');

describe('GET /api/docs', () => {
  it('sirve la documentacion de la API (Swagger UI)', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('no exige sesion', async () => {
    const res = await request(app).get('/api/docs/swagger-ui-init.js');

    expect(res.status).toBe(200);
    expect(res.text).toContain('DSW API');
  });
});
