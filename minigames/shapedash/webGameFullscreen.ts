/**
 * Mobile Safari: fullscreening the iframe only keeps browser chrome.
 * Prefer the top-level document (or immersive fixed layout from the host screen).
 */

export function getWebFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Enter browser fullscreen for the whole PWA tab (best effort on iOS 16.4+). */
export async function enterWebAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const docEl = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
  };
  const body = document.body as HTMLElement & { webkitRequestFullscreen?: () => void };

  for (const el of [docEl, body]) {
    try {
      if (getWebFullscreenElement()) return true;
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
        return true;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
        return true;
      }
    } catch {
      /* try next */
    }
  }
  return false;
}

export async function exitWebAppFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!getWebFullscreenElement()) return;
  const d = document as Document & { webkitExitFullscreen?: () => void };
  try {
    if (typeof document.exitFullscreen === 'function') await document.exitFullscreen();
    else if (typeof d.webkitExitFullscreen === 'function') d.webkitExitFullscreen();
  } catch {
    /** ignore */
  }
}

export async function tryLockWebLandscape(): Promise<void> {
  if (typeof screen === 'undefined') return;
  try {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>;
    };
    if (!o?.lock) return;
    await o.lock('landscape-primary' as OrientationLockType).catch(async () => {
      await o.lock!('landscape' as OrientationLockType).catch(() => {});
    });
  } catch {
    /** ignore */
  }
}

export function subscribeWebFullscreenChange(cb: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const on = () => cb();
  document.addEventListener('fullscreenchange', on);
  document.addEventListener('webkitfullscreenchange', on as EventListener);
  cb();
  return () => {
    document.removeEventListener('fullscreenchange', on);
    document.removeEventListener('webkitfullscreenchange', on as EventListener);
  };
}
