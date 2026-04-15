import { useSyncExternalStore } from 'react';

/**
 * While any consumer holds a pause (e.g. live event minigame), `useProfile` stops interval refetching
 * so network + React updates do not fight the rAF game loop.
 */
let pauseDepth = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Call on mount; cleanup on unmount. Nested pauses are reference-counted. */
export function pushProfilePollingPause(): () => void {
  pauseDepth += 1;
  emit();
  return () => {
    pauseDepth = Math.max(0, pauseDepth - 1);
    emit();
  };
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getPollingPausedSnapshot() {
  return pauseDepth > 0;
}

export function useProfilePollingPaused(): boolean {
  return useSyncExternalStore(subscribe, getPollingPausedSnapshot, getPollingPausedSnapshot);
}
