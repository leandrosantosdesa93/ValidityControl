import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useProductStore } from '../store/productStore';

export default function SettingsScreen() {
  const { notificationSettings, setNotificationsEnabled, toggleQuietHours } = useProductStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configurações</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Ativar Notificações</Text>
          <Switch
            value={notificationSettings.enabled}
            onValueChange={setNotificationsEnabled}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Modo Silencioso</Text>
          <Switch
            value={notificationSettings.quietHours}
            onValueChange={toggleQuietHours}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#666',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
}); 