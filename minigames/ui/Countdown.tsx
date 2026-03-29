import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

interface Props {
  active: boolean;
  onComplete: () => void;
}

export function Countdown({ active, onComplete }: Props) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    const steps: [string, number][] = [
      ['3', 720],
      ['2', 620],
      ['1', 620],
      ['GO', 480],
    ];

    const run = async () => {
      setLabel('3');
      await new Promise<void>((r) => setTimeout(r, 720));
      for (const [text, wait] of steps.slice(1)) {
        if (cancelled) return;
        setLabel(text);
        await new Promise<void>((r) => setTimeout(r, wait));
      }
      if (!cancelled) onComplete();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, onComplete]);

  if (!active || !label) return null;

  return (
    <View className="absolute inset-0 z-[30] items-center justify-center bg-violet-950/55" pointerEvents="none">
      <Text
        style={{
          fontSize: label === 'GO' ? 88 : 108,
          fontWeight: '900',
          color: label === 'GO' ? '#FBBF24' : '#F0ABFC',
          textShadowColor: '#4C1D95',
          textShadowOffset: { width: 4, height: 4 },
          textShadowRadius: 0,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
