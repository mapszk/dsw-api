import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { Rol, type Usuario } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import * as usuarioService from '../usuario/usuario.service.js';
import type { LoginInput, RegistrarInput } from './auth.schema.js';

function generarToken({ id, rol }: Pick<Usuario, 'id' | 'rol'>) {
  return jwt.sign({ rol }, env.JWT_SECRET, {
    subject: String(id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export async function registrar(data: RegistrarInput) {
  const usuario = await usuarioService.crear({ ...data, rol: Rol.CLIENTE });
  return { token: generarToken(usuario), usuario };
}

export async function login({ email, password }: LoginInput) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Mismo mensaje si no existe el email o si la contraseña no coincide
  if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
    throw HttpError.unauthorized('Email o contraseña incorrectos');
  }
  // El controller responde con toUsuarioDto, que no incluye la contraseña
  return { token: generarToken(usuario), usuario };
}
