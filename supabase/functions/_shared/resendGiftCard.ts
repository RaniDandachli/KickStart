/**
 * Resend API — gift card delivery. Never log email bodies or codes.
 */

export type SendGiftCardEmailParams = {
  to: string;
  rewardName: string;
  code: string;
  pin: string | null;
  supportEmail: string;
  /** Shown in header/footer; default applied by caller if unset */
  brandName?: string;
  /** Public https URL to PNG/SVG logo (e.g. Supabase Storage or your CDN) */
  logoUrl?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Safe for src="" and href="mailto:" */
function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

const BRAND_HEADER_BG = '#1e1033';
const ACCENT = '#e879f9';
const ACCENT_SOFT = '#fae8ff';

/** Inline image — Gmail loads CID attachments reliably; hotlinked URLs often stay blocked. */
const LOGO_CID = 'brandlogo';

export type LogoHeaderMode =
  | { kind: 'text' }
  | { kind: 'url'; url: string }
  | { kind: 'cid' };

export function buildGiftCardEmailHtml(p: SendGiftCardEmailParams, logoMode: LogoHeaderMode): string {
  const brand = (p.brandName ?? 'Run It Arcade').trim() || 'Run It Arcade';

  const pinBlock =
    p.pin && p.pin.length > 0
      ? `
          <tr>
            <td style="padding:0 32px 8px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;color:#334155;">
              <strong style="color:#0f172a;">PIN</strong>
              <div style="margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16px;font-weight:600;letter-spacing:0.06em;color:#0f172a;">${escapeHtml(
                p.pin,
              )}</div>
            </td>
          </tr>`
      : '';

  const headerInner =
    logoMode.kind === 'cid'
      ? `<img src="cid:${LOGO_CID}" alt="${escapeHtmlAttr(brand)}" width="200" height="64" border="0" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`
      : logoMode.kind === 'url'
        ? `<img src="${escapeHtmlAttr(logoMode.url)}" alt="${escapeHtmlAttr(brand)}" width="200" height="64" border="0" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`
        : `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">${escapeHtml(
            brand,
          )}</div>
        <div style="margin-top:8px;font-size:13px;font-weight:500;color:${ACCENT};letter-spacing:0.12em;text-transform:uppercase;">Reward unlocked</div>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(brand)} — Your reward</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background:#0c0a12;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#0c0a12;opacity:0;">
    Your gift card code is inside — thanks for playing ${escapeHtml(brand)}.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0c0a12;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 24px 48px rgba(0,0,0,0.45);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:32px 24px 28px;background:${BRAND_HEADER_BG};">
                    ${headerInner}
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 8px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
                    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Your reward is ready</h1>
                    <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#475569;">
                      Thanks for playing. Here&rsquo;s your <strong style="color:#0f172a;">${escapeHtml(p.rewardName)}</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:14px;background:${ACCENT_SOFT};border:1px solid #f5d0fe;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a21caf;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">Gift code</div>
                          <div style="margin-top:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:20px;font-weight:800;letter-spacing:0.08em;color:#0f172a;word-break:break-all;line-height:1.35;">
                            ${escapeHtml(p.code)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${pinBlock}
                <tr>
                  <td style="padding:8px 32px 28px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#64748b;">
                    Treat this code like cash and don&rsquo;t share it. If you didn&rsquo;t request this, contact us right away.
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 32px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#475569;">
                    Questions? <a href="mailto:${escapeHtmlAttr(p.supportEmail)}" style="color:#7c3aed;font-weight:600;text-decoration:none;">${escapeHtml(
                      p.supportEmail,
                    )}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 24px;border-top:1px solid #f1f5f9;background:#fafafa;">
                    <p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                      &copy; ${new Date().getFullYear()} ${escapeHtml(brand)} &middot; Play. Win. Repeat.
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

function giftCardSubject(): string {
  return Deno.env.get('EMAIL_SUBJECT_GIFT_CARD')?.trim() || 'Your Run It Arcade reward is here';
}

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** Fetch logo and return Resend attachment fields (inline). Fails quietly → caller uses external URL or text. */
async function tryInlineLogoAttachment(logoUrl: string): Promise<{ filename: string; content: string; content_id: string } | null> {
  const trimmed = logoUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) return null;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(trimmed, { signal: ctrl.signal });
    if (!res.ok) {
      console.error('[redeem-gift-card] Logo URL returned', res.status);
      return null;
    }
    let ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const path = new URL(trimmed).pathname.toLowerCase();
    if (ct === 'application/octet-stream' || ct === '' || ct === 'binary/octet-stream') {
      if (path.endsWith('.png')) ct = 'image/png';
      else if (path.endsWith('.webp')) ct = 'image/webp';
      else if (path.endsWith('.gif')) ct = 'image/gif';
      else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) ct = 'image/jpeg';
    }
    if (!/^image\/(png|jpeg|jpg|gif|webp)$/i.test(ct)) {
      console.error('[redeem-gift-card] Logo URL is not a raster image (use PNG/JPG/WebP; SVG often blocked in email):', ct);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 450_000) {
      console.error('[redeem-gift-card] Logo file size out of range (max ~450KB)');
      return null;
    }
    const ext =
      ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
    return {
      filename: `logo.${ext}`,
      content: uint8ToBase64(buf),
      content_id: LOGO_CID,
    };
  } catch (e) {
    console.error('[redeem-gift-card] Logo fetch failed:', e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(tid);
  }
}

function buildGiftCardEmailPlainText(p: SendGiftCardEmailParams): string {
  const brand = (p.brandName ?? 'Run It Arcade').trim() || 'Run It Arcade';
  const pin = p.pin && p.pin.length > 0 ? `\nPIN: ${p.pin}\n` : '';
  return [
    `${brand} — Your reward`,
    '',
    `Thanks for playing. Here's your ${p.rewardName}.`,
    '',
    `Gift code: ${p.code}`,
    pin,
    '',
    'Treat this code like cash and do not share it.',
    '',
    `Questions: ${p.supportEmail}`,
    '',
    `© ${new Date().getFullYear()} ${brand}`,
  ].join('\n');
}

