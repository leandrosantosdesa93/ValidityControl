import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, Platform, View, Text, Alert } from 'react-native';
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

// Configurar o handler de notificações global com prioridade máxima
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.MAX : undefined
  }),
});

export default function App() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const AppContainer = createAppContainer();
  const storeState = useProductStore();

  // Carregar dados iniciais
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Iniciando aplicativo...');
        
        // Inicialização do store
        await storeState.initialize();
        
        console.log('[App] Verificando permissões de notificação...');
        const { checkNotificationPermissions, requestNotificationPermissions } = require('./src/services/notifications');
        const permissionStatus = await checkNotificationPermissions();
        console.log('[App] Status de permissão:', permissionStatus.status);
        
        if (permissionStatus.status !== 'granted') {
          console.log('[App] Solicitando permissões de notificação...');
          const granted = await requestNotificationPermissions();
          console.log('[App] Permissão concedida:', granted);
          
          if (!granted) {
            Alert.alert(
              'Permissões de Notificação',
              'As notificações são importantes para avisá-lo sobre produtos próximos ao vencimento. Por favor, ative-as nas configurações.',
              [
                { text: 'OK' }
              ]
            );
          }
        }
        
        // Verificar canais de notificação no Android
        if (Platform.OS === 'android') {
          const { checkNotificationChannels } = require('./src/services/notifications');
          console.log('[App] Verificando canais de notificação...');
          await checkNotificationChannels();
        }
        
        // Configurar notificações
        console.log('[App] Configurando sistema de notificações...');
        await setupNotifications();
        
        // Aguardar um momento para garantir que o store esteja totalmente inicializado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reagendar notificações (garante que as notificações de expiração estejam ativas)
        console.log('[App] Reagendando notificações existentes...');
        await rescheduleNotifications();
        
        // DEBUG: Envia uma notificação de teste na inicialização
        // REMOVER ESTA LINHA APÓS VERIFICAR QUE AS NOTIFICAÇÕES ESTÃO FUNCIONANDO
        setTimeout(async () => {
          try {
            console.log('[App] Enviando notificação de teste automática...');
            const { sendTestNotification } = require('./src/services/notifications');
            const result = await sendTestNotification();
            console.log('[App] Notificação de teste enviada com ID:', result);
            
            // Verificar notificações agendadas
            const { Notifications } = require('expo-notifications');
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            console.log('[App] Notificações agendadas:', scheduled.length);
            
            // Se ainda não há notificações agendadas, tente reagendar novamente
            if (scheduled.length === 0) {
              console.warn('[App] Nenhuma notificação agendada. Tentando reagendar novamente...');
              await rescheduleNotifications();
            }
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
        
        // Aguardar um momento para garantir que os sistemas estejam prontos
        setTimeout(async () => {
          try {
            // Reagendar notificações quando o app volta ao primeiro plano
            console.log('[App] Verificando e reagendando notificações após voltar ao primeiro plano...');
            await rescheduleNotifications();
          } catch (error) {
            console.error('[App] Erro ao reagendar notificações após voltar ao primeiro plano:', error);
          }
        }, 1000);
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
      
      // Verificar o tipo de notificação
      const data = notification.request.content.data;
      const productId = data.productId as string;
      
      if (productId) {
        // Verificar se o produto ainda existe ou se já foi vendido
        const product = storeState.products.find(p => p.code === productId);
        
        if (!product) {
          console.log('[App] Produto não encontrado, cancelando notificações relacionadas');
          // Produto não existe mais, cancelar notificações relacionadas
          import('./src/services/notifications').then(({ cancelProductNotifications }) => {
            cancelProductNotifications(productId);
          });
        } else if (product.isSold) {
          console.log('[App] Produto já foi vendido, cancelando notificações relacionadas');
          // Produto já foi vendido, cancelar notificações relacionadas
          import('./src/services/notifications').then(({ cancelProductNotifications }) => {
            cancelProductNotifications(productId);
          });
        }
      }
    });

    // Listener para notificações tocadas pelo usuário
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[App] Usuário tocou em notificação:', response);
      
      // Aqui você pode navegar para telas específicas com base na notificação
      const data = response.notification.request.content.data;
      
      if (data && data.productId) {
        const productId = data.productId as string;
        const screen = data.screen as string;
        
        console.log('[App] Notificação contém ID de produto:', productId);
        console.log('[App] Tela de destino:', screen);
        
        // Se o produto existir, navegar para a tela apropriada
        const product = storeState.products.find(p => p.code === productId);
        
        if (product) {
          // Para implementar navegação, você precisará configurar navigators
          // Esta é uma implementação inicial que pode ser expandida
          switch (screen) {
            case 'expiring':
              // Navegar para a tela de produtos a vencer
              console.log('[App] Navegando para tela de produtos a vencer após clique em notificação');
              break;
            case 'expired':
              // Navegar para a tela de produtos vencidos
              console.log('[App] Navegando para tela de produtos vencidos após clique em notificação');
              break;
            default:
              // Navegar para a tela de produtos
              console.log('[App] Navegando para tela de produtos após clique em notificação');
          }
        } else {
          console.log('[App] Produto não encontrado, não é possível navegar');
          // Produto não existe mais, cancelar notificações relacionadas
          import('./src/services/notifications').then(({ cancelProductNotifications }) => {
            cancelProductNotifications(productId);
          });
        }
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [storeState.products]);

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