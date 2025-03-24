import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import { useProductStore } from '../store/productStore';
import { differenceInDays } from 'date-fns';
import { Product } from '../types/Product';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import * as Device from 'expo-device';

// Chave para controle de inicialização
const NOTIFICATIONS_INITIALIZED_KEY = '@ValidityControl:notificationsInitialized';

// Configuração básica de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX
  }),
});

/**
 * Verifica se o horário atual está dentro do período de silêncio
 * @returns {boolean} Se o horário atual está dentro do período de silêncio
 */
function isQuietTime(): boolean {
  const store = useProductStore.getState();
  const { quietHours, quietHoursStart, quietHoursEnd } = store.notificationSettings;

  if (!quietHours) return false;

  const now = dayjs();
  const currentHour = now.hour() + now.minute() / 60;

  // Verificar se estamos no período de silêncio
  if (quietHoursStart < quietHoursEnd) {
    // Período normal (ex: 22:00 às 08:00)
    return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
  } else {
    // Período que passa da meia-noite (ex: 22:00 às 08:00)
    return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
  }
}

/**
 * Solicita e verifica permissões de notificação
 */
async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[Notifications] Verificando permissões...');
    
    // Para Android 13 ou superior, verificar permissão POST_NOTIFICATIONS
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('[Notifications] Status atual:', existingStatus);
      
      if (existingStatus !== 'granted') {
        console.log('[Notifications] Solicitando permissões...');
        const { status } = await Notifications.requestPermissionsAsync();
        console.log('[Notifications] Novo status:', status);
        
        if (status !== 'granted') {
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
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar permissões:', error);
    return false;
  }
}

/**
 * Configura os canais de notificação para Android
 */
async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      console.log('[Notifications] Configurando canais para Android...');
      
      // Primeiro, deletar canal existente para garantir atualização
      await Notifications.deleteNotificationChannelAsync('expiration-alerts');
      
      // Criar novo canal com configurações máximas
      await Notifications.setNotificationChannelAsync('expiration-alerts', {
        name: 'Alertas de Validade',
        description: 'Notificações sobre produtos prestes a vencer',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#FF0000',
        sound: true,
        priority: 'max',
        lockscreenVisibility: 'public'
      });
      
      const channels = await Notifications.getNotificationChannelsAsync();
      console.log('[Notifications] Canais configurados:', channels);
      
    } catch (error) {
      console.error('[Notifications] Erro ao configurar canais:', error);
    }
  }
}

/**
 * Inicializa o sistema de notificações completo
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    console.log('[NotificationService] Iniciando setup de notificações...');
    
    // Verificar se já foi inicializado recentemente
    const lastInitialized = await AsyncStorage.getItem(NOTIFICATIONS_INITIALIZED_KEY);
    const now = Date.now();
    
    if (lastInitialized && (now - parseInt(lastInitialized)) < 3600000) { // 1 hora
      console.log('[NotificationService] Inicializado recentemente, pulando.');
      return true;
    }

    // 1. Solicitar permissões
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissões não concedidas.');
      return false;
    }
    
    // 2. Configurar canais para Android
    await setupNotificationChannels();
    
    // 3. Cancelar notificações existentes para evitar duplicatas
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] Notificações anteriores canceladas.');
    
    // 4. Agendar notificações para produtos
    await scheduleNotifications();
    
    // Registrar que foi inicializado
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_KEY, now.toString());
    console.log('[NotificationService] Inicialização completa com sucesso!');
    
    return true;
  } catch (error) {
    console.error('[NotificationService] Erro na inicialização:', error);
    return false;
  }
}

/**
 * Agenda notificações para produtos prestes a vencer
 */
