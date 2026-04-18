import { Platform, Text } from 'react-native';

/**
 * React Navigation's default `Label` can render poorly on react-native-web (missing/clipped text).
 * Use this for `tabBarLabel` on web so tab names are always real Text nodes.
 */
export function webTabBarLabelRenderer(props: {
  focused: boolean;
  color: string;
  position: 'beside-icon' | 'below-icon';
  children: string;
}) {
  const { focused, color, position, children } = props;
  const beside = position === 'beside-icon';
  const label = typeof children === 'string' && children.length > 0 ? children : '·';
  /** Narrow web bottom tabs: fill the column — fixed maxWidth was clipping titles on mobile Safari. */
  const narrowWebStacked = Platform.OS === 'web' && !beside;
  return (
    <Text
      numberOfLines={narrowWebStacked ? 2 : 1}
      ellipsizeMode="tail"
      style={[
        {
          color,
          fontSize: beside ? 13 : 10,
          lineHeight: beside ? 17 : 13,
          fontWeight: beside ? (focused ? '800' : '600') : '700',
          letterSpacing: beside ? 0.02 : 0.15,
          marginTop: beside ? 0 : 4,
          marginLeft: beside ? 6 : 0,
          maxWidth: beside ? 132 : undefined,
          width: narrowWebStacked ? ('100%' as const) : undefined,
          alignSelf: narrowWebStacked ? 'stretch' : undefined,
          flexShrink: 0,
          textAlign: beside ? 'left' : 'center',
        },
        Platform.OS === 'web' && !beside
          ? { minHeight: 26, overflow: 'visible' as const }
          : null,
      ]}
    >
      {label}
    </Text>
  );
}
