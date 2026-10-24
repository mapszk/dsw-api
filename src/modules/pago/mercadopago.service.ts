import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { env } from '../../config/env.js';
import { EstadoPago, type Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import type { ProveedorPago, ReservaAPagar } from './proveedor-pago.js';

let cliente: MercadoPagoConfig | undefined;

function clienteMp() {
  if (!env.MP_ACCESS_TOKEN) {
    throw new HttpError(503, 'Los pagos con MercadoPago no estan configurados');
  }
  cliente ??= new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
  return cliente;
}

/**
 * Crea el checkout de MP para una reserva. external_reference es el id de la reserva:
 * con el se encuentra el Pago cuando llega el aviso.
 */
export async function crearPreferencia(
  reserva: ReservaAPagar,
  monto: Prisma.Decimal,
  venceEn: Date,
) {
  const preferencia = await new Preference(clienteMp()).create({
    body: {
      items: [
        {
          id: String(reserva.id),
          title: `Reserva #${reserva.id} - patente ${reserva.patente}`,
          quantity: 1,
          unit_price: monto.toNumber(),
          currency_id: 'ARS',
        },
      ],
      external_reference: String(reserva.id),
      back_urls: {
        success: `${env.FRONTEND_URL}/pago/exito`,
        failure: `${env.FRONTEND_URL}/pago/fallo`,
        pending: `${env.FRONTEND_URL}/pago/pendiente`,
      },
      auto_return: 'approved',
      notification_url: `${env.API_PUBLIC_URL}/api/webhooks/mercadopago`,
      // Por defecto una preferencia no vence: despues de esto MP no acepta pagos con el link
      expires: true,
      expiration_date_to: venceEn.toISOString(),
    },
  });

  if (!preferencia.id) throw new Error('MercadoPago no devolvio el id de la preferencia');

  const initPoint =
    env.NODE_ENV === 'production' ? preferencia.init_point : preferencia.sandbox_init_point;
  return { id: preferencia.id, initPoint: initPoint ?? preferencia.init_point };
}

/** Consulta el pago en MP: el body del aviso no es confiable, solo trae el id */
export function obtenerPago(paymentId: string) {
  return new Payment(clienteMp()).get({ id: paymentId });
}

interface DatosFirma {
  firma?: string;
  requestId?: string;
  dataId?: string;
}

/**
 * Valida la firma del aviso
 */
export function firmaValida({ firma, requestId, dataId }: DatosFirma) {
  if (!env.MP_WEBHOOK_SECRET || !firma) return false;

  const partes = Object.fromEntries(
    firma.split(',').map((parte) => parte.trim().split('=') as [string, string]),
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  // MP firma los ids alfanumericos en minuscula; si falta un dato se omite su parte
  let manifiesto = '';
  if (dataId) manifiesto += `id:${dataId.toLowerCase()};`;
  if (requestId) manifiesto += `request-id:${requestId};`;
  manifiesto += `ts:${ts};`;

  const esperada = createHmac('sha256', env.MP_WEBHOOK_SECRET).update(manifiesto).digest('hex');
  return esperada.length === v1.length && timingSafeEqual(Buffer.from(esperada), Buffer.from(v1));
}

const ESTADOS: Record<string, EstadoPago> = {
  approved: EstadoPago.APROBADO,
  rejected: EstadoPago.RECHAZADO,
  cancelled: EstadoPago.RECHAZADO,
  // pending, in_process y el resto quedan PENDIENTE
};

export const mercadopago: ProveedorPago = {
  nombre: 'MERCADOPAGO',

  async crearCheckout(reserva, monto, venceEn) {
    const { id, initPoint } = await crearPreferencia(reserva, monto, venceEn);
    if (!initPoint) throw new Error('MercadoPago no devolvio el link de checkout');
    return { checkoutId: id, url: initPoint };
  },

  async consultarPago(paymentId) {
    const pago = await obtenerPago(paymentId);
    const reservaId = Number(pago.external_reference);
    return {
      reservaId: Number.isInteger(reservaId) && reservaId > 0 ? reservaId : null,
      pagoExternoId: String(pago.id ?? paymentId),
      estado: (pago.status && ESTADOS[pago.status]) || EstadoPago.PENDIENTE,
    };
  },

  // El id del recurso llega en la query (data.id) y en el body; la firma se calcula con el de la query
  leerAviso(aviso) {
    const dataId = (aviso.query['data.id'] ?? aviso.body?.data?.id)?.toString();
    const valida = firmaValida({
      firma: aviso.header('x-signature'),
      requestId: aviso.header('x-request-id'),
      dataId,
    });
    if (!valida) throw HttpError.unauthorized('Firma invalida');

    const tipo = aviso.query.type ?? aviso.body?.type;
    return tipo === 'payment' && dataId ? dataId : null;
  },
};
