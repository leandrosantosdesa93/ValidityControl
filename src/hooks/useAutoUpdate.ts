import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { scheduleProductNotifications, scheduleGroupNotifications } from '../services/notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[BackgroundTask] Iniciando tarefa em segundo plano');
  const store = useProductStore.getState();
  const settings = store.notificationSettings;
  
  try {
    // Atualiza notificações individuais
    for (const product of store.products) {
      if (settings.productNotifications[product.code]) {
        console.log(`[BackgroundTask] Reagendando notificações para: ${product.code}`);
        await scheduleProductNotifications(product.code);
      }
    }

    // Atualiza notificações agrupadas se habilitado
    if (settings.groupNotifications) {
      console.log('[BackgroundTask] Reagendando notificações de grupo');
      await scheduleGroupNotifications();
    }

    // Faz backup e limpa produtos vencidos
    console.log('[BackgroundTask] Realizando backup e limpeza');
    const csv = await store.exportToCSV();
    await AsyncStorage.setItem('last-backup', csv);
    store.cleanupExpiredProducts();

    console.log('[BackgroundTask] Tarefa em segundo plano concluída com sucesso');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('[BackgroundTask] Erro na atualização em segundo plano:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export function useAutoUpdate() {
  const store = useProductStore();
  
  useEffect(() => {
    async function registerBackgroundFetch() {
      try {
        console.log('[AutoUpdate] Registrando tarefa em segundo plano...');
        
        // Verificar se a tarefa já está registrada
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
        
        if (isRegistered) {
          console.log('[AutoUpdate] Tarefa já registrada, desregistrando...');
          await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
        }
        
        // Registrar tarefa novamente
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 60, // 1 hora
          stopOnTerminate: false,
          startOnBoot: true,
        });
        
        console.log('[AutoUpdate] Tarefa em segundo plano registrada com sucesso');
        
        // Executar a tarefa imediatamente após o registro
        BackgroundFetch.setMinimumIntervalAsync(60 * 60); // 1 hora
      } catch (err) {
        console.error('[AutoUpdate] Erro ao registrar tarefa em segundo plano:', err);
      }
    }

    registerBackgroundFetch();

    // Limpar registro ao desmontar
    return () => {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK)
        .catch(err => console.log('[AutoUpdate] Erro ao desregistrar tarefa:', err));
    };
  }, []);
  
  // Adicionar um efeito para reagendar notificações quando as configurações mudarem
  useEffect(() => {
    const updateNotifications = async () => {
      try {
        console.log('[AutoUpdate] Configurações de notificação atualizadas, reagendando...');
        
        // Cancelar todas as notificações existentes e reagendar
        if (store.notificationSettings.enabled) {
          for (const product of store.products) {
            if (store.notificationSettings.productNotifications[product.code]) {
              await scheduleProductNotifications(product.code);
            }
          }
          
          if (store.notificationSettings.groupNotifications) {
            await scheduleGroupNotifications();
          }
        }
      } catch (error) {
        console.error('[AutoUpdate] Erro ao atualizar notificações:', error);
      }
    };
    
    updateNotifications();
  }, [store.notificationSettings]);
} 