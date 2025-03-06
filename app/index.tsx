import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable, Text, RefreshControl } from 'react-native';
import { ThemedView } from '@components/ThemedView';
import { ThemedText } from '@components/ThemedText';
import { useColorScheme } from '@hooks/useColorScheme';
import { useProductStore } from '@/store/productStore';
import { getProducts } from '@/services/ProductService';
import { Product } from '@/types/Product';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, format, startOfDay, addDays, isBefore, isAfter, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { router, useFocusEffect } from 'expo-router';
import { eventEmitter, PRODUCT_EVENTS } from '@/services/EventEmitter';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

interface ChartData {
  x: string;
  y: number;
  color?: string;
}

interface BarChartProps {
  data: ChartData[];
  width: number;
  height: number;
  isDark: boolean;
}

interface DonutChartProps {
  data: ChartData[];
  size: number;
  isDark: boolean;
}

interface DonutSegment {
  path: string;
  color: string;
  label: string;
  value: number;
}

function SimpleBarChart({ data, width, height, isDark }: BarChartProps) {
  // Filtramos apenas os itens com valores > 0 para calcular o máximo
  const itemsWithValues = data.filter(d => d.y > 0);
  const maxValue = Math.max(...itemsWithValues.map(d => d.y), 1); // Garantir que maxValue nunca seja zero
  const availableWidth = width - 40; // Espaço disponível após margens
  const barWidth = Math.min(30, (availableWidth / data.length) - 10); // Largura máxima de 30px ou proporcional
  const barSpacing = (availableWidth - (barWidth * data.length)) / (data.length + 1); // Espaçamento uniforme
  const maxHeight = height - 80;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height - 20}>
        {data.map((d, i) => {
          // Só renderizar barras para itens com valores > 0
          if (d.y === 0) return null;
          
          const barHeight = Math.max(10, (d.y / maxValue) * maxHeight);
          const barX = 20 + barSpacing + (i * (barWidth + barSpacing));
          
          return (
            <Rect
              key={i}
              x={barX}
              y={height - barHeight - 35}
              width={barWidth}
              height={barHeight}
              fill={d.color || "#2196F3"}
              rx={4}
            />
          );
        })}
        <Line
          x1="20"
          y1={height - 35}
          x2={width - 20}
          y2={height - 35}
          stroke={isDark ? '#666' : '#ccc'}
          strokeWidth="1"
        />
      </Svg>
      <View style={[styles.chartLabels, { marginTop: -2 }]}>
        {data.map((d, i) => {
          const labelWidth = availableWidth / data.length;
          const labelStyle = {
            width: labelWidth,
            textAlign: 'center' as const,
            marginLeft: i === 0 ? 20 : 0, // Ajuste para o primeiro rótulo
            // Deixar o texto mais claro para meses sem dados
            opacity: d.y > 0 ? 1 : 0.5
          };
          
          return (
            <ThemedText key={i} style={[styles.chartLabel, labelStyle]}>
              {d.x}
            </ThemedText>
          );
        })}
      </View>
    </View>
  );
}

