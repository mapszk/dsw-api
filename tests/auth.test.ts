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

/** Valor de la cookie de sesion que fijo la respuesta (Set-Cookie) */
function cookieSesion(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((cookie) => cookie.startsWith('sesion='));
}

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

    it('guarda el token en una cookie httpOnly y devuelve el usuario sin la contraseña', async () => {
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
      // El token no viaja en el body: solo en la cookie, que el JavaScript de la pagina no puede leer
      expect(res.body).not.toHaveProperty('token');
      const cookie = cookieSesion(res);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      const token = cookie!.split(';')[0].slice('sesion='.length);
      const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      expect(payload).toMatchObject({ sub: '2', rol: 'CLIENTE' });
    });

    it('responde 401 si la contraseña es incorrecta', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'cliente@dsw.com', password: 'otra-clave' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Email o contraseña incorrectos');
      expect(cookieSesion(res)).toBeUndefined();
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
      expect(cookieSesion(res)).toMatch(/HttpOnly/);
      expect(res.body.usuario).not.toHaveProperty('password');
    });
  });

  describe('POST /logout', () => {
    it('borra la cookie de sesion', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(204);
      expect(cookieSesion(res)).toMatch(/^sesion=;.*Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('GET /me', () => {
    it('devuelve el usuario de la cookie de sesion', async () => {
      usuario.findUnique.mockResolvedValue(cliente);
      const token = jwt.sign({ rol: 'CLIENTE' }, env.JWT_SECRET, { subject: '2' });

      const res = await request(app).get('/api/auth/me').set('Cookie', `sesion=${token}`);

      expect(res.status).toBe(200);
      expect(usuario.findUnique.mock.calls[0][0].where).toEqual({ id: 2 });
    });

    it('tambien acepta el token en el header Authorization', async () => {
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
        .set('Cookie', 'sesion=no-es-un-token');
      const caducado = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${vencido}`);

      expect(invalido.status).toBe(401);
      expect(caducado.status).toBe(401);
      expect(caducado.body.error.message).toBe('La sesion es invalida o vencio');
    });

    it('responde 401 sin cookie ni header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Debe iniciar sesion');
    });
  });
});
