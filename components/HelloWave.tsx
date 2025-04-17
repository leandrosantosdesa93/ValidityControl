import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { ThemedText } from './ThemedText';

export function HelloWave() {
  const rotation = useSharedValue(0);

  // We intentionally omit 'rotation' from deps as it's a Reanimated shared value
  // and we only want to set up the animation once
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 20}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ThemedText style={styles.wave}>👋</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wave: {
    fontSize: 24,
  },
}); 