export async function scheduleNotifications(): Promise<void> {
  try {
    console.log('[Notifications] Iniciando agendamento de notificações...');
    
    // 1. Verificar permissões
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] Sem permissões para agendar notificações');
      return;
    }

    // 2. Configurar canais para Android
    await setupNotificationChannels();

    // 3. Cancelar notificações existentes
    const currentNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[Notifications] Notificações agendadas atualmente:', currentNotifications.length);
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 4. Obter produtos e configurações
    const store = useProductStore.getState();
    const { enabled, notificationDays } = store.notificationSettings;
    
    if (!enabled || !notificationDays || notificationDays.length === 0) {
      console.log('[Notifications] Notificações desativadas ou sem dias configurados');
      return;
    }

    // 5. Filtrar produtos válidos
    const products = store.products.filter(product => 
      product.expirationDate && 
      !product.isSold &&
      !isNaN(new Date(product.expirationDate).getTime())
    );

    console.log(`[Notifications] Processando ${products.length} produtos...`);

    // 6. Agendar notificações
    let scheduledCount = 0;
    for (const product of products) {
      const expirationDate = new Date(product.expirationDate);
      const daysUntilExpiration = differenceInDays(expirationDate, new Date());

      if (notificationDays.includes(Math.abs(daysUntilExpiration))) {
        try {
          const identifier = await Notifications.scheduleNotificationAsync({
            content: {
              title: `ALERTA: ${product.description} está prestes a vencer!`,
              body: `Faltam ${daysUntilExpiration} dias para o produto vencer. Código: ${product.code}`,
              data: { productId: product.code },
              sound: true,
              priority: 'max',
              badge: 1,
              ...(Platform.OS === 'android' && { 
                channelId: 'expiration-alerts',
                color: '#FF0000',
                vibrate: [0, 250, 250, 250]
              }),
            },
            trigger: { seconds: 10 } // Notificação em 10 segundos para teste
          });
          
          console.log(`[Notifications] Agendada notificação para ${product.description} (ID: ${identifier})`);
          scheduledCount++;
        } catch (error) {
          console.error(`[Notifications] Erro ao agendar notificação para ${product.description}:`, error);
        }
      }
    }

    // Verificação final
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Total de ${scheduledCount} notificações agendadas. Verificação: ${scheduledNotifications.length} notificações no sistema.`);
    
  } catch (error) {
    console.error('[Notifications] Erro ao agendar notificações:', error);
  }
}

/**
 * Envia uma notificação de teste imediata
 */
export async function sendTestNotification(): Promise<void> {
  try {
    console.log('[Notifications] Enviando notificação de teste...');
    
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] Sem permissões para enviar notificação de teste');
      return;
    }

    // Configurar canais para Android
    await setupNotificationChannels();

    // Enviar notificação de teste
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Teste de Notificação',
        body: 'Se você está vendo isso, as notificações estão funcionando! ' + new Date().toLocaleTimeString(),
        sound: true,
        priority: 'max',
        badge: 1,
        ...(Platform.OS === 'android' && { 
          channelId: 'expiration-alerts',
          color: '#FF0000',
          vibrate: [0, 250, 250, 250]
        }),
      },
      trigger: { seconds: 5 }
    });

    console.log('[Notifications] Notificação de teste enviada com ID:', identifier);

  } catch (error) {
    console.error('[Notifications] Erro ao enviar notificação de teste:', error);
  }
}

/**
 * Agenda 4 notificações repetidas a cada 3 horas para produtos vencendo hoje
 */
export async function scheduleRepeatedNotifications(product: Product): Promise<void> {
  try {
    const baseHours = [9, 12, 15, 18]; // 9h, 12h, 15h e 18h
    const now = new Date();
    const currentHour = now.getHours();
    
    console.log(`[NotificationService] Agendando alertas repetidos para produto ${product.code} vencendo hoje.`);
    
    for (let i = 0; i < baseHours.length; i++) {
      // Apenas agendar horários futuros
      if (baseHours[i] <= currentHour) {
        continue;
      }
      
      const notificationTime = new Date();
      notificationTime.setHours(baseHours[i], 0, 0, 0);
      
      // Se o horário for passado, ajustar para 5 minutos no futuro
      if (notificationTime <= now) {
        notificationTime.setTime(now.getTime() + (5 + i * 3) * 60000);
      }
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `URGENTE: ${product.description} VENCE HOJE!`,
          body: `${i > 0 ? '[ALERTA REPETIDO] ' : ''}Produto com código ${product.code} vence hoje! Verifique imediatamente.`,
          data: { 
            productId: product.code, 
            days: 0, 
            repeatIndex: i 
          },
          color: '#FF0000',
          sound: true,
          vibrate: [0, 500, 250, 500],
          priority: 'max' as any,
          badge: i + 1,
          ...(Platform.OS === 'android' && { channelId: 'urgent' })
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: notificationTime
        },
      });
      
      console.log(`[NotificationService] Agendado alerta #${i+1} para hoje às ${baseHours[i]}h (${notificationTime.toISOString()})`);
    }
  } catch (error) {
    console.error(`[NotificationService] Erro ao agendar alertas repetidos para ${product.code}:`, error);
  }
}

