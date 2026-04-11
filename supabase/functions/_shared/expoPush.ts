/**
 * Expo Push API (server). Set EXPO_ACCESS_TOKEN in Edge secrets for production reliability.
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  /** Android channel id (must exist in the app; client creates `arcade-rewards`). */
  channelId?: string;
};

type ExpoTicket = { status: string; message?: string; id?: string };

function toPayload(m: ExpoPushMessage): Record<string, unknown> {
  const channelId = m.channelId ?? 'arcade-rewards';
  return {
    to: m.to,
    title: m.title,
    body: m.body,
    sound: m.sound ?? 'default',
    priority: m.priority ?? 'default',
    data: m.data ?? {},
    channelId,
    android: { channelId },
  };
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
  opts?: { allowPartial?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (messages.length === 0) return { ok: true };

  const expoAccess = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (expoAccess) headers.Authorization = `Bearer ${expoAccess}`;

  const payload = messages.length === 1 ? toPayload(messages[0]!) : messages.map(toPayload);

  let res: Response;
  try {
    res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `network:${msg}` };
  }

  let body: { data?: ExpoTicket | ExpoTicket[]; errors?: unknown };
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `invalid_json_http_${res.status}` };
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}:${JSON.stringify(body).slice(0, 400)}` };
  }

  const tickets = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  if (tickets.length === 0) return { ok: true };

  const errs = tickets.filter((t) => t?.status === 'error');
  const oks = tickets.filter((t) => t?.status === 'ok');

  if (opts?.allowPartial) {
    if (oks.length === 0 && errs.length > 0) {
      const msg = errs[0]?.message ?? 'all_failed';
      return { ok: false, error: msg.slice(0, 500) };
    }
    if (errs.length > 0) {
      console.warn('[expoPush] partial failures:', errs.length, 'of', tickets.length);
    }
    return { ok: true };
  }

  const firstErr = errs[0];
  if (firstErr?.message) {
    console.warn('[expoPush] ticket error:', firstErr.message.slice(0, 300));
    return { ok: false, error: firstErr.message.slice(0, 500) };
  }

  return { ok: true };
}
