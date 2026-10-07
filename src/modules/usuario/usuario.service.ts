import bcrypt from 'bcryptjs';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { ActualizarUsuarioInput, CrearUsuarioInput } from './usuario.schema.js';

const omit = { password: true } satisfies Prisma.UsuarioOmit;

export type UsuarioSinPassword = Prisma.UsuarioGetPayload<{ omit: typeof omit }>;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function listar() {
  return prisma.usuario.findMany({
    omit,
    orderBy: { nombre: 'asc' },
  });
}

export async function obtener(id: number) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, omit });
  if (!usuario) throw HttpError.notFound('Usuario no encontrado');
  return usuario;
}

export async function crear({ password, ...data }: CrearUsuarioInput) {
  return prisma.usuario.create({
    data: { ...data, password: await hashPassword(password) },
    omit,
  });
}

export async function actualizar(id: number, { password, ...data }: ActualizarUsuarioInput) {
  return prisma.usuario.update({
    where: { id },
    data: { ...data, ...(password && { password: await hashPassword(password) }) },
    omit,
  });
}

export async function eliminar(id: number) {
  await prisma.usuario.delete({ where: { id } });
}
