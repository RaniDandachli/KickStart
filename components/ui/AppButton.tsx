import { type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { theme } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface AppButtonProps extends PressableProps {
  title?: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-neon-lime active:opacity-90',
  secondary: 'bg-ink-700 border border-neon-cyan/40',
  ghost: 'bg-transparent border border-ink-700',
  danger: 'bg-red-500/20 border border-red-500/60',
};

const textClass: Record<Variant, string> = {
  primary: 'text-ink-900 font-bold',
  secondary: 'text-white font-semibold',
  ghost: 'text-white font-semibold',
  danger: 'text-red-300 font-semibold',
};

export function AppButton({
  title,
  variant = 'primary',
  loading,
  disabled,
  children,
  onPress,
  className,
  ...rest
}: PropsWithChildren<AppButtonProps>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`rounded-2xl px-5 py-3 ${variantClass[variant]} ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.background : theme.colors.text} />
      ) : (
        <>
          {title ? <Text className={`text-center text-base ${textClass[variant]}`}>{title}</Text> : null}
          {children}
        </>
      )}
    </Pressable>
  );
}
