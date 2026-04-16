import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type FunctionInvokeOptions,
  type FunctionRegion,
} from '@supabase/functions-js';

import { env } from '@/lib/env';
import { getSupabase } from '@/supabase/client';

type FunctionsInvokeArg = NonNullable<Parameters<ReturnType<typeof getSupabase>['functions']['invoke']>[1]>;

export type InvokeEdgeOptions = Omit<FunctionsInvokeArg, 'headers'> & {
  headers?: Record<string, string>;
};

function isBinaryBody(
  body: NonNullable<FunctionInvokeOptions['body']>,
): body is File | Blob | ArrayBuffer | FormData | ReadableStream<Uint8Array> {
  return (
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof File !== 'undefined' && body instanceof File) ||
    body instanceof ArrayBuffer ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  );
}

/**
 * Returns an access token that will work with Edge `Authorization: Bearer` + `auth.getUser(jwt)`.
 * Refreshes the session, then validates the **exact** access token via `getUser(jwt)` (same check the server runs).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr) {
    console.warn('[getValidAccessToken] refreshSession', refreshErr.message);
  }
  const session = refreshed.session ?? (await supabase.auth.getSession()).data.session;
  const raw = session?.access_token;
  if (!raw?.trim()) return null;
  const token = raw.trim();

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    console.warn('[getValidAccessToken] getUser(jwt)', userErr?.message);
    return null;
  }
  return token;
}

/**
 * Invokes a Supabase Edge Function with a user JWT. When there is no session, returns
 * `{ data: null, error }` (same shape as `functions.invoke`).
 */
export async function invokeEdgeFunction<T = unknown>(functionName: string, options: InvokeEdgeOptions = {}) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { data: null as T | null, error: new Error('Sign in to continue.') };
  }
  return invokeEdgeFunctionWithToken<T>(functionName, accessToken, options);
}

/**
 * Invokes an Edge Function with an explicit Bearer token.
 *
 * Uses global `fetch` with `apikey` + `Authorization` set directly. This avoids React Native
 * quirks where `supabase.functions.invoke` + `fetchWithAuth` merged headers can omit or
 * override the user JWT.
 */
export async function invokeEdgeFunctionWithToken<T = unknown>(
  functionName: string,
  accessToken: string,
  options: InvokeEdgeOptions = {},
) {
  const { headers: callerHeaders = {}, body, method = 'POST', signal, timeout, region } = options;

  if (body != null && isBinaryBody(body)) {
    const supabase = getSupabase();
    return supabase.functions.invoke<T>(functionName, {
      ...options,
      headers: {
        ...callerHeaders,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/functions/v1/${encodeURIComponent(functionName)}`);
  const reg = region as FunctionRegion | string | undefined;
  if (reg && reg !== 'any') {
    url.searchParams.set('forceFunctionRegion', String(reg));
  }

  const hdrs: Record<string, string> = {
    apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ...callerHeaders,
    Authorization: `Bearer ${accessToken}`,
  };
  if (reg && reg !== 'any') {
    hdrs['x-region'] = String(reg);
  }

  let effectiveSignal = signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutController: AbortController | undefined;
  if (timeout) {
    timeoutController = new AbortController();
    timeoutId = setTimeout(() => timeoutController!.abort(), timeout);
    if (signal) {
      effectiveSignal = timeoutController.signal;
      signal.addEventListener('abort', () => timeoutController!.abort());
    } else {
      effectiveSignal = timeoutController.signal;
    }
  }

  let serializedBody: string | undefined;
  const m = method ?? 'POST';
  if (body !== undefined && body !== null) {
    if (typeof body === 'string') {
      if (!hdrs['Content-Type'] && !hdrs['content-type']) {
        hdrs['Content-Type'] = 'text/plain';
      }
      serializedBody = body;
    } else {
      if (!hdrs['Content-Type'] && !hdrs['content-type']) {
        hdrs['Content-Type'] = 'application/json';
      }
      serializedBody = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: m,
      headers: hdrs,
      body: serializedBody,
      signal: effectiveSignal,
    }).catch((fetchError: unknown) => {
      throw new FunctionsFetchError(fetchError);
    });

    const isRelayError = response.headers.get('x-relay-error');
    if (isRelayError === 'true') {
      return { data: null, error: new FunctionsRelayError(response) };
    }

    if (!response.ok) {
      return { data: null, error: new FunctionsHttpError(response) };
    }

    const responseType = (response.headers.get('Content-Type') ?? 'text/plain').split(';')[0]!.trim();
    let data: T | null = null;
    if (responseType === 'application/json') {
      data = (await response.json()) as T;
    } else if (responseType === 'application/octet-stream' || responseType === 'application/pdf') {
      data = (await response.blob()) as unknown as T;
    } else if (responseType === 'text/event-stream') {
      data = response as unknown as T;
    } else if (responseType === 'multipart/form-data') {
      data = (await response.formData()) as unknown as T;
    } else {
      data = (await response.text()) as unknown as T;
    }

    return { data, error: null, response };
  } catch (error) {
    if (error instanceof FunctionsFetchError || error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
      return { data: null, error };
    }
    return { data: null, error: new FunctionsFetchError(error) };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
