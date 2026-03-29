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
  /** Solid green + white label — reads on navy screens (avoid dark purple on unclear lime fills). */
  primary: 'bg-emerald-500 border-2 border-emerald-300 active:bg-emerald-600',
  secondary: 'bg-sky-600 border-2 border-sky-400 active:bg-sky-700',
  ghost: 'bg-white/10 border-2 border-amber-400/40 active:bg-white/15',
  danger: 'bg-rose-600/90 border-2 border-rose-400 active:bg-rose-700',
};

const textClass: Record<Variant, string> = {
  primary: 'text-white font-black',
  secondary: 'text-white font-bold',
  ghost: 'text-amber-100 font-bold',
  danger: 'text-white font-bold',
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
      className={`min-h-[52px] justify-center rounded-2xl px-6 py-3.5 ${variantClass[variant]} ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      style={variant === 'primary' ? theme.shadow.punch : variant === 'secondary' ? theme.shadow.soft : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {title ? <Text className={`text-center text-base ${textClass[variant]}`}>{title}</Text> : null}
          {children}
        </>
      )}
    </Pressable>
  );
}
