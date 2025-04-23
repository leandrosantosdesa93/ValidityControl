import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

// Definição de tipos para erros comuns
export interface AppError extends Error {
  code?: string;
  details?: string;
  isHandled?: boolean;
}

// Diretório para logs de erro
const LOG_DIRECTORY = `${FileSystem.documentDirectory}logs/`;
const ERROR_LOG_FILE = `${LOG_DIRECTORY}errors.log`;

/**
 * Inicializa o sistema de logs
 */
export async function initErrorLogging() {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOG_DIRECTORY);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOG_DIRECTORY, { intermediates: true });
    }
    
    const logFileInfo = await FileSystem.getInfoAsync(ERROR_LOG_FILE);
    
    if (!logFileInfo.exists) {
      await FileSystem.writeAsStringAsync(ERROR_LOG_FILE, '');
    }
  } catch (error) {
    console.error('Falha ao iniciar sistema de logs', error);
  }
}

/**
 * Registra um erro no arquivo de log
 * @param error Erro a ser registrado
 * @param context Contexto adicional do erro
 */
export async function logError(error: AppError, context: string = 'app') {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      context,
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details
    });
    
    const existingContent = await FileSystem.readAsStringAsync(ERROR_LOG_FILE);
    await FileSystem.writeAsStringAsync(ERROR_LOG_FILE, `${existingContent}${logEntry}\n`);
  } catch (logError) {
    console.error('Falha ao registrar erro', logError);
  }
}

/**
 * Trata uma exceção de forma centralizada
 * @param error Erro a ser tratado
 * @param context Contexto em que o erro ocorreu
 * @param showAlert Se deve mostrar um alerta para o usuário
 */
export async function handleError(
  error: unknown, 
  context: string = 'app', 
  showAlert: boolean = true
) {
  // Converte para AppError
  const appError: AppError = error instanceof Error 
    ? error as AppError 
    : new Error(String(error)) as AppError;
  
  // Evita tratar o mesmo erro múltiplas vezes
  if (appError.isHandled) return;
  appError.isHandled = true;
  
  // Registra no console
  console.error(`[${context}] ${appError.message}`, appError);
  
  // Registra no arquivo de log
  await logError(appError, context);
  
  // Mostra alerta para o usuário
  if (showAlert) {
    Alert.alert(
      'Ocorreu um erro',
      'Houve um problema com a operação. Por favor, tente novamente.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Função para executar código com tratamento de erro
 * @param fn Função a ser executada
 * @param errorHandler Manipulador de erro personalizado
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: AppError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const appError = error as AppError;
    
    // Tratamento personalizado se fornecido
    if (errorHandler) {
      errorHandler(appError);
    } else {
      // Tratamento padrão
      await handleError(appError);
    }
    
    return null;
  }
}

/**
 * Limpa os logs de erro
 */
export async function clearErrorLogs() {
  try {
    await FileSystem.deleteAsync(ERROR_LOG_FILE);
    await FileSystem.writeAsStringAsync(ERROR_LOG_FILE, '');
  } catch (error) {
    console.error('Falha ao limpar logs de erro', error);
  }
} 