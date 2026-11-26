import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { assistantTheme } from './theme';

/** Fime's own helper: a round little character with a sprout. */
export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Defs>
        <LinearGradient id="body" x1="0" x2="1" y1="0" y2="0.6">
          <Stop offset="0" stopColor={assistantTheme.glow} />
          <Stop offset="0.65" stopColor="#FFFFFF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M52 24 C50 12 59 7 71 8 C69 19 62 24 52 24 Z"
        fill="url(#body)"
        stroke={assistantTheme.ink}
        strokeLinejoin="round"
        strokeWidth={3}
      />
      <Ellipse cx={50} cy={56} fill="url(#body)" rx={40} ry={33} stroke={assistantTheme.ink} strokeWidth={3} />
      <Ellipse cx={37} cy={53} fill={assistantTheme.ink} rx={4.5} ry={7} />
      <Ellipse cx={63} cy={53} fill={assistantTheme.ink} rx={4.5} ry={7} />
      <Path d="M40 69 Q50 77 60 69" fill="none" stroke={assistantTheme.ink} strokeLinecap="round" strokeWidth={3.5} />
    </Svg>
  );
}