/**
 * Cancela todas as notificações agendadas para um produto específico
 */
export async function cancelProductNotifications(productCode: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    let cancelCount = 0;
    
    for (const notification of scheduledNotifications) {
      const data = notification.content.data as any;
      if (data?.productId === productCode) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        cancelCount++;
      }
    }
    
    if (cancelCount > 0) {
      console.log(`[NotificationService] Canceladas ${cancelCount} notificações do produto ${productCode}`);
    }
  } catch (error) {
    console.error(`[NotificationService] Erro ao cancelar notificações do produto ${productCode}:`, error);
  }
}

/**
 * Cancela todas as notificações agendadas e reagenda com base nas configurações atuais
 */
export async function refreshAllNotifications(): Promise<boolean> {
  try {
    console.log('[NotificationService] Iniciando atualização de todas as notificações...');
    
    // Verificar permissões antes
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[NotificationService] Status atual de permissões:', status);
    
    if (status !== 'granted') {
      console.warn('[NotificationService] Sem permissões para notificações, solicitando...');
      const result = await requestNotificationPermissions();
      if (!result) {
        console.error('[NotificationService] Permissões negadas, não é possível agendar notificações');
        return false;
      }
    }
    
    // Verificar notificações atualmente agendadas
    const currentScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Notificações agendadas atualmente: ${currentScheduled.length}`);
    
    // Cancelar todas as notificações anteriores
    console.log('[NotificationService] Cancelando todas as notificações existentes...');
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // No Android, verificar canais
    if (Platform.OS === 'android') {
      console.log('[NotificationService] Verificando canais de notificação no Android');
      await setupNotificationChannels();
    }
    
    // Reagendar todas as notificações
    console.log('[NotificationService] Reagendando notificações para todos os produtos...');
    await scheduleNotifications();
    
    // Verificar notificações depois de agendar
    const newScheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationService] Notificações reagendadas com sucesso: ${newScheduled.length}`);

  return true;
  } catch (error) {
    console.error('[NotificationService] Erro ao atualizar notificações:', error);
    return false;
  }
}

/**
 * Mostra uma notificação de teste para verificar se o sistema de notificações está funcionando
 */
export async function showTestNotification(): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissões não concedidas para teste de notificação.');
      return;
    }
    
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }
    
    console.log('[NotificationService] Enviando notificação de teste...');
    
    // No Android, especificamos o canal
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Teste de Notificação',
          body: 'Se você está vendo isso, as notificações estão funcionando! 👍',
          data: { screen: 'test' },
          sound: true,
          channelId: 'test-notifications',
        },
        trigger: { seconds: 1 }, // Alterado de null para 1 segundo para garantir funcionamento
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Teste de Notificação',
          body: 'Se você está vendo isso, as notificações estão funcionando! 👍',
          data: { screen: 'test' },
          sound: true,
        },
        trigger: { seconds: 1 }, // Alterado de null para 1 segundo para garantir funcionamento
      });
    }
    
    console.log('[NotificationService] Notificação de teste enviada com sucesso!');
  } catch (error) {
    console.error('[NotificationService] Erro ao enviar notificação de teste:', error);
    Alert.alert(
      'Erro ao Testar Notificações',
      'Não foi possível enviar uma notificação de teste. Verifique as permissões do aplicativo.'
    );
  }
}

function isWithinQuietHours(date: Date, start: number, end: number): boolean {
  const hour = date.getHours();
  if (start <= end) {
    return hour >= start && hour < end;
  } else {
    // Para casos onde o período atravessa a meia-noite (ex: 22h às 7h)
    return hour >= start || hour < end;
  }
}

function getNotificationChannel(daysToExpiry: number): string {
  return daysToExpiry <= 1 ? 'urgent' : 'expiring_products';
}

