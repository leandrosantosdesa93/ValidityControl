import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ProductsScreen from '../screens/ProductsScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ExpiringScreen from '../screens/ExpiringScreen';
import ExpiredScreen from '../screens/ExpiredScreen';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Products') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Register') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Expiring') {
            iconName = focused ? 'warning' : 'warning-outline';
          } else if (route.name === 'Expired') {
            iconName = focused ? 'alert-circle' : 'alert-circle-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        headerShown: true,
        tabBarActiveTintColor: '#00A1DF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Início',
          headerTitle: 'Validity Control'
        }}
      />
      <Tab.Screen 
        name="Products" 
        component={ProductsScreen}
        options={{
          title: 'Produtos',
          headerTitle: 'Meus Produtos'
        }}
      />
      <Tab.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{
          title: 'Cadastrar',
          headerTitle: 'Novo Produto'
        }}
      />
      <Tab.Screen 
        name="Expiring" 
        component={ExpiringScreen}
        options={{
          title: 'A Vencer',
          headerTitle: 'Produtos a Vencer'
        }}
      />
      <Tab.Screen 
        name="Expired" 
        component={ExpiredScreen}
        options={{
          title: 'Vencidos',
          headerTitle: 'Produtos Vencidos'
        }}
      />
    </Tab.Navigator>
  );
} 