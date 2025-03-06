import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { scheduleProductNotifications, scheduleGroupNotifications } from '../services/notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const store = useProductStore.getState();
  const settings = store.notificationSettings;
  
  try {
    // Atualiza notificações individuais
    for (const product of store.products) {
      if (settings.productNotifications[product.code]) {
        await scheduleProductNotifications(product.code);
      }
    }

    // Atualiza notificações agrupadas se habilitado
    if (settings.groupNotifications) {
      await scheduleGroupNotifications();
    }

    // Faz backup e limpa produtos vencidos
    const csv = await store.exportToCSV();
    await AsyncStorage.setItem('last-backup', csv);
    store.cleanupExpiredProducts();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Erro na atualização em segundo plano:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export function useAutoUpdate() {
  useEffect(() => {
    async function registerBackgroundFetch() {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 60 * 24, // 24 horas
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch (err) {
        console.error('Erro ao registrar tarefa em segundo plano:', err);
      }
    }

    registerBackgroundFetch();

    return () => {
      BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    };
  }, []);
} 