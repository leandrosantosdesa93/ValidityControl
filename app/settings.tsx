import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Switch, Pressable, TextInput, Alert } from 'react-native';
import { ThemedView } from '@components/ThemedView';
import { ThemedText } from '@components/ThemedText';
import { useColorScheme } from '@hooks/useColorScheme';
import { useProductStore } from '../src/store/productStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { showTestNotification } from '../src/services/notifications';

function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const store = useProductStore();
  const settings = store.notificationSettings;

  // Estado único para controlar os horários
  const [times, setTimes] = useState({
    startHour: '00',
    startMinute: '00',
    endHour: '00',
    endMinute: '00'
  });

  // Função para carregar os dados iniciais
  const loadInitialData = () => {
    const start = settings.quietHoursStart || 0;
    const end = settings.quietHoursEnd || 0;

    console.log('[Settings] Estado atual do store:', {
      start,
      end,
      notificationDays: settings.notificationDays,
      settings
    });

    // Converte as horas para o formato HH:mm
    const startHour = Math.floor(start).toString().padStart(2, '0');
    const startMinute = Math.floor((start % 1) * 60).toString().padStart(2, '0');
    const endHour = Math.floor(end).toString().padStart(2, '0');
    const endMinute = Math.floor((end % 1) * 60).toString().padStart(2, '0');

    console.log('[Settings] Horários calculados:', {
      startHour,
      startMinute,
      endHour,
      endMinute
    });

    setTimes({
      startHour,
      startMinute,
      endHour,
      endMinute
    });
  };

  // Efeito para carregar dados quando a tela recebe foco
  useFocusEffect(
    React.useCallback(() => {
      console.log('[Settings] Tela recebeu foco - Carregando dados...');
      loadInitialData();
    }, [])
  );

  // Efeito para inicializar os valores quando as configurações mudam
  useEffect(() => {
    console.log('[Settings] Configurações mudaram:', settings);
    loadInitialData();
  }, [settings]);

  // Função para validar e atualizar o store
  const handleTimeBlur = (field: keyof typeof times) => {
    let value = times[field];
    
    console.log('[Settings] Validando campo:', { field, value });
    
    // Remove caracteres não numéricos
    value = value.replace(/[^0-9]/g, '');
    
    // Converte para número
    let num = parseInt(value);
    
    // Valida os limites
    if (field.includes('Hour')) {
      // Para horas: 0-23
      if (isNaN(num) || num < 0) num = 0;
      if (num > 23) num = 23;
    } else {
      // Para minutos: 0-59
      if (isNaN(num) || num < 0) num = 0;
      if (num > 59) num = 59;
    }

    // Formata com dois dígitos
    value = num.toString().padStart(2, '0');

    console.log('[Settings] Valor validado:', { field, value });

    // Atualiza o estado com o valor validado
    const newTimes = { ...times, [field]: value };
    setTimes(newTimes);

    // Calcula os valores em decimal para o store
    const startTimeDecimal = parseInt(newTimes.startHour) + (parseInt(newTimes.startMinute) / 60);
    const endTimeDecimal = parseInt(newTimes.endHour) + (parseInt(newTimes.endMinute) / 60);

    console.log('[Settings] Atualizando store:', {
      startTimeDecimal,
      endTimeDecimal,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd
    });

    // Atualiza o store apenas se os valores mudaram
    if (startTimeDecimal !== settings.quietHoursStart || 
        endTimeDecimal !== settings.quietHoursEnd) {
      store.updateNotificationSettings({
        quietHoursStart: startTimeDecimal,
        quietHoursEnd: endTimeDecimal
      });
    }
  };

  // Função para lidar com mudanças nos inputs
  const handleTimeChange = (text: string, field: keyof typeof times) => {
    // Remove caracteres não numéricos
    const value = text.replace(/[^0-9]/g, '').slice(0, 2);
    
    // Atualiza o estado sem validação
    setTimes(prev => ({ ...prev, [field]: value }));
  };

  // Função para atualizar configurações gerais
  const handleSettingChange = (setting: string, value: boolean) => {
    console.log('[Settings] Atualizando configuração:', { setting, value });
    try {
      store.updateNotificationSettings({ [setting]: value });
    } catch (error) {
      console.error('[Settings] Erro ao atualizar configuração:', error);
      Alert.alert('Erro', 'Não foi possível salvar a configuração');
    }
  };

  // Função para alternar modo silencioso
  const handleQuietHoursToggle = (value: boolean) => {
    console.log('[Settings] Alternando modo silencioso:', value);
    try {
      store.toggleQuietHours();
    } catch (error) {
      console.error('[Settings] Erro ao alternar modo silencioso:', error);
      Alert.alert('Erro', 'Não foi possível alterar o modo silencioso');
    }
  };

  // Função para atualizar dias de notificação
  const handleDaysChange = (day: number) => {
    try {
      const currentDays = settings.notificationDays || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day].sort((a, b) => b - a);
      
      console.log('[Settings] Atualizando dias:', { newDays });
      store.updateNotificationSettings({ notificationDays: newDays });
    } catch (error) {
      console.error('[Settings] Erro ao atualizar dias:', error);
      Alert.alert('Erro', 'Não foi possível salvar os dias selecionados');
    }
  };

  return (
    <ScrollView style={{ backgroundColor: isDark ? '#000' : '#fff' }}>
      <ThemedView style={styles.container}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Notificações</ThemedText>
          
          <View style={styles.settingItem}>
            <ThemedText style={styles.settingText}>Ativar notificações</ThemedText>
            <Switch
              value={settings.enabled}
              onValueChange={value => store.setNotificationsEnabled(value)}
              trackColor={{ false: '#767577', true: isDark ? '#0078B9' : '#3498db' }}
              thumbColor={settings.enabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Novo botão para testar notificações */}
          <Pressable
            style={[
              styles.testNotificationButton,
              !settings.enabled && styles.disabledButton
            ]}
            onPress={() => {
              if (settings.enabled) {
                showTestNotification();
              } else {
                Alert.alert(
                  'Notificações desativadas',
                  'Você precisa ativar as notificações para testá-las.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Ionicons 
              name="notifications" 
              size={20} 
              color={settings.enabled ? "white" : "#999"}
            />
            <ThemedText style={[
              styles.testNotificationText,
              !settings.enabled && styles.disabledText
            ]}>
              Testar notificações
            </ThemedText>
          </Pressable>

          <View style={styles.settingItem}>
            <ThemedText>Sons de Notificação</ThemedText>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(value) => handleSettingChange('soundEnabled', value)}
            />
          </View>

          <View style={styles.settingItem}>
            <ThemedText>Agrupar Notificações</ThemedText>
            <Switch
              value={settings.groupNotifications}
              onValueChange={(value) => handleSettingChange('groupNotifications', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="moon" size={24} color={isDark ? '#fff' : '#000'} />
            <ThemedText style={styles.sectionTitle}>Horário Silencioso</ThemedText>
          </View>
          
          <View style={[styles.quietHoursCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
            <View style={styles.quietHoursHeader}>
              <View style={styles.quietHoursStatus}>
                <View style={[styles.statusIndicator, { backgroundColor: settings.quietHours ? '#4CAF50' : '#999' }]} />
                <ThemedText style={styles.quietHoursTitle}>
                  {settings.quietHours ? 'Ativo' : 'Desativado'}
                </ThemedText>
              </View>
              <Switch
                value={settings.quietHours}
                onValueChange={handleQuietHoursToggle}
              />
            </View>

            {settings.quietHours && (
              <View style={styles.quietHoursContent}>
                <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                    <View style={styles.timeHeader}>
                      <Ionicons name="moon" size={20} color={isDark ? '#2196F3' : '#1976D2'} />
                      <ThemedText style={styles.timeLabel}>Início</ThemedText>
                    </View>
                    <View style={[
                      styles.timeInputWrapper,
                      { backgroundColor: isDark ? '#333' : '#f5f5f5' }
                    ]}>
                      <TextInput
                        style={[
                          styles.timeInput,
                          { color: isDark ? '#fff' : '#000' }
                        ]}
                        value={times.startHour}
                        onChangeText={(text) => handleTimeChange(text, 'startHour')}
                        onBlur={() => handleTimeBlur('startHour')}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <ThemedText style={styles.timeSeparator}>:</ThemedText>
                      <TextInput
                        style={[
                          styles.timeInput,
                          { color: isDark ? '#fff' : '#000' }
                        ]}
                        value={times.startMinute}
                        onChangeText={(text) => handleTimeChange(text, 'startMinute')}
                        onBlur={() => handleTimeBlur('startMinute')}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  <View style={styles.timeBlock}>
                    <View style={styles.timeHeader}>
                      <Ionicons name="sunny" size={20} color={isDark ? '#FFA726' : '#F57C00'} />
                      <ThemedText style={styles.timeLabel}>Fim</ThemedText>
                    </View>
                    <View style={[
                      styles.timeInputWrapper,
                      { backgroundColor: isDark ? '#333' : '#f5f5f5' }
                    ]}>
                      <TextInput
                        style={[
                          styles.timeInput,
                          { color: isDark ? '#fff' : '#000' }
                        ]}
                        value={times.endHour}
                        onChangeText={(text) => handleTimeChange(text, 'endHour')}
                        onBlur={() => handleTimeBlur('endHour')}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                      <ThemedText style={styles.timeSeparator}>:</ThemedText>
                      <TextInput
                        style={[
                          styles.timeInput,
                          { color: isDark ? '#fff' : '#000' }
                        ]}
                        value={times.endMinute}
                        onChangeText={(text) => handleTimeChange(text, 'endMinute')}
                        onBlur={() => handleTimeBlur('endMinute')}
                        keyboardType="number-pad"
                        maxLength={2}
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                </View>

                <View style={[styles.infoBox, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
                  <Ionicons name="information-circle" size={20} color={isDark ? '#2196F3' : '#1976D2'} />
                  <ThemedText style={styles.infoText}>
                    Durante o horário silencioso ({times.startHour}:{times.startMinute} - {times.endHour}:{times.endMinute}), 
                    você não receberá notificações. Elas serão entregues após {times.endHour}:{times.endMinute}.
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={24} color={isDark ? '#fff' : '#000'} />
            <ThemedText style={styles.sectionTitle}>Dias de Antecedência</ThemedText>
          </View>
          
          <View style={styles.daysContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <Pressable
                key={day}
                style={[
                  styles.dayButton,
                  {
                    backgroundColor: settings.notificationDays.includes(day)
                      ? isDark ? '#2196F3' : '#1976D2'
                      : isDark ? '#333' : '#f0f0f0'
                  }
                ]}
                onPress={() => handleDaysChange(day)}
              >
                <ThemedText
                  style={[
                    styles.dayText,
                    { color: settings.notificationDays.includes(day) ? '#fff' : isDark ? '#fff' : '#000' }
                  ]}
                >
                  {day}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quietHoursCard: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quietHoursHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quietHoursStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quietHoursTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  quietHoursContent: {
    gap: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 8,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 36,
    padding: 0,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 2,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    opacity: 0.8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  testNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A1DF',
    padding: 12,
    borderRadius: 8,
    marginVertical: 15,
  },
  testNotificationText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledText: {
    color: '#999',
  },
});

export default SettingsScreen; 