export async function scheduleGroupNotifications() {
  const store = useProductStore.getState();
  const settings = store.notificationSettings;

  if (!settings.enabled || !settings.groupNotifications) {
    console.log('[NotificationService] Notificações de grupo desativadas. Pulando agendamento.');
    return;
  }

  console.log('[NotificationService] Iniciando agendamento de notificações de grupo');

  // Filtrar produtos não vendidos
  const activeProducts = store.products.filter(product => !product.isSold);
  console.log(`[NotificationService] Total de produtos ativos: ${activeProducts.length} de ${store.products.length}`);

  // Agrupar produtos por dia de vencimento
  const productsByDay = activeProducts.reduce((acc, product) => {
    const daysToExpiry = differenceInDays(
      typeof product.expirationDate === 'string' 
        ? new Date(product.expirationDate) 
        : product.expirationDate, 
      new Date()
    );
    
    if (settings.notificationDays.includes(daysToExpiry)) {
      if (!acc[daysToExpiry]) {
        acc[daysToExpiry] = [];
      }
      acc[daysToExpiry].push(product);
    }
    return acc;
  }, {} as Record<number, Product[]>);

  console.log('[NotificationService] Produtos agrupados por dias de vencimento:', 
    Object.keys(productsByDay).map(day => ({ 
      dias: day, 
      quantidade: productsByDay[parseInt(day)].length 
    }))
  );

  // Agendar notificações agrupadas
  for (const [days, products] of Object.entries(productsByDay)) {
    if ((products as Product[]).length > 1) {
      const daysNum = parseInt(days);
      const notificationDate = new Date();
      notificationDate.setDate(notificationDate.getDate() + daysNum);
      notificationDate.setHours(8, 0, 0, 0);

      // Verificar se estamos tentando agendar para o passado
      if (notificationDate <= new Date()) {
        console.log(`[NotificationService] Data da notificação de grupo ${notificationDate.toISOString()} é no passado, ajustando...`);
        
        // Se for para hoje, agendar para 10 minutos no futuro
        const futureDate = new Date();
        futureDate.setMinutes(futureDate.getMinutes() + 10);
        notificationDate.setTime(futureDate.getTime());
        
        console.log(`[NotificationService] Nova data ajustada: ${notificationDate.toISOString()}`);
      }

      if (settings.quietHours && isWithinQuietHours(notificationDate, settings.quietHoursStart, settings.quietHoursEnd)) {
        notificationDate.setHours(settings.quietHoursEnd, 0, 0, 0);
        console.log(`[NotificationService] Notificação agendada para após o modo silencioso: ${notificationDate.toISOString()}`);
      }

      const channel = getNotificationChannel(daysNum);
      const productsArray = products as Product[];

      console.log(`[NotificationService] Agendando notificação de grupo para ${productsArray.length} produtos que vencem em ${days} dias`);

      try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${productsArray.length} produtos próximos ao vencimento`,
          body: `Você tem ${productsArray.length} produtos que vencem em ${days} dias`,
            sound: settings.soundEnabled,
            data: { isGroup: true, days: daysNum },
            color: daysNum <= 1 ? '#FF0000' : '#FFA500',
            vibrate: daysNum <= 1 ? [0, 500, 250, 500] : [0, 250, 250, 250],
            priority: daysNum <= 1 ? 'max' : 'high',
            ...(Platform.OS === 'android' && { channelId: channel })
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: notificationDate
          }
        });
        console.log(`[NotificationService] Notificação de grupo agendada com sucesso para ${days} dias`);
      } catch (error) {
        console.error(`[NotificationService] Erro ao agendar notificação de grupo:`, error);
      }
    }
  }
  
  // Verificar notificações agendadas
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`[NotificationService] Total de notificações de grupo agendadas: ${scheduled.length}`);
}

/**
 * Retorna um relatório completo sobre o estado atual do sistema de notificações
 * Útil para depuração e registro de problemas
 * @returns {Promise<string>} Relatório de diagnóstico
 */
export async function getNotificationDiagnosticReport(): Promise<string> {
  try {
    console.log('[Notifications] Gerando relatório de diagnóstico');
    
    // Verificar permissões
    const permissionStatus = await Notifications.getPermissionsAsync();
    
    // Verificar notificações agendadas
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Obter configurações do store
    const store = useProductStore.getState();
    const { enabled, notificationDays, quietHours, quietHoursStart, quietHoursEnd } = store.notificationSettings;
    
    // Construir relatório
    let report = '📱 DIAGNÓSTICO DE NOTIFICAÇÕES 📱\n\n';
    
    // Informações do dispositivo
    report += `🔹 Dispositivo: ${Platform.OS} ${Platform.Version}\n`;
    report += `🔹 Expo Device ID: ${Device.modelId || 'Não disponível'}\n\n`;
    
    // Status de permissões
    report += `🔹 Permissões de Notificação: ${permissionStatus.status}\n`;
    report += `🔹 Can use notifications: ${permissionStatus.canAskAgain ? 'Sim' : 'Não'}\n\n`;
    
    // Configurações do app
    report += `🔹 Notificações habilitadas: ${enabled ? 'Sim' : 'Não'}\n`;
    report += `🔹 Dias de notificação: ${notificationDays.length > 0 ? notificationDays.join(', ') : 'Nenhum'}\n`;
    report += `🔹 Modo silencioso: ${quietHours ? 'Ativo' : 'Inativo'}\n`;
    
    if (quietHours) {
      const startHour = Math.floor(quietHoursStart);
      const startMin = Math.round((quietHoursStart - startHour) * 60);
      const endHour = Math.floor(quietHoursEnd);
      const endMin = Math.round((quietHoursEnd - endHour) * 60);
      
      report += `🔹 Horário silencioso: ${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}\n`;
    }
    
    report += '\n';
    
    // Notificações agendadas
    report += `🔹 Notificações agendadas: ${scheduledNotifications.length}\n\n`;
    
    if (scheduledNotifications.length > 0) {
      scheduledNotifications.forEach((notification, index) => {
        report += `📬 Notificação #${index + 1}:\n`;
        report += `   ID: ${notification.identifier}\n`;
        report += `   Título: ${notification.content.title}\n`;
        report += `   Corpo: ${notification.content.body}\n`;
        
        // Trigger info
        if ('seconds' in notification.trigger) {
          report += `   Trigger: Em ${notification.trigger.seconds} segundos\n`;
        } else if ('date' in notification.trigger) {
          report += `   Trigger: ${new Date(notification.trigger.date).toLocaleString('pt-BR')}\n`;
        }
        
        report += '\n';
      });
    } else {
      report += '❌ Nenhuma notificação agendada no momento.\n\n';
    }
    
    // Verificar horário atual
    const now = new Date();
    report += `🔹 Horário atual: ${now.toLocaleString('pt-BR')}\n`;
    report += `🔹 Em horário silencioso: ${isQuietTime() ? 'Sim' : 'Não'}\n\n`;
    
    // Soluções recomendadas
    if (!enabled) {
      report += '⚠️ RECOMENDAÇÃO: Habilite as notificações nas configurações do app.\n';
    }
    
    if (permissionStatus.status !== 'granted') {
      report += '⚠️ RECOMENDAÇÃO: Permissões não concedidas. Verifique as configurações do dispositivo.\n';
    }
    
    if (notificationDays.length === 0) {
      report += '⚠️ RECOMENDAÇÃO: Configure os dias de antecedência para notificações.\n';
    }
    
    if (scheduledNotifications.length === 0 && enabled && permissionStatus.status === 'granted') {
      report += '⚠️ RECOMENDAÇÃO: Não há notificações agendadas. Tente reiniciar o aplicativo.\n';
    }
    
    console.log('[Notifications] Relatório de diagnóstico gerado');
    return report;
  } catch (error) {
    console.error('[Notifications] Erro ao gerar relatório de diagnóstico:', error);
    return `Erro ao gerar relatório: ${error.message}`;
  }
}

