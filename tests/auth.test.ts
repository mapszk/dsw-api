import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { authHeader } from './helpers/auth.js';

const usuario = { findUnique: vi.fn(), create: vi.fn() };

vi.mock('../src/lib/prisma.js', () => ({ prisma: { usuario } }));

const { app } = await import('../src/app.js');

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

describe('/api/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      usuario.findUnique.mockResolvedValue({
        ...cliente,
        password: await bcrypt.hash('dsw12345', 4),
      });
    });

    it('devuelve un token con el id y el rol, sin la contraseña', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'Cliente@DSW.com', password: 'dsw12345' });

      expect(res.status).toBe(200);
      expect(usuario.findUnique).toHaveBeenCalledWith({ where: { email: 'cliente@dsw.com' } });
      expect(res.body.usuario).toEqual({
        id: 2,
        nombre: 'Cliente Demo',
        telefono: null,
        dni: '11111111',
        email: 'cliente@dsw.com',
        rol: 'CLIENTE',
      });
      const payload = jwt.verify(res.body.token, env.JWT_SECRET) as jwt.JwtPayload;
      expect(payload).toMatchObject({ sub: '2', rol: 'CLIENTE' });
    });

    it('responde 401 si la contraseña es incorrecta', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'cliente@dsw.com', password: 'otra-clave' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Email o contraseña incorrectos');
    });

    it('responde 401 con el mismo mensaje si el email no existe', async () => {
      usuario.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nadie@dsw.com', password: 'dsw12345' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Email o contraseña incorrectos');
    });
  });

  describe('POST /register', () => {
    it('crea siempre un CLIENTE aunque se envie otro rol', async () => {
      usuario.create.mockImplementation(({ data }) => Promise.resolve({ ...cliente, ...data }));

      const res = await request(app).post('/api/auth/register').send({
        nombre: 'Cliente Demo',
        dni: '11111111',
        email: 'cliente@dsw.com',
        password: 'dsw12345',
        rol: 'ADMIN',
      });

      expect(res.status).toBe(201);
      expect(usuario.create.mock.calls[0][0].data.rol).toBe('CLIENTE');
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.usuario).not.toHaveProperty('password');
    });
  });

  describe('GET /me', () => {
    it('devuelve el usuario del token', async () => {
      usuario.findUnique.mockResolvedValue(cliente);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authHeader('CLIENTE', 2));

      expect(res.status).toBe(200);
      expect(usuario.findUnique.mock.calls[0][0].where).toEqual({ id: 2 });
    });

    it('responde 401 si el token es invalido o esta vencido', async () => {
      const vencido = jwt.sign({ rol: 'CLIENTE' }, env.JWT_SECRET, {
        subject: '2',
        expiresIn: -10,
      });

      const invalido = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer no-es-un-token');
      const caducado = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${vencido}`);

      expect(invalido.status).toBe(401);
      expect(caducado.status).toBe(401);
      expect(caducado.body.error.message).toBe('La sesion es invalida o vencio');
    });
  });
});