/** One fetch: prefer inline CID (loads in Gmail); fall back to hotlinked URL. */
async function prepareLogoForEmail(logoUrl: string | null | undefined): Promise<{
  logoMode: LogoHeaderMode;
  attachment: { filename: string; content: string; content_id: string } | null;
}> {
  const logo = (logoUrl ?? '').trim();
  if (!/^https:\/\//i.test(logo)) {
    return { logoMode: { kind: 'text' }, attachment: null };
  }
  const att = await tryInlineLogoAttachment(logo);
  if (att) return { logoMode: { kind: 'cid' }, attachment: att };
  return { logoMode: { kind: 'url', url: logo }, attachment: null };
}

export async function sendGiftCardEmailWithRetry(
  apiKey: string,
  from: string,
  params: SendGiftCardEmailParams,
  attempts = 3,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { logoMode, attachment } = await prepareLogoForEmail(params.logoUrl);
  const html = buildGiftCardEmailHtml(params, logoMode);
  const plainText = buildGiftCardEmailPlainText(params);
  const payload: Record<string, unknown> = {
    from,
    to: [params.to],
    subject: giftCardSubject(),
    html,
    text: plainText,
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.supportEmail)) {
    payload.reply_to = params.supportEmail;
  }
  if (attachment) {
    payload.attachments = [attachment];
  }

  let lastErr = 'unknown';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true };
      }
      const resBody = await res.text();
      lastErr = `${res.status} ${resBody}`;
      // Log Resend’s error body (no gift codes in API responses) — check Edge Logs if email fails.
      console.error(`[redeem-gift-card] Resend attempt ${i + 1}:`, lastErr.slice(0, 800));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.error(`[redeem-gift-card] Resend network error attempt ${i + 1}:`, lastErr);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return { ok: false, error: lastErr };
}
