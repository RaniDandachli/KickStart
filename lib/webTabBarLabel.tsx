import { Text } from 'react-native';

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
  const { color, position, children } = props;
  const beside = position === 'beside-icon';
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{
        color,
        fontSize: beside ? 14 : 12,
        fontWeight: '700',
        letterSpacing: beside ? 0.15 : 0.2,
        marginTop: beside ? 0 : 5,
        marginLeft: beside ? 8 : 0,
        maxWidth: beside ? 140 : 76,
        textAlign: beside ? 'left' : 'center',
      }}
    >
      {children}
    </Text>
  );
}
