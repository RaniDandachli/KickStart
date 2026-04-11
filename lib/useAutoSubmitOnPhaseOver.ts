import { useEffect, useRef } from 'react';

import { ENABLE_BACKEND } from '@/constants/featureFlags';

/**
 * When `phase === overValue`, calls `onSubmit` once per distinct `runToken`
 * (bump `runToken` when a run ends). Replaces a manual “Submit score” tap.
 */
export function useAutoSubmitOnPhaseOver(opts: {
  phase: string;
  overValue: string;
  runToken: number;
  disabled?: boolean;
  onSubmit: () => Promise<void>;
}): void {
  const { phase, overValue, runToken, disabled, onSubmit } = opts;
  const lastHandled = useRef(-1);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    if (disabled) return;
    if (!ENABLE_BACKEND) return;
    if (phase !== overValue) return;
    if (runToken <= 0) return;
    if (lastHandled.current === runToken) return;
    lastHandled.current = runToken;
    void submitRef.current();
  }, [phase, overValue, runToken, disabled]);
}
