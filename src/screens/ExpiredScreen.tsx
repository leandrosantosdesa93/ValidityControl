import React from 'react';
import { View, Text } from 'react-native';
import { RootTabScreenProps } from '../types/navigation';

export default function ExpiredScreen({ navigation: _navigation }: RootTabScreenProps<'Expired'>) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Expired Screen</Text>
    </View>
  );
} 