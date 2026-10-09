import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeader } from './helpers/auth.js';

const usuario = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../src/lib/prisma.js', () => ({ prisma: { usuario } }));

const { app } = await import('../src/app.js');

const admin = authHeader('ADMIN');
const tokenCliente = authHeader('CLIENTE', 2);

const cliente = {
  id: 2,
  nombre: 'Cliente Demo',
  telefono: null,
  dni: '11111111',
  email: 'cliente@dsw.com',
  rol: 'CLIENTE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const body = {
  nombre: 'Cliente Demo',
  dni: '11111111',
  email: ' Cliente@DSW.com ',
  password: 'dsw12345',
};

describe('/api/usuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista los usuarios sin la contraseña', async () => {
    usuario.findMany.mockResolvedValue([cliente]);

    const res = await request(app).get('/api/usuarios').set('Authorization', admin);

    expect(res.status).toBe(200);
    expect(usuario.findMany.mock.calls[0][0].omit).toEqual({ password: true });
    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('crea un cliente con la contraseña hasheada y no la devuelve', async () => {
    usuario.create.mockImplementation(({ data }) => Promise.resolve({ ...cliente, ...data }));

    const res = await request(app).post('/api/usuarios').set('Authorization', admin).send(body);

    expect(res.status).toBe(201);
    const { data } = usuario.create.mock.calls[0][0];
    expect(data.email).toBe('cliente@dsw.com');
    expect(data.rol).toBe('CLIENTE');
    expect(await bcrypt.compare('dsw12345', data.password)).toBe(true);
    expect(res.body).not.toHaveProperty('password');
  });

  it('responde 400 con DNI, email o contraseña invalidos', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', admin)
      .send({ ...body, dni: '12.345', email: 'no-es-email', password: 'corta' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(['dni', 'email', 'password']);
  });

  it('al actualizar sin contraseña no la modifica ni cambia el rol', async () => {
    usuario.update.mockResolvedValue({ ...cliente, nombre: 'Nuevo' });

    const res = await request(app)
      .patch('/api/usuarios/2')
      .set('Authorization', admin)
      .send({ nombre: 'Nuevo' });

    expect(res.status).toBe(200);
    expect(usuario.update.mock.calls[0][0].data).toEqual({ nombre: 'Nuevo' });
  });

  it('responde 404 si el usuario no existe', async () => {
    usuario.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/usuarios/99').set('Authorization', admin);

    expect(res.status).toBe(404);
  });

  it('responde 403 si un cliente intenta gestionar usuarios', async () => {
    const res = await request(app).get('/api/usuarios').set('Authorization', tokenCliente);

    expect(res.status).toBe(403);
    expect(usuario.findMany).not.toHaveBeenCalled();
  });
});
