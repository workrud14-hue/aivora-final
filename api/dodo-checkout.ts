// Vercel Serverless Function: POST /api/dodo-checkout
// Creates a Dodo Payments hosted checkout session for a one-time digital product.
// Requires DODO_API_KEY env var (Live: https://live.dodopayments.com, Test: https://test.dodopayments.com).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DODO_API_KEY = process.env.DODO_API_KEY;
// Use test mode when DODO_ENV === 'test' (or DODO_TEST_MODE === 'true')
const DODO_BASE_URL =
  process.env.DODO_ENV === 'test' || process.env.DODO_TEST_MODE === 'true'
    ? 'https://test.dodopayments.com'
    : 'https://live.dodopayments.com';

const SITE_URL = process.env.SITE_URL || 'https://aivora.opik.net';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DODO_API_KEY) {
    return res.status(500).json({ error: 'DODO_API_KEY is not configured.' });
  }

  const body = (req.body || {}) as CheckoutBody;
  const title = body.title || 'Aivora Digital Product';
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'A valid amount is required.' });
  }

  const quantity = Math.max(1, parseInt(String(body.quantity || 1), 10) || 1);
  const returnUrl = body.return_url || `${SITE_URL}/products.html`;
  const cancelUrl = body.cancel_url || SITE_URL;

  try {
    // Dodo API expects amount in minor units (cents).
    const amountMinor = Math.round(amount * 100);

    const dodoBody: Record<string, unknown> = {
      amount: amountMinor,
      currency: 'USD',
      quantity,
      payment_link: true,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        product_title: title,
        product_slug: body.product_slug || '',
        product_id: body.product_id || '',
      },
    };

    if (body.email) {
      dodoBody.customer = {
        email: body.email,
        ...(body.customer_name ? { name: body.customer_name } : {}),
      };
    }

    const response = await fetch(`${DODO_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify(dodoBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || data.detail || 'Dodo Payments could not create the checkout.',
      });
    }

    const checkoutUrl = data.checkout_url || data.payment_link_url || data.url || null;
    if (!checkoutUrl) {
      return res.status(502).json({ error: 'Dodo Payments did not return a checkout URL.' });
    }

    return res.status(200).json({ checkout_url: checkoutUrl, payment_id: data.payment_id || null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unexpected checkout error.' });
  }
}
