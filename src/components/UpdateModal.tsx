import React from 'react';
import { Modal, View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@hooks/useColorScheme';

interface UpdateModalProps {
  isVisible: boolean;
  currentVersion: string;
  requiredVersion: string;
  downloadUrl: string;
}

export function UpdateModal({ 
  isVisible, 
  currentVersion, 
  requiredVersion,
  downloadUrl 
}: UpdateModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const handleUpdate = async () => {
    try {
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('Erro ao abrir URL de download:', error);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {/* Não permitir fechar */}}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContainer,
          { backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }
        ]}>
          <Ionicons name="alert-circle" size={60} color="#FF4444" />
          
          <Text style={[
            styles.title,
            { color: isDark ? '#ffffff' : '#000000' }
          ]}>
            Atualização Necessária
          </Text>
          
          <Text style={[
            styles.message,
            { color: isDark ? '#cccccc' : '#444444' }
          ]}>
            Uma nova versão do ValidityControl está disponível. 
            É necessário atualizar para continuar usando o aplicativo.
          </Text>
          
          <Text style={[
            styles.versionInfo,
            { color: isDark ? '#999999' : '#666666' }
          ]}>
            Sua versão: {currentVersion}{'\n'}
            Versão necessária: {requiredVersion}
          </Text>
          
          <View style={styles.buttonContainer}>
            <View style={styles.updateButton}>
              <Text
                style={styles.updateButtonText}
                onPress={handleUpdate}
              >
                ATUALIZAR AGORA
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  versionInfo: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
  },
  updateButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 