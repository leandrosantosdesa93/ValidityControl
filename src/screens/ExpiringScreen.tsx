import React from 'react';
import { View, Text } from 'react-native';
import { RootTabScreenProps } from '../types/navigation';

export default function ExpiringScreen({ navigation: _navigation }: RootTabScreenProps<'Expiring'>) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Expiring Screen</Text>
    </View>
  );
} 