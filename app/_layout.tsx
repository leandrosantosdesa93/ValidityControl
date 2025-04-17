import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '../hooks/useColorScheme';
import { navigationRef } from '../src/navigation/navigationService';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Log para depuração
  useEffect(() => {
    console.log('[AppLayout] Inicializando layout do Expo Router');
    console.log('[AppLayout] Status navigationRef:', navigationRef.current ? 'disponível' : 'não disponível');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: isDark ? '#000' : '#fff',
            borderTopColor: isDark ? '#333' : '#e0e0e0',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#2196F3',
          tabBarInactiveTintColor: isDark ? '#666' : '#999',
          headerStyle: {
            backgroundColor: isDark ? '#000' : '#fff',
            borderBottomColor: isDark ? '#333' : '#e0e0e0',
            borderBottomWidth: 1,
            height: 80,
            paddingTop: 20,
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '600',
          },
          headerTintColor: isDark ? '#fff' : '#000',
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            headerTitle: 'Controle de Validade',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
            tabBarLabel: 'Home',
            href: '/',
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'Produtos',
            headerTitle: 'Meus Produtos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
            tabBarLabel: 'Produtos',
          }}
        />
        <Tabs.Screen
          name="register"
          options={{
            title: 'Cadastrar',
            headerTitle: 'Novo Produto',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="add-circle" size={size} color={color} />
            ),
            tabBarLabel: 'Cadastrar',
          }}
        />
        <Tabs.Screen
          name="expiring"
          options={{
            title: 'A Vencer',
            headerTitle: 'Produtos a Vencer',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="warning" size={size} color={color} />
            ),
            tabBarLabel: 'A Vencer',
          }}
        />
        <Tabs.Screen
          name="expired"
          options={{
            title: 'Vencidos',
            headerTitle: 'Produtos Vencidos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="alert-circle" size={size} color={color} />
            ),
            tabBarLabel: 'Vencidos',
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
} 