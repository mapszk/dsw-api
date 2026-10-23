import type { Request } from 'express';
import type { EstadoPago, Prisma } from '../../generated/prisma/client.js';

export interface ReservaAPagar {
  id: number;
  patente: string;
}

export interface Checkout {
  /** Id del checkout en el proveedor: se guarda en Pago.checkoutId */
  checkoutId: string;
  /** Link al que se redirige al cliente para pagar */
  url: string;
}

export interface PagoExterno {
  reservaId: number | null;
  pagoExternoId: string;
  estado: EstadoPago;
}

/** Datos del pedido HTTP con el aviso del proveedor */
export type Aviso = Pick<Request, 'query' | 'body' | 'header'>;

/**
 * Proveedor de pagos online (MercadoPago, ...). Cada uno traduce su API a estos tipos:
 * pago.service solo trabaja con EstadoPago y no conoce los detalles de ningun proveedor.
 */
export interface ProveedorPago {
  nombre: string;
  crearCheckout(reserva: ReservaAPagar, monto: Prisma.Decimal, venceEn: Date): Promise<Checkout>;
  consultarPago(pagoExternoId: string): Promise<PagoExterno>;
  leerAviso(aviso: Aviso): string | null;
}
