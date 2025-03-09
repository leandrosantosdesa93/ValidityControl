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

    // Garantir que as versões estejam em formatos corretos
    // Remover qualquer espaço ou caractere não permitido
    currentVersion = currentVersion.trim().replace(/[^0-9.]/g, '');
    buildNumber = buildNumber.trim().replace(/[^0-9]/g, '');
    
    // Garantir que não temos strings vazias
    if (!currentVersion) currentVersion = '1.0.0';
    if (!buildNumber) buildNumber = '1';

    console.log('[VersionService] Versão atual normalizada:', {
      currentVersion,
      buildNumber,
      minimumVersion: MINIMUM_VERSION.version,
      minimumBuild: MINIMUM_VERSION.versionCode
    });

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

    // DEBUG: Teste direto das versões numéricas
    const currentParts = currentVersion.split('.').map(Number);
    const requiredParts = MINIMUM_VERSION.version.split('.').map(Number);
    
    console.log('[VersionService] Comparação direta de componentes:', {
      currentMajor: currentParts[0] || 0,
      currentMinor: currentParts[1] || 0,
      currentPatch: currentParts[2] || 0,
      requiredMajor: requiredParts[0] || 0,
      requiredMinor: requiredParts[1] || 0,
      requiredPatch: requiredParts[2] || 0,
      buildComparison: parseInt(buildNumber, 10) < MINIMUM_VERSION.versionCode
    });

    // Forçar atualização para versões anteriores a 1.0.4
    const majorIsLower = (currentParts[0] || 0) < requiredParts[0];
    const majorEqual = (currentParts[0] || 0) === requiredParts[0];
    const minorIsLower = (currentParts[1] || 0) < requiredParts[1];
    const minorEqual = (currentParts[1] || 0) === requiredParts[1];
    const patchIsLower = (currentParts[2] || 0) < requiredParts[2];
    
    const versionIsLower = majorIsLower || 
                           (majorEqual && minorIsLower) || 
                           (majorEqual && minorEqual && patchIsLower);
                           
    const buildIsLower = parseInt(buildNumber, 10) < MINIMUM_VERSION.versionCode;
    
    // Se a versão semântica ou o código de build for menor, precisa atualizar
    const forcedNeedsUpdate = versionIsLower || buildIsLower;
    
    console.log('[VersionService] Verificação manual:', {
      versionIsLower,
      buildIsLower,
      forcedNeedsUpdate
    });

    return {
      needsUpdate: forcedNeedsUpdate,  // Usar nossa verificação manual
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
    // Sanitizar as entradas
    currentVersion = currentVersion.trim();
    currentBuild = currentBuild.trim();
    requiredVersion = requiredVersion.trim();
    requiredBuild = requiredBuild.trim();
    
    // Garantir que temos valores válidos
    if (!currentVersion || !requiredVersion) {
      console.warn('[VersionService] Versões inválidas para comparação:', { currentVersion, requiredVersion });
      return true; // Forçar atualização se as versões forem inválidas
    }

    // Primeiro, comparar os números de versão semântica
    const current = currentVersion.split('.').map(part => parseInt(part, 10) || 0);
    const required = requiredVersion.split('.').map(part => parseInt(part, 10) || 0);

    // Garantir que ambos os arrays tenham pelo menos 3 elementos (major.minor.patch)
    while (current.length < 3) current.push(0);
    while (required.length < 3) required.push(0);

    // Comparar major, minor, patch
    for (let i = 0; i < 3; i++) {
      const a = current[i];
      const b = required[i];

      if (a < b) {
        console.log(`[VersionService] Versão semântica menor no componente ${i}: ${a} < ${b}`);
        return true;
      }
      if (a > b) {
        console.log(`[VersionService] Versão semântica maior no componente ${i}: ${a} > ${b}`);
        return false;
      }
    }

    // Se as versões semânticas forem iguais, comparar os códigos de compilação
    const currentBuildNum = parseInt(currentBuild, 10) || 0;
    const requiredBuildNum = parseInt(requiredBuild, 10) || 0;

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