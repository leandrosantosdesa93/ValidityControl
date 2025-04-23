import { differenceInDays, isBefore } from 'date-fns';

export interface ExpirationInfo {
  daysText: string;
  isExpired: boolean;
  color: string;
  daysRemaining: number;
}

/**
 * Calcula informações sobre a data de expiração de um produto
 * @param expirationDate Data de expiração
 * @returns Informações sobre expiração incluindo texto, estado e cor
 */
export function getExpirationInfo(expirationDate: Date): ExpirationInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysRemaining = differenceInDays(expirationDate, today);
  const isExpired = isBefore(expirationDate, today);
  
  let daysText: string;
  let color: string;
  
  if (isExpired) {
    daysText = daysRemaining === -1 
      ? 'Vencido hoje' 
      : `Vencido há ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'dia' : 'dias'}`;
    color = '#FF4444';
  } else if (daysRemaining === 0) {
    daysText = 'Vence hoje';
    color = '#FF8800';
  } else if (daysRemaining <= 30) {
    daysText = `Vence em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`;
    color = daysRemaining <= 7 ? '#FF8800' : '#FFCC00';
  } else {
    daysText = `Vence em ${daysRemaining} dias`;
    color = '#4CAF50';
  }
  
  return { daysText, isExpired, color, daysRemaining };
}

/**
 * Agrupa produtos por mês de expiração
 * @param products Lista de produtos
 * @returns Objeto com contagem por mês
 */
export function getMonthlyExpirationData(products: { expirationDate: Date }[]) {
  const monthlyData: Record<string, number> = {};
  
  products.forEach(product => {
    const date = product.expirationDate;
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    
    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = 0;
    }
    
    monthlyData[monthYear]++;
  });
  
  return monthlyData;
}

/**
 * Classifica produtos por status de expiração
 * @param products Lista de produtos
 * @returns Estatísticas de produtos expirados, a vencer e válidos
 */
export function getExpirationStats(products: { expirationDate: Date }[]) {
  let expired = 0;
  let expiring = 0;
  let valid = 0;
  
  products.forEach(product => {
    const { isExpired, daysRemaining } = getExpirationInfo(product.expirationDate);
    
    if (isExpired) {
      expired++;
    } else if (daysRemaining <= 30) {
      expiring++;
    } else {
      valid++;
    }
  });
  
  return { expired, expiring, valid };
} 