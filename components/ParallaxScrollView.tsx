import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useColorScheme } from '@hooks/useColorScheme';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface ParallaxScrollViewProps {
  children: React.ReactNode;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: {
    light: string;
    dark: string;
  };
  style?: ViewStyle;
}

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  style,
}: ParallaxScrollViewProps) {
  const colorScheme = useColorScheme();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: scrollY.value * 0.5 }],
    };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.header,
          headerStyle,
          headerBackgroundColor && {
            backgroundColor: headerBackgroundColor[colorScheme ?? 'light'],
          },
        ]}>
        {headerImage}
      </Animated.View>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.content}>
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 200,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 216,
  },
}); 