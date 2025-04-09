import { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { useProductStore } from './src/store/productStore';
import { ActivityIndicator } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationService';

// Prevenir que a splash screen seja escondida automaticamente
SplashScreen.preventAutoHideAsync().catch(() => {
  console.warn('Não foi possível prevenir que a splash screen fosse escondida');
});

export default function App() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Inicialização do app
  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Iniciando aplicativo...');
        // Adicione aqui qualquer lógica de inicialização necessária
      } catch (e) {
        console.error('[App] Erro durante inicialização:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Efeito para esconder a splash screen
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && isNavigationReady) {
      // Esconde a splash screen apenas quando a interface e navegação estiverem prontas
      console.log('[App] Escondendo splash screen, app e navegação prontos.');
      await SplashScreen.hideAsync().catch((e) => {
        console.warn('[App] Erro ao esconder splash screen:', e);
      });
    }
  }, [appIsReady, isNavigationReady]);

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
      <NavigationContainer 
        ref={navigationRef}
        onReady={() => {
          console.log('[App] NavigationContainer está pronto');
          setIsNavigationReady(true);
        }}
        onStateChange={(state) => {
          console.log('[App] Estado da navegação alterado', state ? 'Novo estado disponível' : 'Estado nulo');
        }}
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#00A1DF" />
          </View>
        }
      >
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <RootNavigator />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
} 