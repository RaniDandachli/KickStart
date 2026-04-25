/**
 * Resend — welcome email on signup. Do not log recipient addresses in production logs.
 */

export type WelcomeEmailParams = {
  username: string;
  supportEmail: string;
  brandName?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

const HEADER_BG = '#1e1033';
const ACCENT = '#FFD700';

export function buildWelcomeEmailHtml(p: WelcomeEmailParams): string {
  const brand = (p.brandName ?? 'Run It Arcade').trim() || 'Run It Arcade';
  const user = escapeHtml(p.username);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brand)} — Welcome</title>
</head>
<body style="margin:0;padding:0;background:#0c0a12;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;">Welcome to ${escapeHtml(brand)}, ${user}.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0c0a12;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 24px 48px rgba(0,0,0,0.45);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:32px 24px 28px;background:${HEADER_BG};">
                    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">${escapeHtml(
                      brand,
                    )}</div>
                    <div style="margin-top:8px;font-size:13px;font-weight:600;color:${ACCENT};letter-spacing:0.12em;text-transform:uppercase;">Welcome</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 8px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
                    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">You&apos;re in, ${user}</h1>
                    <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#475569;">
                      Thanks for joining ${escapeHtml(brand)}. Jump into matches, climb the ranks, and we&apos;ll see you on the floor.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 32px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#64748b;">
                    Questions? <a href="mailto:${escapeHtmlAttr(p.supportEmail)}" style="color:#7c3aed;font-weight:600;text-decoration:none;">${escapeHtml(
                      p.supportEmail,
                    )}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px;border-top:1px solid #f1f5f9;background:#fafafa;">
                    <p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                      &copy; ${new Date().getFullYear()} ${escapeHtml(brand)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildWelcomeEmailPlainText(p: WelcomeEmailParams): string {
  const brand = (p.brandName ?? 'Run It Arcade').trim() || 'Run It Arcade';
  return [
    `${brand} — Welcome`,
    '',
    `Hi ${p.username},`,
    '',
    `Thanks for joining ${brand}. Jump into matches and climb the ranks.`,
    '',
    `Questions: ${p.supportEmail}`,
    '',
    `© ${new Date().getFullYear()} ${brand}`,
  ].join('\n');
}

function welcomeSubject(): string {
  const custom = Deno.env.get('EMAIL_SUBJECT_WELCOME')?.trim();
  if (custom) return custom;
  const brand = Deno.env.get('BRAND_NAME')?.trim() || 'Run It Arcade';
  return `Welcome to ${brand}`;
}

export async function sendWelcomeEmailViaResend(
  apiKey: string,
  from: string,
  to: string,
  params: WelcomeEmailParams,
  userId: string,
  attempts = 3,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = buildWelcomeEmailHtml(params);
  const plainText = buildWelcomeEmailPlainText(params);
  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject: welcomeSubject(),
    html,
    text: plainText,
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.supportEmail)) {
    payload.reply_to = params.supportEmail;
  }

  const idempotencyKey = `welcome_${userId}`;
  let lastErr = 'unknown';

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true };
      }
      const resBody = await res.text();
      lastErr = `${res.status} ${resBody}`;
      console.error(`[sendWelcomeEmail] Resend attempt ${i + 1}:`, lastErr.slice(0, 800));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.error(`[sendWelcomeEmail] Resend network error attempt ${i + 1}:`, lastErr);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return { ok: false, error: lastErr };
}
