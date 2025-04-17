import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform, Pressable, PressableProps } from 'react-native';

export function ExternalLink(props: Omit<PressableProps, 'onPress'> & { href: string }) {
  return (
    <Pressable
      {...props}
      onPress={() => {
        if (Platform.OS !== 'web') {
          WebBrowser.openBrowserAsync(props.href);
        }
      }}
    />
  );
} 