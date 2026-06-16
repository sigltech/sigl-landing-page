import { Resend } from 'resend';

const TO = 'siglr@richardsigl.com';
const FROM = process.env.CONTACT_FROM || 'contact@richardsigl.com';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const honeypot = String(body.company || '').trim();

  if (honeypot) return res.status(200).json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'missing fields' });
  }
  if (name.length > 120 || email.length > 200 || message.length > 5000) {
    return res.status(400).json({ error: 'field too long' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing');
    return res.status(500).json({ error: 'mailer not configured' });
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject: `richardsigl.com — ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;">${escapeHtml(message)}</pre>`,
    });
    if (error) {
      console.error('resend error', error);
      return res.status(502).json({ error: 'failed to send' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('contact handler error', e);
    return res.status(500).json({ error: 'failed to send' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
