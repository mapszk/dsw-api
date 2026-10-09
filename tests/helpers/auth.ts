import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

/** Header Authorization con un token firmado como lo hace el login */
export function authHeader(rol: 'ADMIN' | 'CLIENTE', id = 1) {
  return `Bearer ${jwt.sign({ rol }, env.JWT_SECRET, { subject: String(id) })}`;
}
