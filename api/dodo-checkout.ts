// Vercel Serverless Function: POST /api/dodo-checkout
// Creates a Dodo Payments hosted checkout session for a one-time digital product.
// Uses the official dodopayments SDK.
//
// Flow:
//   1. Looks up (or lazily creates) a pay-what-you-want product in Dodo for the
//      Aivora product — the Dodo product_id is cached in Supabase site_settings
//      under the key `dodo_product_<slug>`.
//   2. Creates a checkout session with the actual price passed via `amount`
//      (minor units), so variable/dynamic pricing works without dashboard edits.
//   3. Returns the hosted checkout_url the customer is redirected to.
//
// Env vars:
//   DODO_API_KEY   — test key from https://test.dodopayments.com (or live)
//   DODO_ENV       — 'test' enables test mode, anything else = live mode
//   SUPABASE_URL / SUPABASE_SERVICE_KEY — for the product_id cache

import { DodoPayments } from 'dodopayments';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_ENV = process.env.DODO_ENV || process.env.DODO_TEST_MODE === 'true' ? 'test' : 'live';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const SITE_URL = process.env.SITE_URL || 'https://avoriai.vercel.app';

interface CheckoutBody {
  title: string;
  amount: number; // in USD (major units, e.g. 29.99)
  quantity?: number;
  email?: string;
  customer_name?: string;
  return_url?: string;
  cancel_url?: string;
  product_slug?: string;
  product_id?: string;
}

const client = DODO_API_KEY
  ? new DodoPayments({ bearerToken: DODO_API_KEY, environment: DODO_ENV === 'test' ? 'test_mode' : 'live_mode' })
  : null;

async function getOrCreateDodoProduct(slug: string, title: string): Promise<string> {
  if (!client) throw new Error('DODO_API_KEY is not configured.');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env vars are not configured.');

  const cacheKey = `dodo_product_${slug}`;

  // 1) Check cache
  try {
    const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.${cacheKey}&select=value`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    if (cacheRes.ok) {
      const rows = await cacheRes.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].value) {
        return rows[0].value as string;
      }
    }
  } catch (e) {
    // cache lookup is best-effort
  }

  // 2) Create a pay-what-you-want product (min $1.00) so we can override price per checkout
  const product = await client.products.create({
    name: title || 'Aivora Digital Product',
    description: 'Premium AI digital product sold through Aivora.',
    tax_category: 'digital_products',
    price: {
      type: 'one_time_price',
      currency: 'USD',
      price: 100, // minimum amount: $1.00 (in cents)
      discount: 0,
      purchasing_power_parity: true,
      pay_what_you_want: true,
    },
    metadata: { aivora_slug: slug || '', source: 'aivora' },
  });

  // 3) Cache the mapping
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: cacheKey, value: product.product_id, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    // caching is best-effort
  }

  return product.product_id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!client) {
    return res.status(500).json({ error: 'DODO_API_KEY is not configured.' });
  }

  const body = (req.body || {}) as CheckoutBody;
  const title = body.title || 'Aivora Digital Product';
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'A valid amount is required.' });
  }

  const quantity = Math.max(1, parseInt(String(body.quantity || 1), 10) || 1);
  const returnUrl = body.return_url || `${SITE_URL}/success.html?checkout=success`;
  const cancelUrl = body.cancel_url || `${SITE_URL}/products.html`;

  try {
    // Ensure a Dodo product exists (pay-what-you-want, price overridden per session)
    const dodoProductId = await getOrCreateDodoProduct(body.product_slug || '', title);

    // Dodo API expects amount in minor units (cents)
    const amountMinor = Math.round(amount * 100);

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: dodoProductId, quantity, amount: amountMinor }],
      ...(body.email
        ? { customer: { email: body.email, name: body.customer_name || '' } }
        : {}),
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        product_title: title,
        product_slug: body.product_slug || '',
        product_id: body.product_id || '',
      },
    });

    if (!session.checkout_url) {
      return res.status(502).json({ error: 'Dodo Payments did not return a checkout URL.' });
    }

    return res.status(200).json({ checkout_url: session.checkout_url, session_id: session.session_id });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || err.error?.message || 'Unexpected checkout error.',
    });
  }
}
