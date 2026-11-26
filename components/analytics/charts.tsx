import { palette, spacing } from '@/constants/theme';
import { compactNumber, niceCeiling, type Point } from '@/lib/finance/analytics';
import { formatMoney } from '@/lib/finance/format';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// Checked to stay distinguishable with colour blindness (green against orange).
export const incomeColor = palette.emerald;
export const expenseColor = '#E8742F';

const CHART_HEIGHT = 150;
const TOP = 8;
const AXIS_WIDTH = 34;
const GRID_LINES = 5;

/** A thin bar with softly rounded top corners that sits flat on the baseline. */
function bar(x: number, width: number, height: number) {
  const base = CHART_HEIGHT;
  const top = base - height;
  const radius = Math.min(3, width / 2, height);
  return `M${x} ${base} V${top + radius} Q${x} ${top} ${x + radius} ${top} H${x + width - radius} Q${x + width} ${top} ${x + width} ${top + radius} V${base} Z`;
}

/**
 * Income and expense side by side for each period, in the colours of the Income and Expenses tiles.
 * There is no legend; touching a period shows its figures above the plot.
 */
export function IncomeExpenseBars({
  caption,
  points,
}: {
  /** Shown above the plot while nothing is selected. */
  caption: string;
  points: Point[];
}) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const max = niceCeiling(Math.max(0, ...points.flatMap((point) => [point.income, point.expense])));
  const plot = Math.max(width - AXIS_WIDTH, 0);
  const slot = points.length ? plot / points.length : 0;
  const barWidth = Math.max(Math.min((slot - 5) / 2, 9), 1.5);
  const scale = (value: number) => (value > 0 ? Math.max((value / max) * (CHART_HEIGHT - TOP), 3) : 0);
  // With many bars, only some are labelled so the text doesn't collide.
  const every = Math.ceil(points.length / 7);
  const point = selected === null ? undefined : points[selected];
  const grid = Array.from({ length: GRID_LINES }, (_, index) => index / (GRID_LINES - 1));

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View accessibilityLiveRegion="polite" style={styles.caption}>
        <Text style={styles.captionText}>{point ? point.title : caption}</Text>
        {point ? (
          <Text style={styles.captionText}>
            <Text style={{ color: incomeColor }}>In {formatMoney(point.income)}</Text>
            {'   '}
            <Text style={{ color: expenseColor }}>Out {formatMoney(point.expense)}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.chartRow}>
        <View style={{ height: CHART_HEIGHT, width: plot }}>
          {width > 0 ? (
            <Svg height={CHART_HEIGHT} width={plot}>
              {grid.map((step) => {
                const y = Math.min(TOP + step * (CHART_HEIGHT - TOP), CHART_HEIGHT - 0.5);
                return (
                  <Line key={step} stroke={palette.border} strokeDasharray="4 4" strokeWidth={1} x1={0} x2={plot} y1={y} y2={y} />
                );
              })}
              {points.map((item, index) => {
                const left = index * slot + (slot - barWidth * 2 - 2) / 2;
                const faded = selected !== null && selected !== index;
                return [
                  item.income > 0 ? (
                    <Path d={bar(left, barWidth, scale(item.income))} fill={incomeColor} key={`i-${item.key}`} opacity={faded ? 0.3 : 1} />
                  ) : (
                    // A faint stub keeps the rhythm of the chart where nothing was recorded.
                    <Path d={bar(left, barWidth, 6)} fill={palette.surfaceMuted} key={`i-${item.key}`} />
                  ),
                  item.expense > 0 ? (
                    <Path d={bar(left + barWidth + 2, barWidth, scale(item.expense))} fill={expenseColor} key={`e-${item.key}`} opacity={faded ? 0.3 : 1} />
                  ) : (
                    <Path d={bar(left + barWidth + 2, barWidth, 6)} fill={palette.surfaceMuted} key={`e-${item.key}`} />
                  ),
                ];
              })}
            </Svg>
          ) : null}
          <View style={styles.touchRow}>
            {points.map((item, index) => (
              <Pressable
                accessibilityLabel={`${item.title}: income ${formatMoney(item.income)}, expenses ${formatMoney(item.expense)}`}
                accessibilityRole="button"
                key={item.key}
                onPress={() => setSelected((current) => (current === index ? null : index))}
                style={styles.touch}
              />
            ))}
          </View>
        </View>
        <View style={styles.axis}>
          {[...grid].map((step) => (
            <Text key={step} style={styles.axisText}>
              {compactNumber(max * (1 - step))}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.labels, { marginRight: AXIS_WIDTH }]}>
        {points.map((item, index) =>
          (points.length - 1 - index) % every === 0 ? (
            <Text
              key={item.key}
              numberOfLines={1}
              style={[styles.label, { left: index * slot + slot / 2 - 18 }, index === selected && styles.labelSelected]}>
              {item.label}
            </Text>
          ) : null
        )}
      </View>
    </View>
  );
}

/** The small decorative trend in a tile's corner. */
export function MiniBars({ color, values }: { color: string; values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <Svg accessibilityElementsHidden height={22} width={values.length * 5}>
      {values.map((value, index) => {
        const height = Math.max((value / max) * 22, 3);
        return <Rect fill={color} height={height} key={index} opacity={0.75} rx={1.5} width={3} x={index * 5} y={22 - height} />;
      })}
    </Svg>
  );
}

/** A share shown as a row of fine upright strokes. */
export function StripedBar({ color, value }: { color: string; value: number }) {
  const [width, setWidth] = useState(0);
  const count = Math.floor(width / 5);
  const filled = Math.max(Math.round(Math.min(value, 1) * count), value > 0 ? 1 : 0);

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.striped}>
      {width > 0 ? (
        <Svg accessibilityElementsHidden height={14} width={width}>
          {Array.from({ length: count }, (_, index) => (
            <Rect
              fill={index < filled ? color : palette.border}
              height={14}
              key={index}
              rx={1.5}
              width={3}
              x={index * 5}
              y={0}
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

export function Donut({
  centerLabel,
  centerValue,
  slices,
}: {
  centerLabel: string;
  centerValue: string;
  slices: Array<{ id: string; color: string; share: number }>;
}) {
  const size = 208;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 3 : 0;
  let start = 0;

  return (
    <View style={styles.donut}>
      <Svg height={size} width={size}>
        {slices.map((slice) => {
          const length = Math.max(slice.share * circumference - gap, 1);
          const offset = -start;
          start += slice.share * circumference;
          return (
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              key={slice.id}
              r={radius}
              stroke={slice.color}
              strokeDasharray={[length, circumference - length]}
              strokeDashoffset={offset}
              strokeWidth={stroke}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutLabel}>{centerLabel}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.donutValue}>
          {centerValue}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
  },
  axis: {
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 8,
    justifyContent: 'space-between',
    marginTop: -2,
    width: AXIS_WIDTH,
  },
  axisText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  caption: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  captionText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  striped: {
    height: 14,
  },
  touchRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
  },
  touch: {
    flex: 1,
  },
  labels: {
    height: 18,
    marginTop: spacing.xs,
  },
  label: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
    position: 'absolute',
    textAlign: 'center',
    width: 36,
  },
  labelSelected: {
    color: palette.ink,
    fontWeight: '900',
  },
  donut: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  donutLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  donutValue: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
});
