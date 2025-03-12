import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, Platform, View, Text } from 'react-native';
import { useFonts } from 'expo-font';
import { useProductStore } from './src/store/productStore';
import { ActivityIndicator } from 'react-native-paper';
import { createAppContainer } from './navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@hooks/useColorScheme';
import { ColorSchemeContext } from '@hooks/useThemeColor';
import * as Notifications from 'expo-notifications';
import { setupNotifications, rescheduleNotifications } from './src/services/notifications';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const AppContainer = createAppContainer();
  const storeState = useProductStore();

  // Carregar dados iniciais
  useEffect(() => {
    async function prepare() {
      try {
        // Inicialização do store
        await storeState.initialize();
        
        // Configurar notificações
        await setupNotifications();
        
        // Reagendar notificações (garante que as notificações de expiração estejam ativas)
        await rescheduleNotifications();
        
        // DEBUG: Envia uma notificação de teste na inicialização
        // REMOVER ESTA LINHA APÓS VERIFICAR QUE AS NOTIFICAÇÕES ESTÃO FUNCIONANDO
        const { sendTestNotification } = require('./src/services/notifications');
        setTimeout(async () => {
          try {
            console.log('[App] Enviando notificação de teste automática...');
            await sendTestNotification();
          } catch (e) {
            console.error('[App] Erro ao enviar notificação de teste:', e);
          }
        }, 5000); // Aguarda 5 segundos após inicialização
        
        console.log('[App] Inicialização concluída');
      } catch (e) {
        console.warn('[App] Erro durante inicialização:', e);
      } finally {
        // Ocultar splash e mostrar app
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Monitorar mudanças no estado do app (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[App] Aplicativo voltou para o primeiro plano');
        
        // Reagendar notificações quando o app volta ao primeiro plano
        await rescheduleNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Configurar listener de notificações
  useEffect(() => {
    // Listener para notificações recebidas enquanto o app está em primeiro plano
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[App] Notificação recebida em primeiro plano:', notification);
    });

    // Listener para notificações tocadas pelo usuário
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[App] Usuário tocou em notificação:', response);
      
      // Aqui você pode navegar para telas específicas com base na notificação
      const data = response.notification.request.content.data;
      
      if (data && data.productId) {
        console.log('[App] Notificação contém ID de produto:', data.productId);
        // Navegação para detalhes do produto pode ser implementada aqui
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  if (!appIsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ColorSchemeContext.Provider value={colorScheme}>
        <NavigationContainer>
          <AppContainer />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </NavigationContainer>
      </ColorSchemeContext.Provider>
    </SafeAreaProvider>
  );
} 