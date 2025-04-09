import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '../hooks/useColorScheme';
import { ThemedView } from '../components/ThemedView';
import { useProductStore } from '../src/store/productStore';
import { UpdateModal } from '../src/components/UpdateModal';
import NotificationInitializer from '../src/components/NotificationInitializer';
import { navigationRef } from '../src/navigation/navigationService';
import { checkAppVersion, saveVersionCheckTimestamp } from '../src/services/VersionService';
import { Alert } from 'react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const store = useProductStore();
  
  // Log para depuração
  useEffect(() => {
    console.log('[AppLayout] Inicializando layout do Expo Router');
    console.log('[AppLayout] Status navigationRef:', navigationRef.current ? 'disponível' : 'não disponível');
  }, []);

  // Verificar versão do app e mostrar modal se necessário
  const [updateInfo, setUpdateInfo] = React.useState({
    showUpdateModal: false,
    currentVersion: '1.0.0',
    requiredVersion: '1.0.0',
    downloadUrl: '',
  });

  useEffect(() => {
    const checkVersion = async () => {
      try {
        console.log('[AppLayout] Verificando atualizações do aplicativo...');
        
        // Adicionar um pequeno atraso para garantir que tudo esteja inicializado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await checkAppVersion();
        
        console.log('[AppLayout] Resultado da verificação:', result);
        
        if (result.needsUpdate) {
          console.log('[AppLayout] Atualização necessária:', result);
          setUpdateInfo({
            showUpdateModal: true,
            currentVersion: result.currentVersion,
            requiredVersion: result.requiredVersion,
            downloadUrl: result.downloadUrl
          });
          
          // Mostrar um alerta para garantir que o usuário perceba
          Alert.alert(
            'Nova Versão Disponível',
            `A versão ${result.requiredVersion} está disponível. A atualização é necessária para continuar utilizando o aplicativo.`,
            [{ text: 'OK' }]
          );
        } else {
          console.log('[AppLayout] Aplicativo está atualizado');
          saveVersionCheckTimestamp();
        }
      } catch (error) {
        console.error('[AppLayout] Erro ao verificar versão:', error);
        
        // Em caso de erro, mostrar um alerta informativo
        Alert.alert(
          'Erro na Verificação',
          'Não foi possível verificar a versão do aplicativo. Por favor, tente novamente mais tarde.',
          [{ text: 'OK' }]
        );
      }
    };

    // Verificar versão ao iniciar o app
    checkVersion();
    
    // Verificar periodicamente (a cada 5 minutos)
    const intervalId = setInterval(() => {
      console.log('[AppLayout] Verificação periódica de versão...');
      checkVersion();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NotificationInitializer />
      
      {/* Modal de atualização forçada - bloqueia o uso até atualizar */}
      <UpdateModal 
        isVisible={updateInfo.showUpdateModal}
        currentVersion={updateInfo.currentVersion}
        requiredVersion={updateInfo.requiredVersion}
        downloadUrl={updateInfo.downloadUrl}
      />
      
      {/* Apenas renderiza o resto do app se não precisar de atualização */}
      {!updateInfo.showUpdateModal && (
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
            headerSafeAreaInsets: { top: 20 },
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
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Configurações',
              headerTitle: 'Configurações',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings" size={size} color={color} />
              ),
              tabBarLabel: 'Ajustes',
            }}
          />
        </Tabs>
      )}
    </SafeAreaView>
  );
} 