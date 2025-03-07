import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL para download do APK mais recente - Atualize com um link real
const APK_DOWNLOAD_URL = 'https://expo.dev/accounts/leandro_santos/projects/ValidityControl/builds/6189ca9c-6b35-453e-8c26-9f23b34bb6fe';

// Versão mínima exigida (isso pode vir de uma API no futuro)
// Atualize estes valores quando lançar novas versões
const MINIMUM_VERSION = {
  version: '1.0.3', // Versão semântica (alterada para testar o modal)
  versionCode: 4     // Android versionCode (alterado para testar o modal)
};

// Chave para armazenar quando o usuário foi notificado pela última vez
const LAST_CHECK_KEY = 'version-check-timestamp';

export interface VersionCheckResult {
  needsUpdate: boolean;
  currentVersion: string;
  requiredVersion: string;
  downloadUrl: string;
}

export async function checkAppVersion(): Promise<VersionCheckResult> {
  // Obter a versão atual do aplicativo
  const currentVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Platform.OS === 'ios' 
    ? Constants.expoConfig?.ios?.buildNumber 
    : Constants.expoConfig?.android?.versionCode;
  
  console.log('Verificando versão do aplicativo:', {
    currentVersion,
    buildNumber,
    minimumVersion: MINIMUM_VERSION.version,
    minimumBuild: MINIMUM_VERSION.versionCode
  });
  
  // Em uma implementação real, você poderia obter a versão mínima de uma API
  // const response = await fetch('https://seusite.com/api/min-version');
  // const MINIMUM_VERSION = await response.json();
  
  // Comparação de versão
  const needsUpdate = isVersionLower(
    currentVersion,
    buildNumber?.toString() || '0',
    MINIMUM_VERSION.version,
    MINIMUM_VERSION.versionCode.toString()
  );
  
  return {
    needsUpdate,
    currentVersion: `${currentVersion} (${buildNumber})`,
    requiredVersion: `${MINIMUM_VERSION.version} (${MINIMUM_VERSION.versionCode})`,
    downloadUrl: APK_DOWNLOAD_URL
  };
}

// Função para comparar versões
function isVersionLower(
  currentVersion: string,
  currentBuild: string,
  requiredVersion: string,
  requiredBuild: string
): boolean {
  // Primeiro, comparar os números de versão semântica
  const current = currentVersion.split('.').map(Number);
  const required = requiredVersion.split('.').map(Number);
  
  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const a = current[i] || 0;
    const b = required[i] || 0;
    
    if (a < b) return true;
    if (a > b) return false;
  }
  
  // Se as versões semânticas forem iguais, comparar os códigos de compilação
  return parseInt(currentBuild) < parseInt(requiredBuild);
}

// Função para verificar se devemos mostrar o modal novamente
// (útil se você quiser limitar a frequência de verificações)
export async function shouldCheckVersion(): Promise<boolean> {
  try {
    const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
    
    if (!lastCheck) return true;
    
    const lastCheckTime = parseInt(lastCheck);
    const now = Date.now();
    
    // Verificar apenas uma vez por dia
    const oneDayInMs = 24 * 60 * 60 * 1000;
    return (now - lastCheckTime) > oneDayInMs;
  } catch (error) {
    console.error('Erro ao verificar timestamp da última verificação:', error);
    return true;
  }
}

// Função para salvar quando verificamos a versão
export async function saveVersionCheckTimestamp(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('Erro ao salvar timestamp da verificação:', error);
  }
} 