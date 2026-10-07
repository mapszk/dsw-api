import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { authHeader } from './helpers/auth.js';

const tipoVehiculo = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../src/lib/prisma.js', () => ({ prisma: { tipoVehiculo } }));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const tokenCliente = authHeader('CLIENTE', 2);

const auto = { id: 1, tipo: 'AUTO', createdAt: new Date(), updatedAt: new Date() };

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('Error de Prisma', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });
}

describe('/api/tipos-vehiculo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista los tipos de vehiculo sin timestamps', async () => {
    tipoVehiculo.findMany.mockResolvedValue([auto]);

    const res = await request(app).get('/api/tipos-vehiculo').set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, tipo: 'AUTO' }]);
  });

  it('responde 404 si el tipo de vehiculo no existe', async () => {
    tipoVehiculo.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/tipos-vehiculo/99').set('Authorization', admin);

    expect(res.status).toBe(404);
  });

  it('crea el tipo de vehiculo normalizado en mayusculas', async () => {
    tipoVehiculo.create.mockImplementation(({ data }) => Promise.resolve({ ...auto, ...data }));

    const res = await request(app)
      .post('/api/tipos-vehiculo')
      .set('Authorization', admin)
      .send({ tipo: '  auto ' });

    expect(res.status).toBe(201);
    expect(tipoVehiculo.create).toHaveBeenCalledWith({ data: { tipo: 'AUTO' } });
  });

  it('responde 400 si el tipo esta vacio', async () => {
    const res = await request(app)
      .post('/api/tipos-vehiculo')
      .set('Authorization', admin)
      .send({ tipo: '   ' });

    expect(res.status).toBe(400);
    expect(tipoVehiculo.create).not.toHaveBeenCalled();
  });

  it('responde 409 si el tipo ya existe', async () => {
    tipoVehiculo.create.mockRejectedValue(errorPrisma('P2002'));

    const res = await request(app)
      .post('/api/tipos-vehiculo')
      .set('Authorization', admin)
      .send({ tipo: 'AUTO' });

    expect(res.status).toBe(409);
  });

  it('responde 409 al eliminar un tipo con tarifas o reservas', async () => {
    tipoVehiculo.delete.mockRejectedValue(errorPrisma('P2003'));

    const res = await request(app).delete('/api/tipos-vehiculo/1').set('Authorization', admin);

    expect(res.status).toBe(409);
  });

  it('elimina el tipo de vehiculo', async () => {
    tipoVehiculo.delete.mockResolvedValue(auto);

    const res = await request(app).delete('/api/tipos-vehiculo/1').set('Authorization', admin);

    expect(res.status).toBe(204);
  });

  it('responde 401 sin token', async () => {
    const res = await request(app).get('/api/tipos-vehiculo');

    expect(res.status).toBe(401);
  });

  it('permite consultar a un cliente pero no crear', async () => {
    tipoVehiculo.findMany.mockResolvedValue([auto]);

    const consulta = await request(app)
      .get('/api/tipos-vehiculo')
      .set('Authorization', tokenCliente);
    const alta = await request(app)
      .post('/api/tipos-vehiculo')
      .set('Authorization', tokenCliente)
      .send({ tipo: 'AUTO' });

    expect(consulta.status).toBe(200);
    expect(alta.status).toBe(403);
    expect(tipoVehiculo.create).not.toHaveBeenCalled();
  });
});
