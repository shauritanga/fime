import { palette } from '@/constants/theme';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Fime's own helper: a friendly coin with a sprout. */
export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <Svg height={size} viewBox="0 0 100 100" width={size}>
      <Path d="M50 22 C50 10 60 6 70 8 C69 18 61 23 50 22 Z" fill={palette.emerald} />
      <Circle cx={50} cy={57} fill={palette.emeraldSoft} r={37} stroke={palette.emerald} strokeWidth={3} />
      <Rect fill={palette.slate} height={13} rx={4} width={8} x={33} y={46} />
      <Rect fill={palette.slate} height={13} rx={4} width={8} x={59} y={46} />
      <Path d="M37 70 Q50 82 63 70" fill="none" stroke={palette.slate} strokeLinecap="round" strokeWidth={4} />
    </Svg>
  );
}