function SimpleDonutChart({ data, size, isDark }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.y, 0);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;
  const strokeWidth = size * 0.1;

  let startAngle = 0;
  const segments: DonutSegment[] = data.map((item, index) => {
    const percentage = item.y / total;
    const angle = percentage * Math.PI * 2;
    
    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(startAngle + angle);
    const y2 = centerY + radius * Math.sin(startAngle + angle);

    const segment = {
      path: `M ${x1} ${y1} A ${radius} ${radius} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}`,
      color: item.color || '#000',
      label: item.x,
      value: item.y
    };

    startAngle += angle;
    return segment;
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {segments.map((segment, index) => (
          <Circle
            key={index}
            cx={centerX}
            cy={centerY}
            r={radius}
            strokeWidth={strokeWidth}
            stroke={segment.color}
            fill="none"
            strokeDasharray={`${(segment.value / total) * (2 * Math.PI * radius)} ${2 * Math.PI * radius}`}
            strokeDashoffset={segments
              .slice(0, index)
              .reduce((offset, s) => offset - (s.value / total) * (2 * Math.PI * radius), 0)}
          />
        ))}
      </Svg>
      <View style={styles.chartLegend}>
        {segments.map((segment, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: segment.color }]} />
            <ThemedText style={styles.legendText}>
              {segment.label} ({segment.value})
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const store = useProductStore();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    expiring: 0,
    expired: 0,
    valid: 0
  });
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([]);

  // Função para calcular estatísticas e dados mensais
  const calculateStats = useCallback(async () => {
    try {
      // Obtém os produtos diretamente do ProductService
      const products = await getProducts();
      const currentDate = startOfDay(new Date());
      const fiveDaysFromNow = addDays(currentDate, 6);
      
      if (!products || products.length === 0) {
        console.log('[Home] Nenhum produto encontrado');
        setStats({
          total: 0,
          expiring: 0,
          expired: 0,
          valid: 0
        });
        setMonthlyData([]);
        return;
      }

      console.log('[Home] Calculando estatísticas para', products.length, 'produtos');
      
      // Inicializa contadores
      let totalProducts = 0;
      let expiringProducts = 0;
      let expiredProducts = 0;
      let validProducts = 0;
      
      // Processa cada produto
      products.forEach((product: Product) => {
        if (!product?.expirationDate) return;
        
        try {
          // Adiciona ao total geral
          totalProducts++;
          
          const expirationDate = startOfDay(new Date(product.expirationDate));
          
          // Classifica o produto baseado na data de validade
          if (isBefore(expirationDate, currentDate)) {
            // Produto vencido
            expiredProducts++;
            console.log('[Home] Produto vencido:', {
              code: product.code,
              expirationDate: format(expirationDate, 'dd/MM/yyyy')
            });
          } else if ((isSameDay(expirationDate, currentDate) || isAfter(expirationDate, currentDate)) && 
                     isBefore(expirationDate, fiveDaysFromNow)) {
            // Produto próximo ao vencimento (5 dias ou menos)
            expiringProducts++;
            console.log('[Home] Produto a vencer:', {
              code: product.code,
              expirationDate: format(expirationDate, 'dd/MM/yyyy'),
              diasRestantes: differenceInDays(expirationDate, currentDate)
            });
          } else {
            // Produto dentro do prazo (mais de 5 dias)
            validProducts++;
            console.log('[Home] Produto válido:', {
              code: product.code,
              expirationDate: format(expirationDate, 'dd/MM/yyyy')
            });
          }
        } catch (error) {
          console.error('[Home] Erro ao processar produto:', error, product);
        }
      });

      // Atualiza estatísticas
      const newStats = {
        total: totalProducts,
        expiring: expiringProducts,
        expired: expiredProducts,
        valid: validProducts
      };

      console.log('[Home] Estatísticas calculadas:', newStats);
      setStats(newStats);

      // Calcula dados mensais para o gráfico de barras
      const monthlyStats = [];
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentYear = currentDate.getFullYear();
      
      // Processa todos os meses do ano atual
      for (let month = 0; month < 12; month++) {
        // Conta produtos criados no mês
        const monthCount = products.filter((product: Product) => {
          if (!product?.createdAt) return false;
          try {
            const createdAt = new Date(product.createdAt);
            return createdAt.getMonth() === month && 
                   createdAt.getFullYear() === currentYear;
          } catch (error) {
            console.error('[Home] Erro ao processar data de criação:', error);
            return false;
          }
        }).length;
        
        monthlyStats.push({
          x: monthNames[month],
          y: monthCount
        });
      }

      console.log('[Home] Dados mensais calculados:', monthlyStats);
      setMonthlyData(monthlyStats);

    } catch (error) {
      console.error('[Home] Erro ao calcular estatísticas:', error);
      setStats({
        total: 0,
        expiring: 0,
        expired: 0,
        valid: 0
      });
      setMonthlyData([]);
    }
  }, []);

  // Função para carregar os dados
  const loadData = useCallback(async () => {
    console.log('[Home] Iniciando carregamento de dados...');
    setIsLoading(true);
    try {
      await calculateStats();
    } catch (error) {
      console.error('[Home] Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateStats]);

  // Efeito para carregar dados quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      console.log('[Home] Tela recebeu foco');
      loadData();
    }, [loadData])
  );

  // Efeito para escutar eventos de atualização
  useEffect(() => {
    console.log('[Home] Configurando listener de eventos...');
    const unsubscribe = eventEmitter.subscribe(PRODUCT_EVENTS.UPDATED, () => {
      console.log('[Home] Evento de atualização recebido');
      loadData();
    });

    return () => {
      console.log('[Home] Removendo listener de eventos');
      unsubscribe();
    };
  }, [loadData]);

  // Dados para o gráfico de pizza
  const pieChartData = useMemo(() => {
    const data = [
      { x: 'Em dia', y: stats.valid, color: '#4CAF50' },
      { x: 'A vencer', y: stats.expiring, color: '#FFA726' },
      { x: 'Vencidos', y: stats.expired, color: '#EF5350' }
    ].filter(item => item.y > 0);

    console.log('[Home] Dados do gráfico de pizza:', data);
    return data;
  }, [stats]);

  // Dados para o gráfico de barras
  const barChartData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    
    return monthlyData.map((item, index) => ({
      ...item,
      // Destacar o mês atual com uma cor diferente
      color: index === currentMonth ? '#2196F3' : isDark ? '#64B5F6' : '#90CAF9'
    }));
  }, [monthlyData, isDark]);
    
    return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={{ backgroundColor: isDark ? '#000' : '#fff' }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadData}
            colors={['#2196F3']}
            tintColor={isDark ? '#fff' : '#2196F3'}
          />
        }
      >
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              Controle de Validade
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Visão geral dos seus produtos
            </ThemedText>
          </View>

          {/* Cards de Estatísticas */}
          <View style={styles.statsContainer}>
            <Pressable 
              style={[styles.statsCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
              onPress={() => router.push('/products')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="cube" size={24} color="#2196F3" />
              </View>
              <ThemedText style={styles.statsNumber}>{stats.total}</ThemedText>
              <ThemedText style={styles.statsLabel}>Total de Produtos</ThemedText>
            </Pressable>

            <Pressable 
              style={[styles.statsCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
              onPress={() => router.push('/expiring')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="warning" size={24} color="#FFA726" />
              </View>
              <ThemedText style={styles.statsNumber}>{stats.expiring}</ThemedText>
              <ThemedText style={styles.statsLabel}>A Vencer</ThemedText>
            </Pressable>

            <Pressable 
              style={[styles.statsCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
              onPress={() => router.push('/expired')}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="alert-circle" size={24} color="#EF5350" />
              </View>
              <ThemedText style={styles.statsNumber}>{stats.expired}</ThemedText>
              <ThemedText style={styles.statsLabel}>Vencidos</ThemedText>
            </Pressable>
          </View>

          {/* Gráfico de Pizza */}
          <View style={[styles.chartCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
            <View style={[styles.chartTitleContainer, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <ThemedText style={styles.chartTitle}>Distribuição dos Produtos</ThemedText>
            </View>
            {stats.total > 0 ? (
              <SimpleDonutChart
                data={pieChartData}
                size={screenWidth - 80}
                isDark={isDark}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Ionicons name="pie-chart-outline" size={48} color={isDark ? '#333' : '#ccc'} />
                <ThemedText style={styles.emptyChartText}>Nenhum produto cadastrado</ThemedText>
              </View>
            )}
          </View>

          {/* Gráfico de Barras */}
          <View style={[styles.chartCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
            <View style={[styles.chartTitleContainer, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <ThemedText style={styles.chartTitle}>Produtos Cadastrados por Mês</ThemedText>
            </View>
            <SimpleBarChart
              data={barChartData}
              width={screenWidth - 48}
              height={220}
              isDark={isDark}
            />
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
              onPress={() => router.push('/register')}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Novo Produto</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => router.push('/products')}
            >
              <Ionicons name="list" size={24} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Ver Todos</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    paddingTop: 8,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  chartCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
  },
  chartTitleContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyChart: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    marginTop: -4,
    width: '100%',
  },
  chartLabel: {
    fontSize: 12,
    color: '#888',
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: -24,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  }
}); 