// Vercel Serverless Function: POST /api/dodo-webhook
// Receives Dodo Payments webhook events (payment.succeeded, etc.).
// Verifies the signature via the official SDK, records the order in Supabase,
// and queues a purchase confirmation email.
//
// Env vars:
//   DODO_API_KEY          — API key (used to build the client + webhook key)
//   DODO_WEBHOOK_SECRET   — signing secret from Dodo dashboard webhook settings
//   SUPABASE_URL / SUPABASE_SERVICE_KEY — for order + email_queue writes

import { DodoPayments } from 'dodopayments';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
const DODO_ENV = process.env.DODO_ENV || process.env.DODO_TEST_MODE === 'true' ? 'test' : 'live';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const SITE_URL = process.env.SITE_URL || 'https://avoriai.vercel.app';

const client = DODO_API_KEY
  ? new DodoPayments({
      bearerToken: DODO_API_KEY,
      environment: DODO_ENV === 'test' ? 'test_mode' : 'live_mode',
      ...(DODO_WEBHOOK_SECRET ? { webhookKey: DODO_WEBHOOK_SECRET } : {}),
    })
  : null;

async function recordOrder(event: any): Promise<void> {
  // Dodo webhook payload: { business_id, data: Payment, timestamp, type }
  const payment = event.data || {};
  const metadata = payment.metadata || {};
  const customer = payment.customer || {};

  const order = {
    product_id: metadata.product_id || '',
    product_title: metadata.product_title || payment.product_cart?.[0]?.name || 'Aivora Digital Product',
    product_slug: metadata.product_slug || '',
    customer_email: customer.email || '',
    customer_name: customer.name || '',
    amount: payment.total_amount ? payment.total_amount / 100 : 0,
    currency: payment.currency || 'USD',
    payment_id: payment.payment_id || '',
    status: payment.status || 'succeeded',
    created_at: new Date().toISOString(),
  };

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    // Idempotent upsert keyed on payment_id to survive webhook retries
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
          console.warn('Order insert skipped (table may be missing):', insertRes.status);
        }
      })
      .catch((e) => console.warn('Order recording skipped:', e.message));
  }

  // Queue purchase confirmation email (delivered by the Brevo pipeline)
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

  let event: any;
  if (client && DODO_WEBHOOK_SECRET) {
    // Official SDK signature verification (Standard Webhooks spec)
    try {
      event = client.webhooks.unwrap(rawBody, {
        headers: req.headers as Record<string, string>,
        key: DODO_WEBHOOK_SECRET,
      });
    } catch (e) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    // Test mode fallback: no secret configured — accept but log
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid body' });
    }
  }

  const eventType = event?.type || '';
  const paymentStatus = event?.data?.status || '';

  // Only act on succeeded payments (ignore other events, still ack them)
  if (eventType === 'payment.succeeded' || (eventType.includes('payment') && paymentStatus === 'succeeded')) {
    try {
      await recordOrder(event);
    } catch (e) {
      console.error('Webhook processing error:', e);
    }
  }

  // Always ack so Dodo stops retrying
  return res.status(200).json({ received: true });
}
