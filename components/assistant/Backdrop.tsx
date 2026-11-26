import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { assistantTheme } from './theme';

/** Soft lavender light behind the chat. */
export function Backdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height="100%" width="100%">
        <Defs>
          <RadialGradient cx="10%" cy="34%" id="top" rx="85%" ry="36%">
            <Stop offset="0" stopColor={assistantTheme.glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={assistantTheme.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient cx="25%" cy="102%" id="bottom" rx="95%" ry="34%">
            <Stop offset="0" stopColor={assistantTheme.glow} stopOpacity={1} />
            <Stop offset="1" stopColor={assistantTheme.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect fill={assistantTheme.background} height="100%" width="100%" />
        <Rect fill="url(#top)" height="100%" width="100%" />
        <Rect fill="url(#bottom)" height="100%" width="100%" />
      </Svg>
    </View>
  );
}
