// Vercel Cron Job: GET /api/cron/update-rates
// Fetches live exchange rates from exchangerate-api.com and updates the currency_rates table.
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/update-rates", "schedule": "0 6 * * *" }] }

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET; // Optional: set this to protect the endpoint

const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'NGN', symbol: '₦' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: verify cron secret
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  try {
    // Fetch live rates from free exchange rate API
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`Exchange API returned ${response.status}`);
    }
    const data = await response.json();
    if (!data.rates) {
      throw new Error('No rates returned from exchange API');
    }

    // Update each currency in Supabase with a single idempotent upsert.
    // PostgREST treats POST + Prefer: resolution=merge-duplicates as an upsert
    // keyed on the primary key (currency), so rows are inserted or updated.
    const results = [];
    for (const cur of CURRENCIES) {
      if (data.rates[cur.code]) {
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/currency_rates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            currency: cur.code,
            rate: data.rates[cur.code],
            symbol: cur.symbol,
            updated_at: new Date().toISOString(),
          }),
        });

        if (!upsertRes.ok) {
          console.warn(`Failed to upsert ${cur.code}: ${upsertRes.status} ${await upsertRes.text()}`);
          continue;
        }

        results.push({ currency: cur.code, rate: data.rates[cur.code] });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${results.length} currency rates`,
      rates: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Currency rate update failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