// Verificar agendamentos atuais - útil para debug
export async function checkScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Notificações agendadas: ${scheduledNotifications.length}`);
    scheduledNotifications.forEach((notification, index) => {
      console.log(`[Notifications] #${index + 1} ID: ${notification.identifier}`);
      console.log(`[Notifications] Conteúdo:`, notification.content);
      console.log(`[Notifications] Trigger:`, notification.trigger);
    });
    return scheduledNotifications;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar notificações agendadas:', error);
    return [];
  }
}

// Função para reagendar notificações (chamada na inicialização do app)
export async function rescheduleNotifications(): Promise<void> {
  console.log('[Notifications] Reagendando notificações...');
  try {
    // Verificar configurações antes de reagendar
    const store = useProductStore.getState();
    if (!store.notificationSettings.enabled) {
      console.log('[Notifications] Notificações desabilitadas, pulando reagendamento');
      return;
    }
    
    // Obter o status das permissões
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Notifications] Permissões não concedidas, solicitando...');
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.log('[Notifications] Permissões recusadas pelo usuário');
        return;
      }
    }
    
    // Configurar canais no Android
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }
    
    // Cancelar notificações existentes
    try {
      console.log('[Notifications] Cancelando notificações existentes...');
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] Notificações existentes canceladas com sucesso');
    } catch (error) {
      console.error('[Notifications] Erro ao cancelar notificações existentes:', error);
      // Continuar mesmo com o erro
    }
    
    // Reagendar
    console.log('[Notifications] Agendando notificações para produtos individuais...');
    await scheduleNotifications();
    
    // Verificar se as notificações de grupo estão ativadas
    if (store.notificationSettings.groupNotifications) {
      console.log('[Notifications] Agendando notificações de grupo...');
      await scheduleGroupNotifications();
    }
    
    // Verificar se as notificações foram agendadas
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Total após reagendamento: ${scheduledNotifications.length} notificações`);
    
    if (scheduledNotifications.length === 0) {
      console.warn('[Notifications] Nenhuma notificação foi agendada. Verificando produtos...');
      
      // Verificar se há produtos próximos ao vencimento
      const productsNearExpiration = store.products.filter(product => {
        if (product.isSold) return false;
        
    const expirationDate = new Date(product.expirationDate);
    const now = new Date();
        const diffDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 && diffDays <= 7; // Produtos que vencem em até 7 dias
      });
      
      if (productsNearExpiration.length > 0) {
        console.log(`[Notifications] Encontrados ${productsNearExpiration.length} produtos próximos ao vencimento, mas nenhuma notificação foi agendada.`);
        console.log('[Notifications] Produtos próximos ao vencimento:', productsNearExpiration.map(p => 
          `${p.description} (${p.code}): vence em ${Math.ceil((new Date(p.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias`
        ));
        
        // Tentar reagendar usando uma abordagem direta
        for (const product of productsNearExpiration) {
          const daysToExpiry = Math.ceil((new Date(product.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          
          console.log(`[Notifications] Tentando agendar manualmente para ${product.description}`);
          
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `ALERTA Manual: ${product.description} próximo ao vencimento`,
                body: `Este produto vence em ${daysToExpiry} dias. Verifique-o!`,
                data: { productId: product.code },
                ...(Platform.OS === 'android' && { channelId: 'urgent' }),
              },
              trigger: { seconds: 30 } // Agendar para 30 segundos no futuro
            });
            console.log(`[Notifications] Notificação manual agendada para ${product.description}`);
  } catch (error) {
            console.error(`[Notifications] Erro ao agendar notificação manual:`, error);
          }
        }
      } else {
        console.log('[Notifications] Não foram encontrados produtos próximos ao vencimento.');
      }
    }
    
    console.log('[Notifications] Notificações reagendadas com sucesso');
        return;
  } catch (error) {
    console.error('[Notifications] Erro ao reagendar notificações:', error);
  }
}

// Registra listeners para o início e retorno do aplicativo
export function registerNotificationListeners(): () => void {
  // Remover botões de diagnóstico e teste, mantendo apenas a lógica essencial
  
  // Retornar função de limpeza
  return () => {
    // Limpeza, se necessário
  };
}

/**
 * Verifica se o app tem permissão para enviar notificações
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Executando em emulador, permissões concedidas');
      return true;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Status atual:', existingStatus);
    
    if (existingStatus !== 'granted') {
      console.log('[Notifications] Solicitando permissões...');
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('[Notifications] Novo status:', status);
      return status === 'granted';
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Erro ao verificar permissões:', error);
    return false;
  }
}

/**
 * Configura o sistema de notificações
 */
export async function setupNotifications(): Promise<void> {
  try {
    console.log('[Notifications] Configurando sistema de notificações...');
    
    // 1. Verificar permissões
    const hasPermission = await checkNotificationPermissions();
    if (!hasPermission) {
      console.log('[Notifications] Sem permissões para configurar notificações');
      return;
    }

    // 2. Configurar canais para Android
    if (Platform.OS === 'android') {
      await setupNotificationChannels();
    }

    // 3. Cancelar notificações existentes para evitar duplicatas
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Configuração concluída com sucesso');
  } catch (error) {
    console.error('[Notifications] Erro ao configurar notificações:', error);
  }
}

// Função diagnóstica para verificar canais de notificação
export async function checkNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('[Notifications] Verificação de canais só é aplicável no Android');
    return;
  }
  
  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    
    console.log(`[Notifications] === Diagnóstico de Canais de Notificação ===`);
    console.log(`[Notifications] Total de canais configurados: ${channels.length}`);
    
    if (channels.length === 0) {
      console.warn('[Notifications] ALERTA: Nenhum canal configurado! Inicializando canais...');
      await setupNotificationChannels();
      return;
    }
    
    channels.forEach(channel => {
      console.log(`[Notifications] 
        ID: ${channel.id}
        Nome: ${channel.name}
        Importância: ${channel.importance}
        Som: ${channel.sound ? 'Ativado' : 'Desativado'}
      `);
    });
    
    // Verificar se os canais necessários existem
    const requiredChannels = ['test-notifications', 'urgent', 'expired_products', 'expiration-alerts'];
    const missingChannels = requiredChannels.filter(
      id => !channels.some(channel => channel.id === id)
    );
    
    if (missingChannels.length > 0) {
      console.warn(`[Notifications] ALERTA: Canais ausentes: ${missingChannels.join(', ')}`);
      console.log('[Notifications] Recriando canais ausentes...');
      await setupNotificationChannels();
    } else {
      console.log('[Notifications] Todos os canais necessários estão configurados.');
    }
  } catch (error) {
    console.error('[Notifications] Erro ao verificar canais:', error);
  }
}

/**
 * Função robusta para testar notificações, com diferentes configurações
 * para ajudar a diagnosticar problemas
 */
export async function testMultipleNotificationMethods(): Promise<string[]> {
  const results: string[] = [];
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  
  try {
    console.log('[Notifications] === TESTE ABRANGENTE DE NOTIFICAÇÕES ===');
    
    // Verificar permissões
    const permStatus = await checkNotificationPermissions();
    console.log('[Notifications] Status de permissão:', permStatus);
    
    if (permStatus !== 'granted') {
      console.log('[Notifications] Solicitando permissões...');
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.error('[Notifications] Permissão não concedida, não é possível testar notificações');
        return ['Permissão não concedida. Vá em Configurações > Apps > ValidityControl > Notificações e ative as notificações.'];
      }
    }
    
    // Verificar/configurar canais no Android
    if (Platform.OS === 'android') {
      await checkNotificationChannels();
    }
    
    // Testar 3 métodos diferentes para enviar notificações
    
    // Método 1: Notificação básica com trigger: seconds
    try {
      const id1 = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Teste 1: Trigger Segundos (${timestamp})`,
          body: 'Esta notificação usa trigger com segundos',
          data: { testType: 'seconds' },
          ...(Platform.OS === 'android' && { channelId: 'test-notifications' }),
        },
        trigger: { seconds: 2 }
      });
      console.log('[Notifications] Teste 1 agendado com ID:', id1);
      results.push(`Teste 1 (segundos): ${id1}`);
    } catch (e) {
      console.error('[Notifications] Falha no Teste 1:', e);
      results.push(`Teste 1 (segundos): FALHA - ${e.message}`);
    }
    
    // Método 2: Notificação com data específica (5 segundos no futuro)
    try {
      const futureDate = new Date(Date.now() + 5000);
      const id2 = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Teste 2: Trigger Data (${timestamp})`,
          body: 'Esta notificação usa data específica',
          data: { testType: 'date' },
          ...(Platform.OS === 'android' && { channelId: 'test-notifications' }),
        },
        trigger: { date: futureDate }
      });
      console.log('[Notifications] Teste 2 agendado com ID:', id2);
      results.push(`Teste 2 (data): ${id2}`);
    } catch (e) {
      console.error('[Notifications] Falha no Teste 2:', e);
      results.push(`Teste 2 (data): FALHA - ${e.message}`);
    }
    
    // Método 3: Para Android, teste com NotificationPresentationOptions adicionais
    if (Platform.OS === 'android') {
      try {
        const id3 = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Teste 3: Android Específico (${timestamp})`,
            body: 'Notificação com configurações específicas para Android',
            data: { testType: 'android' },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 250, 250, 250],
            color: '#FF0000',
            channelId: 'urgent',
          },
          trigger: { seconds: 8 }
        });
        console.log('[Notifications] Teste 3 agendado com ID:', id3);
        results.push(`Teste 3 (Android específico): ${id3}`);
      } catch (e) {
        console.error('[Notifications] Falha no Teste 3:', e);
        results.push(`Teste 3 (Android específico): FALHA - ${e.message}`);
      }
    }
    
    // Verificar notificações agendadas
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Notifications] Total de ${scheduled.length} notificações agendadas`);
    
    return results;
  } catch (error) {
    console.error('[Notifications] Erro nos testes de notificação:', error);
    return [`Erro geral: ${error.message}`];
  }
} 