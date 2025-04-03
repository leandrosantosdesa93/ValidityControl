import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState, Platform, View, Alert, Linking } from 'react-native';
import { useProductStore } from './src/store/productStore';
import { ActivityIndicator } from 'react-native-paper';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import { scheduleNotifications, setupNotifications, checkNotificationPermissions, setupNotificationChannels } from './src/services/notifications';
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
        
        // Verificar permissões de notificação
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log('[App] Status atual de permissões:', existingStatus);
        
        if (existingStatus !== 'granted') {
          console.log('[App] Solicitando permissões de notificação...');
          const { status } = await Notifications.requestPermissionsAsync();
          
          if (status !== 'granted') {
            console.warn('[App] Permissões de notificação não concedidas');
            Alert.alert(
              'Permissão Necessária',
              'Para receber alertas sobre produtos a vencer, você precisa permitir notificações nas configurações do dispositivo.',
              [
                { text: 'Depois', style: 'cancel' },
                { 
                  text: 'Configurações', 
                  onPress: () => Linking.openSettings()
                }
              ]
            );
            return;
          }
        }
        
        // Configurar canais de notificação no Android
        if (Platform.OS === 'android') {
          console.log('[App] Configurando canais de notificação...');
          await setupNotificationChannels();
        }
        
        // Agendar notificações iniciais
        if (store.notificationSettings.enabled) {
          console.log('[App] Agendando notificações iniciais...');
          await scheduleNotifications();
        }
        
      } catch (e) {
        console.error('[App] Erro durante inicialização:', e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Monitorar mudanças no estado do app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[App] Aplicativo voltou para o primeiro plano');
        if (store.notificationSettings.enabled) {
          try {
            // Verificar e reagendar notificações
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            console.log('[App] Notificações agendadas:', scheduled.length);
            
            if (scheduled.length === 0) {
              console.log('[App] Nenhuma notificação agendada, reagendando...');
              await scheduleNotifications();
            }
          } catch (error) {
            console.error('[App] Erro ao verificar notificações:', error);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [store.notificationSettings.enabled]);

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