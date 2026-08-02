// Vercel Serverless Function: POST /api/dodo-webhook
// Receives Dodo Payments webhook events (payment.succeeded, payment.failed).
// Verifies the signature, records the order in Supabase, and queues a purchase confirmation email.
// Requires DODO_WEBHOOK_SECRET env var (configured in the Dodo dashboard webhook settings).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const SITE_URL = process.env.SITE_URL || 'https://aivora.opik.net';

interface DodoEvent {
  type?: string;
  event_type?: string;
  payment?: {
    payment_id?: string;
    status?: string;
    total_amount?: number;
    currency?: string;
    customer?: { email?: string; name?: string };
    metadata?: Record<string, string>;
  };
  data?: any;
  [key: string]: any;
}

function verifySignature(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
  if (!DODO_WEBHOOK_SECRET) {
    // No secret configured: log a warning but accept (test mode). In production you should set it.
    return true;
  }

  const get = (name: string) => {
    const v = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };

  const webhookId = get('webhook-id') || get('webhook_id') || get('Dodo-Webhook-Id');
  const timestamp = get('webhook-timestamp') || get('webhook_timestamp') || get('Dodo-Webhook-Timestamp');
  const signatureHeader = get('webhook-signature') || get('webhook_signature') || get('Dodo-Signature');

  if (!webhookId || !timestamp || !signatureHeader) return false;

  // Standard Webhooks spec: signed content is "<id>.<timestamp>.<rawBody>",
  // signature is HMAC-SHA256 with the webhook secret, base64 encoded, "v1," prefixed.
  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', DODO_WEBHOOK_SECRET).update(signedContent).digest('base64');

  const received = signatureHeader
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('v1,'))
    .pop() || signatureHeader.split(' ').pop() || '';

  const safeEqual = (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  return safeEqual(expected, received);
}

async function recordOrder(event: DodoEvent): Promise<void> {
  const payment = event.payment || event.data?.payment || {};
  const metadata = payment.metadata || {};
  const customer = payment.customer || {};

  const order = {
    product_id: metadata.product_id || '',
    product_title: metadata.product_title || 'Aivora Digital Product',
    product_slug: metadata.product_slug || '',
    customer_email: customer.email || '',
    customer_name: customer.name || '',
    amount: payment.total_amount ? (payment.total_amount / 100) : 0,
    currency: payment.currency || 'USD',
    payment_id: payment.payment_id || '',
    status: payment.status || 'succeeded',
    created_at: new Date().toISOString(),
  };

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    // Upsert order by payment_id to stay idempotent against webhook retries.
    await fetch(`${SUPABASE_URL}/rest/v1/orders?payment_id=eq.${encodeURIComponent(order.payment_id)}`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`orders fetch failed: ${r.status}`);
        const existing = await r.json();
        if (Array.isArray(existing) && existing.length > 0) return null;
        return fetch(`${SUPABASE_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify(order),
        });
      })
      .then((insertRes) => {
        if (insertRes && !insertRes.ok) {
          // Table may not exist yet — don't crash the webhook, just log.
          console.warn('Order insert skipped (table may be missing):', insertRes.status);
        }
      })
      .catch((e) => console.warn('Order recording skipped:', e.message));
  }

  // Queue purchase confirmation email
  if (order.customer_email && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/email_queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          type: 'purchase_confirmation',
          to_email: order.customer_email,
          subject: `Your purchase: ${order.product_title}`,
          metadata: {
            product_name: order.product_title,
            product_url: order.product_slug ? `${SITE_URL}/product.html?slug=${order.product_slug}` : SITE_URL,
          },
          status: 'pending',
        }),
      });
    } catch (e) {
      console.warn('Email queue skipped:', e.message);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Capture raw body for signature verification
  let rawBody = '';
  try {
    rawBody = JSON.stringify(req.body || {});
  } catch (e) {
    rawBody = '';
  }

  if (!verifySignature(rawBody, req.headers as Record<string, string | string[] | undefined>)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = (req.body || {}) as DodoEvent;
  const eventType = event.type || event.event_type || (event.data && event.data.type) || '';
  const paymentStatus = event.payment?.status || event.data?.payment?.status || '';

  // Only act on succeeded payments (ignore other events, still ack them)
  if (eventType.includes('succeeded') || eventType.includes('payment') && paymentStatus === 'succeeded' || paymentStatus === 'succeeded') {
    try {
      await recordOrder(event);
    } catch (e) {
      console.error('Webhook processing error:', e);
    }
  }

  // Always ack so Dodo stops retrying
  return res.status(200).json({ received: true });
}
