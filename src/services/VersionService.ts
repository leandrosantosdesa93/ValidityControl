import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

// URL para download do APK mais recente
const APK_DOWNLOAD_URL = 'https://expo.dev/accounts/leandro_santos/projects/ValidityControl/builds/a8112b6e-8bc8-4db6-b8fd-ff484731386a';

// Versão mínima exigida (isso pode vir de uma API no futuro)
const MINIMUM_VERSION = {
  version: '1.0.4', // Versão semântica
  versionCode: 5     // Android versionCode
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
  try {
    console.log('[VersionService] Iniciando verificação de versão...');

    // Obter a versão atual do aplicativo
    let currentVersion = '';
    let buildNumber = '';

    if (Platform.OS === 'android') {
      // No Android, obter a versão de forma mais direta
      currentVersion = await Application.nativeApplicationVersion || '';
      buildNumber = (await Application.nativeBuildVersion) || '';
      
      console.log('[VersionService] Versão do Android obtida via Application API:', {
        currentVersion,
        buildNumber
      });
    } else {
      // No iOS ou web, usar Constants
      currentVersion = Constants.expoConfig?.version || '1.0.0';
      buildNumber = Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber || '1'
        : String(Constants.expoConfig?.android?.versionCode || '1');
    }

    // Se não conseguimos obter a versão por nenhum meio, usar fallback
    if (!currentVersion) {
      console.warn('[VersionService] Não foi possível obter a versão atual, usando fallback');
      currentVersion = Constants.expoConfig?.version || '1.0.0';
    }

    if (!buildNumber) {
      console.warn('[VersionService] Não foi possível obter o build number, usando fallback');
      buildNumber = Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber || '1'
        : String(Constants.expoConfig?.android?.versionCode || '1');
    }

    console.log('[VersionService] Verificando versão do aplicativo:', {
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
      buildNumber,
      MINIMUM_VERSION.version,
      MINIMUM_VERSION.versionCode.toString()
    );

    console.log('[VersionService] Resultado da verificação:', {
      needsUpdate,
      currentVersion: `${currentVersion} (${buildNumber})`,
      requiredVersion: `${MINIMUM_VERSION.version} (${MINIMUM_VERSION.versionCode})`
    });

    return {
      needsUpdate,
      currentVersion: `${currentVersion} (${buildNumber})`,
      requiredVersion: `${MINIMUM_VERSION.version} (${MINIMUM_VERSION.versionCode})`,
      downloadUrl: APK_DOWNLOAD_URL
    };
  } catch (error) {
    console.error('[VersionService] Erro ao verificar versão:', error);
    
    // Em caso de erro, forçar a atualização para garantir segurança
    return {
      needsUpdate: true,
      currentVersion: 'Desconhecida',
      requiredVersion: `${MINIMUM_VERSION.version} (${MINIMUM_VERSION.versionCode})`,
      downloadUrl: APK_DOWNLOAD_URL
    };
  }
}

// Função para comparar versões
function isVersionLower(
  currentVersion: string,
  currentBuild: string,
  requiredVersion: string,
  requiredBuild: string
): boolean {
  console.log('[VersionService] Comparando versões:', {
    currentVersion,
    currentBuild,
    requiredVersion,
    requiredBuild
  });

  try {
    // Primeiro, comparar os números de versão semântica
    const current = currentVersion.split('.').map(Number);
    const required = requiredVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(current.length, required.length); i++) {
      const a = current[i] || 0;
      const b = required[i] || 0;

      if (a < b) {
        console.log('[VersionService] Versão semântica menor:', a, '<', b);
        return true;
      }
      if (a > b) {
        console.log('[VersionService] Versão semântica maior:', a, '>', b);
        return false;
      }
    }

    // Converter para números
    const currentBuildNum = parseInt(currentBuild, 10);
    const requiredBuildNum = parseInt(requiredBuild, 10);

    // Se as versões semânticas forem iguais, comparar os códigos de compilação
    const result = currentBuildNum < requiredBuildNum;
    console.log('[VersionService] Comparando builds:', 
      currentBuildNum, 
      result ? '<' : '>=', 
      requiredBuildNum, 
      '=', 
      result
    );
    
    return result;
  } catch (error) {
    console.error('[VersionService] Erro na comparação de versões:', error);
    // Em caso de erro de parsing, forçar atualização por segurança
    return true;
  }
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
    console.error('[VersionService] Erro ao verificar timestamp:', error);
    return true;
  }
}

// Salvar o timestamp da última verificação
export async function saveVersionCheckTimestamp(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('[VersionService] Erro ao salvar timestamp:', error);
  }
} 