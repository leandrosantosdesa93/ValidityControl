import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { AppNavigator } from './AppNavigator';

const Stack = createStackNavigator();

export function RootNavigator() {
  console.log('[RootNavigator] Inicializando com Stack.Navigator');
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="Root"
        component={AppNavigator}
      />
    </Stack.Navigator>
  );
} 