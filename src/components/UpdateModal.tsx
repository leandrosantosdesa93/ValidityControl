import React, { useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Linking, Platform, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../hooks/useColorScheme';

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

  // Impedir que o usuário feche o app com o botão voltar
  useEffect(() => {
    if (isVisible) {
      console.log('[UpdateModal] Modal de atualização visível, bloqueando botão voltar');
      
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          // Mostrar alerta explicando que o app precisa ser atualizado
          Alert.alert(
            'Atualização Necessária',
            'É necessário atualizar o aplicativo para continuar utilizando. Por favor, instale a nova versão.',
            [{ text: 'OK' }]
          );
          return true; // Impedir que o botão voltar feche o app
        }
      );

      return () => backHandler.remove();
    }
  }, [isVisible]);

  const handleUpdate = async () => {
    try {
      console.log('[UpdateModal] Abrindo URL de download:', downloadUrl);
      const canOpen = await Linking.canOpenURL(downloadUrl);
      
      if (canOpen) {
        await Linking.openURL(downloadUrl);
        
        // Mostrar uma mensagem após abrir o link
        setTimeout(() => {
          Alert.alert(
            'Download Iniciado',
            'O download da nova versão foi iniciado. Após completar, instale o APK para atualizar o aplicativo.',
            [{ text: 'OK' }]
          );
        }, 1000);
      } else {
        console.error('[UpdateModal] Não é possível abrir a URL:', downloadUrl);
        Alert.alert(
          'Erro ao Abrir Link',
          'Não foi possível abrir o link de download. Por favor, acesse manualmente:\n\n' + downloadUrl,
          [
            { 
              text: 'Copiar Link',
              onPress: () => {
                // Aqui você pode implementar uma função para copiar o link para a área de transferência
                Alert.alert('Link copiado!', 'Cole em seu navegador para baixar a atualização.');
              }
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('[UpdateModal] Erro ao abrir URL de download:', error);
      Alert.alert(
        'Erro ao Atualizar',
        'Não foi possível abrir a página de download. Por favor, tente novamente mais tarde.'
      );
    }
  };

  // Se o modal não estiver visível, não renderize nada
  if (!isVisible) return null;

  console.log('[UpdateModal] Renderizando modal de atualização:', {
    currentVersion,
    requiredVersion,
    downloadUrl
  });

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Mostrar alerta explicando que o app precisa ser atualizado
        Alert.alert(
          'Atualização Necessária',
          'É necessário atualizar o aplicativo para continuar utilizando. Por favor, instale a nova versão.',
          [{ text: 'OK' }]
        );
      }}
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
            <TouchableOpacity 
              style={styles.updateButton}
              onPress={handleUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.updateButtonText}>
                ATUALIZAR AGORA
              </Text>
            </TouchableOpacity>
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