import { appBorderAccent, runit, runitFont } from '@/lib/runitArcadeTheme';
import { LinearGradient } from 'expo-linear-gradient';
import { type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface AppButtonProps extends PressableProps {
  title?: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
}

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
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [styles.base, isDisabled && styles.disabled, pressed && styles.pressed]}
        className={className ?? ''}
        {...rest}
      >
        <LinearGradient
          colors={isDisabled ? ['#555', '#333'] : [runit.neonPink, runit.neonPurple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradInner}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : title ? (
            <Text style={styles.textPrimary}>{title}</Text>
          ) : (
            children
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [styles.base, styles.secondary, isDisabled && styles.disabled, pressed && styles.pressed]}
        className={className ?? ''}
        {...rest}
      >
        {loading ? <ActivityIndicator color="#a78bfa" /> : title ? <Text style={styles.textSecondary}>{title}</Text> : children}
      </Pressable>
    );
  }

  if (variant === 'ghost') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [styles.base, styles.ghost, isDisabled && styles.disabled, pressed && styles.pressed]}
        className={className ?? ''}
        {...rest}
      >
        {loading ? <ActivityIndicator color="rgba(255,255,255,0.8)" /> : title ? <Text style={styles.textGhost}>{title}</Text> : children}
      </Pressable>
    );
  }

  // danger
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles.danger, isDisabled && styles.disabled, pressed && styles.pressed]}
      className={className ?? ''}
      {...rest}
    >
      {loading ? <ActivityIndicator color="#fff" /> : title ? <Text style={styles.textDanger}>{title}</Text> : children}
    </Pressable>
  );
}

const base = {
  minHeight: 52,
  borderRadius: 14,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  overflow: 'hidden' as const,
  marginTop: 4,
};

const styles = StyleSheet.create({
  base,
  gradInner: {
    ...base,
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: 'rgba(255,0,110,0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  secondary: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.55)',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: appBorderAccent,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  danger: {
    backgroundColor: 'rgba(220,38,38,0.75)',
    borderWidth: 2,
    borderColor: 'rgba(252,165,165,0.5)',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  textPrimary: {
    color: '#fff',
    fontFamily: runitFont.bold,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  textSecondary: {
    color: '#a78bfa',
    fontFamily: runitFont.bold,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.6,
  },
  textGhost: { color: 'rgba(255,255,255,0.92)', fontFamily: runitFont.bold, fontWeight: '800', fontSize: 15 },
  textDanger: { color: '#fff', fontFamily: runitFont.bold, fontWeight: '800', fontSize: 15 },
});
