import { palette } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export function TypingDots() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => (current + 1) % 3), 350);
    return () => clearInterval(timer);
  }, []);

  return (
    <View accessibilityLabel="The assistant is working" style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.dot, { opacity: index === step ? 1 : 0.25 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
  },
  dot: {
    backgroundColor: palette.slate,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
});
