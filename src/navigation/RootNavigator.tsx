import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppNavigator } from './AppNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  console.log('[RootNavigator] Inicializando com Stack.Navigator');
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="Root"
        component={AppNavigator}
      />
    </Stack.Navigator>
  );
} 