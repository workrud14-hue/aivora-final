// Vercel Serverless Function: POST /api/send-email
// Processes pending emails from the email_queue table and sends them via Brevo.
// Requires BREVO_API_KEY env var.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@avoriai.vercel.app';
const FROM_NAME = process.env.FROM_NAME || 'Aivora';
const SITE_URL = process.env.SITE_URL || 'https://avoriai.vercel.app';

interface EmailJob {
  id: string;
  type: string;
  to_email: string;
  subject: string;
  metadata: any;
}

function generateWelcomeEmail(): { htmlContent: string; textContent: string } {
  return {
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #2563eb, #1e40af); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 32px;">
          <h1 style="color: white; font-size: 28px; margin: 0;">Welcome to Aivora! 🎉</h1>
        </div>
        <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
          <p style="color: #475569; line-height: 1.7;">Thank you for subscribing to Aivora! You're now part of a community of creators who work faster and smarter with AI-powered digital products.</p>
          <p style="color: #475569; line-height: 1.7;">Here's what you can expect:</p>
          <ul style="color: #475569; line-height: 1.7; padding-left: 20px;">
            <li>Early access to new AI prompt packs and templates</li>
            <li>Exclusive tips for getting the most out of AI tools</li>
            <li>Special discounts for subscribers</li>
          </ul>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${SITE_URL}/products.html" style="background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Browse Products →</a>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} Aivora. All rights reserved.</p>
      </body>
      </html>
    `,
    textContent: `Welcome to Aivora! Thank you for subscribing. Browse our AI digital products at ${SITE_URL}/products.html`,
  };
}

function generatePurchaseEmail(productName: string, productUrl: string): { htmlContent: string; textContent: string } {
  return {
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #16a34a, #15803d); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 32px;">
          <h1 style="color: white; font-size: 28px; margin: 0;">Purchase Confirmed! ✅</h1>
        </div>
        <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
          <p style="color: #475569; line-height: 1.7;">Your purchase of <strong>${productName}</strong> is confirmed.</p>
          <p style="color: #475569; line-height: 1.7;">You can access your product using the link in your Payhip account, or click below:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${productUrl}" style="background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Access Your Product →</a>
          </div>
          <p style="color: #475569; line-height: 1.7;">If you have any questions, reply to this email and we'll help you out.</p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} Aivora. All rights reserved.</p>
      </body>
      </html>
    `,
    textContent: `Your purchase of ${productName} is confirmed. Access it at ${productUrl}`,
  };
}

function generateBlogNotificationEmail(postTitle: string, postUrl: string): { htmlContent: string; textContent: string } {
  return {
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #0d9488, #0f766e); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 32px;">
          <h1 style="color: white; font-size: 28px; margin: 0;">New on Aivora 📝</h1>
        </div>
        <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
          <p style="color: #475569; line-height: 1.7;">We just published a new blog post:</p>
          <h2 style="color: #0f172a; font-size: 20px; margin: 16px 0;">${postTitle}</h2>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${postUrl}" style="background: linear-gradient(135deg, #0d9488, #0f766e); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">Read Now →</a>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} Aivora. All rights reserved.</p>
      </body>
      </html>
    `,
    textContent: `New blog post: ${postTitle}. Read it at ${postUrl}`,
  };
}

async function sendViaBrevo(to: string, subject: string, htmlContent: string, textContent: string): Promise<void> {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Brevo API error: ${response.status} - ${err}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  try {
    // Fetch pending emails from queue
    const queueResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/email_queue?status=eq.pending&order=created_at.asc&limit=10`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!queueResponse.ok) {
      throw new Error(`Failed to fetch email queue: ${queueResponse.status}`);
    }

    const pendingEmails: EmailJob[] = await queueResponse.json();

    if (pendingEmails.length === 0) {
      return res.status(200).json({ message: 'No pending emails', processed: 0 });
    }

    const results = [];
    for (const email of pendingEmails) {
      try {
        let emailContent: { htmlContent: string; textContent: string };
        const meta = email.metadata || {};

        switch (email.type) {
          case 'welcome':
            emailContent = generateWelcomeEmail();
            break;
          case 'purchase_confirmation':
            emailContent = generatePurchaseEmail(
              meta.product_name || 'your product',
              meta.product_url || SITE_URL
            );
            break;
          case 'blog_notification':
            emailContent = generateBlogNotificationEmail(
              meta.post_title || 'New Post',
              meta.post_url || SITE_URL
            );
            break;
          default:
            emailContent = { htmlContent: `<p>${email.subject}</p>`, textContent: email.subject };
        }

        await sendViaBrevo(email.to_email, email.subject, emailContent.htmlContent, emailContent.textContent);

        // Mark as sent
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }),
        });

        results.push({ id: email.id, status: 'sent' });
      } catch (sendError: any) {
        // Mark as failed
        await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${email.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            status: 'failed',
            error_message: sendError.message,
          }),
        });

        results.push({ id: email.id, status: 'failed', error: sendError.message });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Email processing failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
