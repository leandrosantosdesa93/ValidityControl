import { createRef } from 'react';
import { NavigationContainerRef, StackActions } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

// Referência global para o NavigationContainer
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();

/**
 * Serviço de navegação que pode ser usado em qualquer lugar da aplicação
 */
export const NavigationService = {
  // Navegar para uma tela
  navigate<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    try {
      if (navigationRef.current) {
        console.log(`[Navigation] Navegando para ${String(name)}`, params);
        // @ts-ignore - TypeScript is having trouble with the navigation types
        navigationRef.current.navigate(name, params);
      } else {
        console.error('[Navigation] A referência de navegação não está disponível');
      }
    } catch (error) {
      console.error('[Navigation] Erro ao navegar:', error);
    }
  },

  // Voltar para a tela anterior
  goBack() {
    try {
      if (navigationRef.current?.canGoBack()) {
        console.log('[Navigation] Voltando para a tela anterior');
        navigationRef.current.goBack();
      } else {
        console.warn('[Navigation] Não é possível voltar');
      }
    } catch (error) {
      console.error('[Navigation] Erro ao voltar:', error);
    }
  },

  // Reset da navegação
  reset(state: any) {
    try {
      if (navigationRef.current) {
        console.log('[Navigation] Redefinindo estado de navegação');
        navigationRef.current.reset(state);
      } else {
        console.error('[Navigation] A referência de navegação não está disponível');
      }
    } catch (error) {
      console.error('[Navigation] Erro ao resetar navegação:', error);
    }
  },

  // Push uma nova tela na pilha
  push<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    try {
      if (navigationRef.current) {
        console.log(`[Navigation] Push para ${String(name)}`, params);
        // @ts-ignore - TypeScript is having trouble with the navigation types
        navigationRef.current.dispatch(StackActions.push(name, params));
      } else {
        console.error('[Navigation] A referência de navegação não está disponível');
      }
    } catch (error) {
      console.error('[Navigation] Erro ao fazer push:', error);
    }
  },

  // Verificar se o navegador está pronto
  isReady(): boolean {
    return navigationRef.current !== null;
  },

  // Obter a rota atual
  getCurrentRoute() {
    return navigationRef.current?.getCurrentRoute();
  }
}; 