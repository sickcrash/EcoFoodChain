import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';

export type ImpactSeries = {
  key: string;
  name: string;
  color: string;
  data: number[];
};

type Props = {
  labels: string[];
  series: ImpactSeries[];
  width: number;
  height: number;
  isDark?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function ImpactChart({ labels, series, width, height, isDark }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(series.map(s => [s.key, true]))
  );

  const activeSeries = useMemo(
    () => series.filter(s => enabled[s.key]),
    [series, enabled]
  );

  const labelStep = useMemo(() => Math.max(1, Math.ceil(labels.length / 6)), [labels.length]);
  const displayLabels = useMemo(() => (
    labels.map((label, index) => (
      index % labelStep === 0 || index === labels.length - 1
        ? String(label).slice(0, 10)
        : ''
    ))
  ), [labels, labelStep]);

  const chartData = useMemo(() => ({
    labels: displayLabels,
    datasets: activeSeries.map(s => ({
      data: s.data.map(v => Number(v || 0)),
      color: (opacity = 1) => s.color,
      strokeWidth: 2,
    })),
    legend: activeSeries.map(s => s.name),
  }), [activeSeries, displayLabels]);

  const chartConfig = useMemo(() => ({
    backgroundGradientFrom: isDark ? '#101010' : '#FFFFFF',
    backgroundGradientTo: isDark ? '#101010' : '#FFFFFF',
    color: (opacity = 1) => `rgba(${isDark ? '255,255,255' : '0,0,0'}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${isDark ? '255,255,255' : '51,51,51'}, ${opacity})`,
    decimalPlaces: 0,
    propsForDots: {
      r: '3',
      strokeWidth: '1',
      stroke: isDark ? '#101010' : '#FFFFFF',
    },
    propsForBackgroundLines: {
      stroke: isDark ? '#2A2A2A' : '#ECECEC',
      strokeDasharray: '4 4',
    },
  }), [isDark]);

  const handledWidth = clamp(width, 220, 1024);
  const handledHeight = clamp(height, 200, 480);

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {series.map(s => (
          <Chip
            key={s.key}
            selected={!!enabled[s.key]}
            onPress={() => setEnabled(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
            style={{ marginRight: 8, marginBottom: 8, backgroundColor: enabled[s.key] ? `${s.color}22` : undefined }}
            textStyle={{ color: enabled[s.key] ? s.color : (isDark ? '#fff' : '#333') }}
          >
            {s.name}
          </Chip>
        ))}
      </View>

      {activeSeries.length > 0 ? (
        <LineChart
          data={chartData}
          width={handledWidth}
          height={handledHeight}
          chartConfig={chartConfig}
          bezier
          segments={4}
          fromZero
          withVerticalLines={true}
          withHorizontalLines={true}
          withShadow={false}
          style={{ borderRadius: 0 }}
        />
      ) : (
        <Text style={{ textAlign: 'center', color: isDark ? '#CCCCCC' : '#666666', marginTop: 12 }}>
          Seleziona almeno una serie da visualizzare.
        </Text>
      )}
    </View>
  );
}
