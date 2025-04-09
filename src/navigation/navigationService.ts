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
      console.error('[Navigation] Erro ao redefinir navegação:', error);
    }
  },

  // Push para uma nova tela (útil em stacks)
  push<RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) {
    try {
      if (navigationRef.current) {
        console.log(`[Navigation] Push para ${String(name)}`, params);
        navigationRef.current.dispatch(StackActions.push(String(name), params));
      } else {
        console.error('[Navigation] A referência de navegação não está disponível');
      }
    } catch (error) {
      console.error('[Navigation] Erro ao fazer push:', error);
    }
  },

  // Verificar se a navegação está pronta
  isReady(): boolean {
    return navigationRef.current?.isReady() || false;
  },

  // Obter o estado atual da navegação
  getCurrentRoute() {
    return navigationRef.current?.getCurrentRoute();
  }
}; 