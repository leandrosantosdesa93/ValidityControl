import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, Platform, View } from 'react-native';
import { useProductStore } from './src/store/productStore';
import { ActivityIndicator } from 'react-native-paper';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import { scheduleNotifications, setupNotifications, checkNotificationPermissions } from './src/services/notifications';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { Ionicons } from '@expo/vector-icons';

// Prevenir que a splash screen seja escondida automaticamente
SplashScreen.preventAutoHideAsync();

// Configurar o handler de notificações global com prioridade máxima
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX
  }),
});

// Criar o navegador de tabs
const Tab = createBottomTabNavigator();

export default function App() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const store = useProductStore();

  // Inicialização do app e configuração de notificações
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Iniciando aplicativo...');
        
        // Configurar notificações
        console.log('[App] Configurando notificações...');
        
        // Verificar e solicitar permissões
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) {
          console.log('[App] Permissões de notificação não concedidas');
          return;
        }
        
        // Configurar notificações no Android
        if (Platform.OS === 'android') {
          console.log('[App] Configurando sistema de notificações...');
          await setupNotifications();
        }
        
        // Agendar notificações
        console.log('[App] Agendando notificações...');
        await scheduleNotifications();
        
        console.log('[App] Inicialização concluída');
      } catch (e) {
        console.error('[App] Erro durante inicialização:', e);
      } finally {
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
        try {
          // Reagendar notificações quando o app volta ao primeiro plano
          await scheduleNotifications();
        } catch (error) {
          console.error('[App] Erro ao reagendar notificações:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Configurar listeners de notificações
  useEffect(() => {
    // Listener para notificações recebidas em primeiro plano
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[App] Notificação recebida em primeiro plano:', notification);
      
      const data = notification.request.content.data;
      const productId = data?.productId as string;
      
      if (productId) {
        const product = store.products.find(p => p.code === productId);
        if (!product || product.isSold) {
          console.log('[App] Produto não encontrado ou vendido, reagendando notificações');
          scheduleNotifications().catch(error => {
            console.error('[App] Erro ao reagendar notificações:', error);
          });
        }
      }
    });

    // Listener para notificações tocadas pelo usuário
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[App] Usuário tocou em notificação:', response);
      
      const data = response.notification.request.content.data;
      const productId = data?.productId as string;
      
      if (productId) {
        const product = store.products.find(p => p.code === productId);
        if (!product || product.isSold) {
          console.log('[App] Produto não encontrado ou vendido, reagendando notificações');
          scheduleNotifications().catch(error => {
            console.error('[App] Erro ao reagendar notificações:', error);
          });
        }
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, [store.products]);

  // Tela de carregamento
  if (!appIsReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#00A1DF" />
      </View>
    );
  }

  // Renderização principal
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName as any} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
} 