import { getExpirationInfo, getExpirationStats, getMonthlyExpirationData } from '../utils/expiration';
import { addDays, subDays } from 'date-fns';

describe('Funções de expiração', () => {
  // Configurando uma data base para os testes
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  describe('getExpirationInfo', () => {
    test('deve identificar produtos vencidos corretamente', () => {
      const expiredYesterday = subDays(today, 1);
      const info = getExpirationInfo(expiredYesterday);
      
      expect(info.isExpired).toBe(true);
      expect(info.daysText).toBe('Vencido há 1 dia');
      expect(info.color).toBe('#FF4444');
      expect(info.daysRemaining).toBe(-1);
    });
    
    test('deve identificar produtos que vencem hoje', () => {
      const expiringToday = new Date(today);
      const info = getExpirationInfo(expiringToday);
      
      expect(info.isExpired).toBe(false);
      expect(info.daysText).toBe('Vence hoje');
      expect(info.color).toBe('#FF8800');
      expect(info.daysRemaining).toBe(0);
    });
    
    test('deve identificar produtos que vencem em breve (7 dias)', () => {
      const expiringNextWeek = addDays(today, 7);
      const info = getExpirationInfo(expiringNextWeek);
      
      expect(info.isExpired).toBe(false);
      expect(info.daysText).toBe('Vence em 7 dias');
      expect(info.color).toBe('#FF8800');
      expect(info.daysRemaining).toBe(7);
    });
    
    test('deve identificar produtos que vencem dentro de 30 dias', () => {
      const expiringIn30Days = addDays(today, 30);
      const info = getExpirationInfo(expiringIn30Days);
      
      expect(info.isExpired).toBe(false);
      expect(info.daysText).toBe('Vence em 30 dias');
      expect(info.color).toBe('#FFCC00');
      expect(info.daysRemaining).toBe(30);
    });
    
    test('deve identificar produtos que vencem após 30 dias', () => {
      const expiringIn60Days = addDays(today, 60);
      const info = getExpirationInfo(expiringIn60Days);
      
      expect(info.isExpired).toBe(false);
      expect(info.daysText).toBe('Vence em 60 dias');
      expect(info.color).toBe('#4CAF50');
      expect(info.daysRemaining).toBe(60);
    });
  });
  
  describe('getExpirationStats', () => {
    test('deve calcular estatísticas corretamente', () => {
      const products = [
        { expirationDate: subDays(today, 10) }, // Expirado
        { expirationDate: subDays(today, 5) },  // Expirado
        { expirationDate: today },              // Vence hoje (expirando)
        { expirationDate: addDays(today, 7) },  // Expirando
        { expirationDate: addDays(today, 60) }, // Válido
      ];
      
      const stats = getExpirationStats(products);
      
      expect(stats.expired).toBe(2);
      expect(stats.expiring).toBe(2);
      expect(stats.valid).toBe(1);
    });
    
    test('deve lidar com uma lista vazia', () => {
      const products: { expirationDate: Date }[] = [];
      const stats = getExpirationStats(products);
      
      expect(stats.expired).toBe(0);
      expect(stats.expiring).toBe(0);
      expect(stats.valid).toBe(0);
    });
  });
  
  describe('getMonthlyExpirationData', () => {
    test('deve agrupar produtos por mês corretamente', () => {
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const nextMonth = currentMonth < 12 ? currentMonth + 1 : 1;
      const nextMonthYear = currentMonth < 12 ? currentYear : currentYear + 1;
      
      const products = [
        { expirationDate: new Date(currentYear, currentMonth - 1, 15) }, // Este mês
        { expirationDate: new Date(currentYear, currentMonth - 1, 20) }, // Este mês
        { expirationDate: new Date(nextMonthYear, nextMonth - 1, 5) },   // Próximo mês
      ];
      
      const monthlyData = getMonthlyExpirationData(products);
      
      expect(monthlyData[`${currentMonth}/${currentYear}`]).toBe(2);
      expect(monthlyData[`${nextMonth}/${nextMonthYear}`]).toBe(1);
    });
    
    test('deve lidar com uma lista vazia', () => {
      const products: { expirationDate: Date }[] = [];
      const monthlyData = getMonthlyExpirationData(products);
      
      expect(Object.keys(monthlyData).length).toBe(0);
    });
  });
}); 