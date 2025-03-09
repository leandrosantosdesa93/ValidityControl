import { Tabs } from 'expo-router';
import { useColorScheme } from '@hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationInitializer } from '../src/components/NotificationInitializer';
import { useState, useEffect } from 'react';
import { UpdateModal } from '../src/components/UpdateModal';
import { checkAppVersion, saveVersionCheckTimestamp } from '../src/services/VersionService';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [updateInfo, setUpdateInfo] = useState({
    showUpdateModal: false,
    currentVersion: '',
    requiredVersion: '',
    downloadUrl: ''
  });

  useEffect(() => {
    const checkVersion = async () => {
      try {
        console.log('[AppLayout] Verificando atualizações do aplicativo...');
        const result = await checkAppVersion();
        
        if (result.needsUpdate) {
          console.log('[AppLayout] Atualização necessária:', result);
          setUpdateInfo({
            showUpdateModal: true,
            currentVersion: result.currentVersion,
            requiredVersion: result.requiredVersion,
            downloadUrl: result.downloadUrl
          });
        } else {
          console.log('[AppLayout] Aplicativo está atualizado');
          saveVersionCheckTimestamp();
        }
      } catch (error) {
        console.error('[AppLayout] Erro ao verificar versão:', error);
      }
    };

    checkVersion();
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
              title: '',
              headerShown: false,
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
              title: '',
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="cube" size={size} color={color} />
              ),
              tabBarLabel: 'Produtos',
            }}
          />

          <Tabs.Screen
            name="register"
            options={{
              title: '',
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="add-circle" size={size} color={color} />
              ),
              tabBarLabel: 'Cadastrar'
            }}
          />

          <Tabs.Screen
            name="expiring"
            options={{
              title: '',
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="warning" size={size} color={color} />
              ),
              tabBarLabel: 'A Vencer',
            }}
          />

          <Tabs.Screen
            name="expired"
            options={{
              title: '',
              headerShown: false,
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
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="settings" size={size} color={color} />
              ),
              tabBarLabel: 'Configurações',
              tabBarLabelStyle: {
                fontSize: 12,
              },
            }}
          />
        </Tabs>
      )}
    </SafeAreaView>
  );
} 