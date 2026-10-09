import type { Rol } from '../../generated/prisma/client.js';
import type { UsuarioSinPassword } from './usuario.service.js';

export interface UsuarioDto {
  id: number;
  nombre: string;
  telefono: string | null;
  dni: string;
  email: string;
  rol: Rol;
}

export function toUsuarioDto(usuario: UsuarioSinPassword): UsuarioDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    telefono: usuario.telefono,
    dni: usuario.dni,
    email: usuario.email,
    rol: usuario.rol,
  };
}
