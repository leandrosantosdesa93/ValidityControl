import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { saveProduct, updateProduct, getProducts, deleteProduct } from '@/services/ProductService';
import { useColorScheme } from '@hooks/useColorScheme';
import { ThemedText } from '@components/ThemedText';
import { Product } from '@/types/Product';
import { NavigationService } from '@/navigation/navigationService';

// Interface para dados do formulário que corresponde ao tipo esperado por saveProduct
type ProductFormData = {
  description: string;
  expirationDate: Date;
  quantity: number;
  photoUri?: string;
  code?: string;
};

// Interface para mensagens de erro
interface FormErrors {
  description?: string;
  expirationDate?: string;
  quantity?: string;
  code?: string;
}

// Função que tenta fazer a navegação de maneira segura com fallback para o router do Expo
function safeNavigate(route: string | object, params?: any) {
  try {
    // Tenta usar o NavigationService primeiro
    if (NavigationService.isReady()) {
      console.log(`[Navigation] Navegando para ${typeof route === 'string' ? route : 'objeto'} via NavigationService`);
      
      // Se for um objeto (como um href do Expo Router), extraímos o caminho
      if (typeof route === 'object' && (route as any).pathname) {
        const routeObj = route as any;
        let navRoute = routeObj.pathname;
        
        // Conversão de rotas
        if (navRoute === '/products') {
          NavigationService.navigate('Products', routeObj.params || params);
        } else {
          NavigationService.navigate(navRoute as any, routeObj.params || params);
        }
      } else if (typeof route === 'string') {
        // Converte entre nomes de rotas se necessário
        let navRoute = route;
        if (route === '/products') navRoute = 'Products';
        
        NavigationService.navigate(navRoute as any, params);
      }
    } else {
      // Fallback para o router do Expo
      console.log(`[Navigation] Navegando para ${typeof route === 'string' ? route : 'objeto'} via Expo Router`);
      router.push(route as any);
    }
  } catch (error) {
    console.error('[Navigation] Erro ao navegar:', error);
    // Se falhar, tenta o router do Expo como última opção
    try {
      router.push(route as any);
    } catch (routerError) {
      console.error('[Navigation] Também falhou com router:', routerError);
    }
  }
}

// Função auxiliar para voltar na navegação
function safeGoBack() {
  try {
    if (NavigationService.isReady()) {
      console.log('[Navigation] Voltando via NavigationService');
      NavigationService.goBack();
    } else {
      console.log('[Navigation] Voltando via Expo Router');
      router.back();
    }
  } catch (error) {
    console.error('[Navigation] Erro ao voltar:', error);
    try {
      router.back();
    } catch (routerError) {
      console.error('[Navigation] Também falhou com router.back:', routerError);
      // Como último recurso, tenta navegar para a tela de produtos
      router.push('/products');
    }
  }
}

export default function Register() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [productCode, setProductCode] = useState<string | null>(null);
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Chave para forçar atualização
  const [refreshing, setRefreshing] = useState(false); // Estado para controlar o pull-to-refresh
  
  // Estado para controlar se houve alterações nos dados
  const [hasDataChanged, setHasDataChanged] = useState<boolean>(false);
  
  // Obter parâmetros da rota
  const params = useLocalSearchParams<{ productCode?: string, timestamp?: string }>();
  
  // Estado do formulário
  const [formData, setFormData] = useState<ProductFormData>({
    description: '',
    expirationDate: new Date(),
    quantity: 1,
  });
  
  // Estado de erros
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Estado para os 4 últimos dígitos do código
  const [lastFourDigits, setLastFourDigits] = useState<string>('');
  
  // Função para obter um produto específico pelo código
  const getProductByCode = async (code: string): Promise<Product | null> => {
    try {
      // Recuperar todos os produtos
      const products = await getProducts();
      
      // Encontrar o produto específico
      const product = products.find(p => p.code === code);
      
      if (product) {
        return product;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar produto por código:', error);
      return null;
    }
  };
  
  // Resetar o formulário
  const resetForm = useCallback(() => {
    setFormData({
      description: '',
      expirationDate: new Date(),
      quantity: 1,
    });
    setErrors({});
    setIsEditMode(false);
    setProductCode(null);
    setOriginalProduct(null);
    setLastFourDigits(''); // Limpar os últimos 4 dígitos
    setHasDataChanged(false);
  }, []);
  
  // Carregar dados do produto para edição
  useEffect(() => {
    async function loadProductData() {
      try {
        setIsLoading(true);
        if (params.productCode) {
          console.log(`Carregando produto para edição: ${params.productCode} (timestamp: ${params.timestamp || 'none'}, refreshKey: ${refreshKey})`);
          
          const allProducts = await getProducts();
          
          const product = allProducts.find(p => p.code === params.productCode);
          
          if (product) {
            // Converte a data de string para objeto Date
            const expirationDate = product.expirationDate
              ? new Date(product.expirationDate)
              : new Date();
            
            // Define os dados do formulário
            setFormData({
              description: product.description,
              expirationDate,
              quantity: product.quantity,
              photoUri: product.photoUri,
              code: product.code // Adicionamos o código aqui
            });
            
            // Extrai os últimos 4 dígitos do código do produto (PROD-XXXX)
            if (product.code && product.code.includes('-')) {
              const codeDigits = product.code.split('-')[1];
              console.log('Extraindo código do produto para edição:', product.code, '→ últimos 4 dígitos:', codeDigits);
              setLastFourDigits(codeDigits);
            } else {
              console.warn('Formato de código inválido:', product.code);
            }
            
            setOriginalProduct(product);
            setProductCode(product.code);
            setIsEditMode(true);
          } else {
            console.error('Produto não encontrado:', params.productCode);
            Alert.alert('Erro', 'Produto não encontrado');
            safeGoBack();
          }
        } else {
          // Lógica para novo produto
          resetForm();
        }
      } catch (error) {
        console.error('Erro ao carregar dados do produto:', error);
        Alert.alert('Erro', 'Falha ao carregar dados do produto');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadProductData();
    
    // Incrementar a chave de atualização para forçar recarregamento em futuras edições
    setRefreshKey(prev => prev + 1);
  }, [params.productCode, params.timestamp, resetForm, refreshKey]);
  
  // Função para validar o formulário
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    // Validar descrição
    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    }
    
    // Validar data de validade
    if (!formData.expirationDate) {
      newErrors.expirationDate = 'Data de validade é obrigatória';
    }
    
    // Validar quantidade
    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantidade deve ser maior que zero';
      // Definir quantidade mínima para 1 se o valor for zero ou negativo
      setFormData(prev => ({ ...prev, quantity: 1 }));
    }
    
    // Validar código do produto (apenas no modo de cadastro)
    if (!isEditMode && !lastFourDigits) {
      newErrors.code = 'Código do produto é obrigatório';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Função para selecionar imagem
  const selectImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos de permissão para acessar suas fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData(prev => ({
          ...prev,
          photoUri: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };
  
  // Função para tirar foto
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos de permissão para acessar sua câmera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData(prev => ({
          ...prev,
          photoUri: result.assets[0].uri
        }));
      }
    } catch (error) {
      console.error('Erro ao tirar foto:', error);
      Alert.alert('Erro', 'Não foi possível tirar a foto');
    }
  };
  
  // Tratador de mudança de data
  const handleDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (date) {
      console.log('Data selecionada original:', date);
      
      // Preservar a data exatamente como foi selecionada
      setFormData(prev => ({
        ...prev,
        expirationDate: date
      }));
      
      console.log('Data armazenada no formData:', date);
    }
  };
  
  // Função para verificar se os dados foram alterados
  const checkForChanges = useCallback(() => {
    if (!isEditMode || !originalProduct) {
      return true; // Em modo de criação, sempre retorna true
    }

    // Converter a data original para comparação
    let originalDate: Date;
    if (typeof originalProduct.expirationDate === 'string') {
      const dateStr = originalProduct.expirationDate as string;
      const [year, month, day] = dateStr.split('-').map(Number);
      originalDate = new Date(year, month-1, day, 12, 0, 0);
    } else {
      originalDate = new Date(originalProduct.expirationDate);
    }
    
    // Normalizar as datas para comparação (ignorando horas, minutos, segundos)
    const formDateStr = format(formData.expirationDate, 'yyyy-MM-dd');
    const origDateStr = format(originalDate, 'yyyy-MM-dd');
    
    // Comparar cada campo para detectar alterações
    const originalPhotoUri = originalProduct.photoUri || undefined;
    const currentPhotoUri = formData.photoUri || undefined;
    
    const changed = 
      formData.description !== originalProduct.description ||
      formDateStr !== origDateStr ||
      formData.quantity !== originalProduct.quantity ||
      originalPhotoUri !== currentPhotoUri;
    
    setHasDataChanged(changed);
    return changed;
  }, [formData, originalProduct, isEditMode]);

  // Verificar mudanças sempre que os dados do formulário mudarem
  useEffect(() => {
    if (isEditMode && originalProduct) {
      checkForChanges();
    }
  }, [formData, checkForChanges, isEditMode, originalProduct]);
  
  // Verificar se os dados foram alterados quando o formulário ou o código mudam
  // Esta verificação inclui alterações no código do produto (lastFourDigits)
  useEffect(() => {
    if (isEditMode && originalProduct) {
      // Verificar alteração no código do produto
      const originalCode = originalProduct.code ? originalProduct.code.split('-')[1] : '';
      const codeChanged = lastFourDigits !== originalCode;
      
      const descriptionChanged = formData.description !== originalProduct.description;
      
      // Verificar alteração na data
      let dateChanged = false;
      if (typeof originalProduct.expirationDate === 'string') {
        const dateStr = originalProduct.expirationDate as string;
        const [year, month, day] = dateStr.split('-').map(Number);
        const originalDate = new Date(year, month - 1, day);
        const formDateStr = format(formData.expirationDate, 'yyyy-MM-dd');
        const originalDateStr = format(originalDate, 'yyyy-MM-dd');
        dateChanged = formDateStr !== originalDateStr;
      } else {
        const originalDate = new Date(originalProduct.expirationDate);
        const formDateStr = format(formData.expirationDate, 'yyyy-MM-dd');
        const originalDateStr = format(originalDate, 'yyyy-MM-dd');
        dateChanged = formDateStr !== originalDateStr;
      }
      
      const quantityChanged = formData.quantity !== originalProduct.quantity;
      const photoChanged = formData.photoUri !== originalProduct.photoUri;
      
      // Verificar se algum dado foi alterado
      const changed = codeChanged || descriptionChanged || dateChanged || quantityChanged || photoChanged;
      
      console.log('Verificação de alterações:', {
        codeChanged,
        descriptionChanged,
        dateChanged,
        quantityChanged,
        photoChanged,
        hasChanged: changed
      });
      
      setHasDataChanged(changed);
    }
  }, [isEditMode, originalProduct, formData, lastFourDigits]);
  
  // Função para salvar ou atualizar o produto
  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll para o primeiro campo com erro
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (isEditMode && productCode && originalProduct) {
        console.log('Atualizando produto existente:', productCode);
        
        // Preparar dados do produto para atualização
        const updatedProduct = { ...originalProduct };
        updatedProduct.description = formData.description;
        updatedProduct.expirationDate = formData.expirationDate;
        updatedProduct.quantity = formData.quantity;
        updatedProduct.updatedAt = new Date(); // Atualizar a data de edição
        
        // Se o código foi alterado, verificar se o novo código já existe
        let finalCode = productCode;
        if (lastFourDigits && `PROD-${lastFourDigits}` !== productCode) {
          // Código foi alterado
          const newCode = `PROD-${lastFourDigits}`;
          console.log(`Código do produto alterado de ${productCode} para ${newCode}`);
          
          // Verificar se o novo código já existe
          const existingProduct = await getProductByCode(newCode);
          if (existingProduct && existingProduct.code !== productCode) {
            console.log('Código já existe, carregando dados do outro produto:', newCode);
            
            // Carregar os dados do produto existente
            setOriginalProduct(existingProduct);
            setProductCode(existingProduct.code);
            
            // Atualizar o formulário com os dados do produto existente
            setFormData({
              description: existingProduct.description,
              expirationDate: existingProduct.expirationDate instanceof Date 
                ? existingProduct.expirationDate 
                : new Date(existingProduct.expirationDate as string),
              quantity: existingProduct.quantity,
              photoUri: existingProduct.photoUri
            });
            
            // Limpar erros
            setErrors({});
            
            // Informar o usuário
            Alert.alert(
              'Produto alterado',
              `Os dados do produto ${existingProduct.code} foram carregados`,
              [{ text: 'OK' }]
            );
            
            setIsLoading(false);
            return;
          }
          
          finalCode = newCode;
        }
        
        // Atualizar o código do produto se foi alterado
        updatedProduct.code = finalCode;
        
        if (formData.photoUri) {
          updatedProduct.photoUri = formData.photoUri;
        }
        
        console.log('Enviando produto atualizado:', JSON.stringify(updatedProduct, null, 2));
        
        // Se o código foi alterado, precisamos usar uma abordagem diferente
        if (finalCode !== productCode) {
          console.log('Código foi alterado, usando procedimento especial para atualização');
          
          // 1. Obter todos os dados do produto original
          const originalProductCopy = await getProductByCode(productCode);
          if (!originalProductCopy) {
            console.error('Produto original não encontrado', productCode);
            setIsLoading(false);
            Alert.alert('Erro', 'Não foi possível encontrar o produto original.');
            return;
          }
          
          // 2. Deletar o produto original
          await deleteProduct(productCode);
          console.log('Produto original deletado:', productCode);
          
          // 3. Criar um novo produto com o novo código e todos os dados atualizados
          const newProduct: Product = {
            ...originalProductCopy,
            ...updatedProduct,
            code: finalCode,
            updatedAt: new Date()
          };
          
          // 4. Salvar o novo produto
          const savedProduct = await saveProduct(newProduct);
          console.log('Novo produto criado com código atualizado:', savedProduct.code);
          
          // Atualizar o código do produto na tela
          setProductCode(savedProduct.code);
          
          // Mostrar mensagem de sucesso
          Alert.alert(
            'Produto Atualizado',
            `O produto foi atualizado com sucesso. Código: ${savedProduct.code}`,
            [{ text: 'OK', onPress: () => {
              // Limpar formulário
              setFormData({
                description: '',
                expirationDate: new Date(),
                quantity: 1,
                photoUri: undefined
              });
              
              // Limpar erros
              setErrors({});
              
              // Limpar os últimos dígitos do código
              setLastFourDigits('');
              
              // Fechar datepicker
              setShowDatePicker(false);
              
              // Resetar modo de edição
              setIsEditMode(false);
              setProductCode(null);
              setOriginalProduct(null);
              
              // Redirecionar para a tela de produtos após editar
              safeNavigate('/products');
            }}]
          );
        } else {
          // Código não mudou, podemos usar updateProduct normalmente
          await updateProduct(updatedProduct);
          console.log('Produto atualizado com sucesso (sem alteração de código):', updatedProduct.code);
          
          // Mostrar mensagem de sucesso e redirecionar para a tela de produtos
          Alert.alert(
            'Produto Atualizado',
            `O produto foi atualizado com sucesso. Código: ${updatedProduct.code}`,
            [{ text: 'OK', onPress: () => {
              // Limpar formulário
              setFormData({
                description: '',
                expirationDate: new Date(),
                quantity: 1,
                photoUri: undefined
              });
              
              // Limpar erros
              setErrors({});
              
              // Limpar os últimos dígitos do código
              setLastFourDigits('');
              
              // Fechar datepicker
              setShowDatePicker(false);
              
              // Resetar modo de edição
              setIsEditMode(false);
              setProductCode(null);
              setOriginalProduct(null);
              
              // Redirecionar para a tela de produtos após editar
              safeNavigate('/products');
            }}]
          );
        }
      } else {
        // Modo de criação - salvar novo produto
        console.log('Salvando novo produto');
        
        // Verificar se o código já existe caso um código personalizado seja fornecido
        if (lastFourDigits && lastFourDigits.trim() !== '') {
          const customCode = `PROD-${lastFourDigits.trim()}`;
          console.log('Verificando se o código personalizado já existe:', customCode);
          
          const existingProduct = await getProductByCode(customCode);
          if (existingProduct) {
            console.log('Produto encontrado, carregando dados:', existingProduct);
            
            // Carregar os dados do produto existente
            setOriginalProduct(existingProduct);
            setProductCode(existingProduct.code);
            
            // Carregar os dados no formulário
            setFormData({
              description: existingProduct.description,
              expirationDate: existingProduct.expirationDate instanceof Date 
                ? existingProduct.expirationDate 
                : new Date(existingProduct.expirationDate as string),
              quantity: existingProduct.quantity,
              photoUri: existingProduct.photoUri
            });
            
            // Ativar modo de edição
            setIsEditMode(true);
            
            // Exibir mensagem informativa
            Alert.alert(
              'Produto carregado',
              `Dados do produto ${existingProduct.code} foram carregados para edição`,
              [{ text: 'OK' }]
            );
            
            setIsLoading(false);
            return;
          }
        }
        
        // Preparar os dados incluindo o código do produto
        const finalCode = `PROD-${lastFourDigits.trim()}`;
        const formDataWithCode = {
          ...formData,
          code: finalCode
        };
        
        console.log('Código do produto a ser salvo:', finalCode);
        console.log('FormData completo antes de enviar:', JSON.stringify(formDataWithCode, null, 2));
        
        // Verificar se o código está sendo incluído no objeto
        if (formDataWithCode.code !== finalCode) {
          console.error('ERRO: O código não foi incluído corretamente no objeto formDataWithCode');
        }
        
        const savedProduct = await saveProduct(formDataWithCode);
        console.log('Produto salvo com sucesso. Código retornado:', savedProduct.code);
        console.log('Produto completo retornado:', JSON.stringify(savedProduct, null, 2));
      
      // Limpar formulário após salvar
      setFormData({
        description: '',
        expirationDate: new Date(),
        quantity: 1,
          photoUri: undefined
        });
        
        // Limpar os últimos dígitos - garantir que este campo está sendo limpo
        setLastFourDigits('');
        console.log('Código limpo após salvar, lastFourDigits =', lastFourDigits);
        
        // Mostrar alerta antes de navegar
        Alert.alert(
          'Sucesso',
          'Produto cadastrado com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('Formulário limpo para cadastrar um novo produto');
                // Permanecer na tela de cadastro
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erro ao salvar/atualizar produto:', error);
      Alert.alert('Erro', `Não foi possível ${isEditMode ? 'atualizar' : 'cadastrar'} o produto: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
      console.log('Processo de salvamento finalizado');
    }
  };
  
  // Função de pull-to-refresh para limpar o formulário e voltar ao modo de cadastro
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    console.log('[Register] Pull-to-refresh acionado, limpando formulário e voltando ao modo de cadastro');
    
    // Limpar formulário completamente
    setFormData({
      description: '',
      expirationDate: new Date(),
      quantity: 1,
      photoUri: undefined
    });
    
    // Limpar erros
    setErrors({});
    
    // Limpar os últimos dígitos do código (assegura que este campo está sendo limpo)
    setLastFourDigits('');
    
    // Fechar qualquer datepicker aberto
    setShowDatePicker(false);
    
    // Sempre voltar para o modo de cadastro
    setIsEditMode(false);
    setProductCode(null);
    setOriginalProduct(null);
    
    // Mostrar feedback visual por um curto período
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const handleCodeChange = (digitsOnly: string) => {
    setLastFourDigits(digitsOnly);
    
    // Limpar erros quando o usuário digita
    setErrors(prev => ({ ...prev, code: undefined }));
  };

  // Nova função para verificar código existente
  const checkExistingCode = async (digits: string) => {
    if (!isEditMode && digits.length === 4) {
      try {
        setIsLoading(true);
        const fullCode = `PROD-${digits}`;
        console.log(`Verificando se o código ${fullCode} já existe...`);
        
        const existingProduct = await getProductByCode(fullCode);
        
        if (existingProduct) {
          console.log(`Produto encontrado com o código ${fullCode}. Carregando dados para edição...`);
          
          // Converter a data de string para objeto Date
          const expirationDate = existingProduct.expirationDate
            ? new Date(existingProduct.expirationDate)
            : new Date();
          
          // Define os dados do formulário
          setFormData({
            description: existingProduct.description,
            expirationDate,
            quantity: existingProduct.quantity,
            photoUri: existingProduct.photoUri,
            code: existingProduct.code
          });
          
          // Garantir que o código é exibido corretamente
          if (existingProduct.code && existingProduct.code.includes('-')) {
            const codeDigits = existingProduct.code.split('-')[1];
            console.log('Extraindo código do produto encontrado:', existingProduct.code, '→ últimos 4 dígitos:', codeDigits);
            setLastFourDigits(codeDigits);
          }
          
          setOriginalProduct(existingProduct);
          setProductCode(existingProduct.code);
          setIsEditMode(true);
          
          // Feedback visual para o usuário
          Alert.alert(
            'Produto encontrado',
            `Dados do produto ${fullCode} carregados para atualização`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Erro ao verificar código existente:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: isDark ? '#121212' : '#f5f5f5' }
        ]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']} // Cores para Android
            tintColor={isDark ? '#145A32' : '#4CAF50'} // Cor para iOS
            title="Puxe para limpar" // Texto apenas no iOS
            titleColor={isDark ? '#BBBBBB' : '#666666'} // Cor do texto no iOS
            progressBackgroundColor={isDark ? '#1e1e1e' : '#fff'} // Fundo do indicador no Android
          />
        }
      >
        <View>
          <ThemedText style={styles.title} type="title">
            {isEditMode ? 'Editar Produto' : 'Cadastrar Produto'}
          </ThemedText>
          
          {/* Imagem */}
          <View style={styles.field}>
            <ThemedText style={styles.label}>Imagem</ThemedText>
          <View style={styles.imageSection}>
            {formData.photoUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: formData.photoUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setFormData(prev => ({ ...prev, photoUri: undefined }))}
                >
                    <Ionicons name="close-circle" size={30} color="#e53935" />
                </TouchableOpacity>
              </View>
            ) : (
                <View style={[
                  styles.noImageContainer,
                  { backgroundColor: isDark ? '#1e1e1e' : '#eee' }
                ]}>
                  <Ionicons name="image" size={48} color={isDark ? '#555' : '#999'} />
                  <ThemedText style={[
                    styles.noImageText,
                    { color: isDark ? '#888' : '#999' }
                  ]}>
                    Nenhuma imagem selecionada
                  </ThemedText>
              </View>
            )}
            <View style={styles.imageButtons}>
                <TouchableOpacity
                  style={[styles.imageButton, { 
                    backgroundColor: isDark ? '#1565C0' : '#2196F3' // Azul para Galeria
                  }]}
                  onPress={selectImage}
                >
                  <Ionicons name="images" size={22} color="#fff" />
                <Text style={styles.imageButtonText}>Galeria</Text>
              </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageButton, { 
                    backgroundColor: '#4CAF50' // Mesma cor dos botões de quantidade
                  }]}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={22} color="#fff" />
                <Text style={styles.imageButtonText}>Câmera</Text>
              </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Código do Produto (4 últimos dígitos) */}
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Código do Produto (4 dígitos)</ThemedText>
            <View style={styles.codeInputContainer}>
              <View style={[styles.prefixContainer, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                <ThemedText style={[styles.prefix, { color: isDark ? '#fff' : '#333' }]}>PROD-</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.codeInput,
                  errors.code && styles.inputError,
                  { 
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                    borderColor: isDark ? '#333' : '#ddd',
                    color: isDark ? '#fff' : '#333'
                  }
                ]}
                placeholder="0000"
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={lastFourDigits}
                onChangeText={handleCodeChange}
                keyboardType="numeric"
                maxLength={4}
                onEndEditing={() => checkExistingCode(lastFourDigits)}
                editable={true} // Permitir edição do código mesmo em modo de edição
              />
            </View>
            {isEditMode && (
              <Text style={{ 
                fontSize: 12, 
                color: isDark ? '#aaa' : '#666', 
                marginTop: 4,
                fontStyle: 'italic' 
              }}>
                Editando produto com código atual: PROD-{lastFourDigits}
              </Text>
            )}
            {errors.code && <Text style={styles.errorText}>{errors.code}</Text>}
            <ThemedText style={styles.helperText}>
              Digite os 4 últimos dígitos do código do produto
            </ThemedText>
          </View>
          
          {/* Descrição */}
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Descrição</ThemedText>
            <TextInput
              style={[
                styles.input,
                errors.description && styles.inputError,
                { 
                  backgroundColor: isDark ? '#1e1e1e' : '#fff',
                  borderColor: isDark ? '#333' : '#ddd',
                  color: isDark ? '#fff' : '#333'
                }
              ]}
              placeholder="Digite a descrição do produto"
              placeholderTextColor={isDark ? '#888' : '#999'}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              maxLength={40} // Limitar a 30 caracteres
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
              <ThemedText style={{ fontSize: 12, color: isDark ? '#aaa' : '#666' }}>
                {formData.description.length}/40 caracteres
              </ThemedText>
            </View>
          </View>
          
          {/* Data de Validade e Quantidade na mesma linha */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {/* Data de Validade - 50% da largura */}
            <View style={[styles.formGroup, { width: '50%' }]}>
              <ThemedText style={styles.label}>Data de Validade</ThemedText>
            <TouchableOpacity
                style={[
                  styles.input,
                  errors.expirationDate && styles.inputError,
                  { 
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                    borderColor: isDark ? '#333' : '#ddd',
                    padding: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }
                ]}
              onPress={() => setShowDatePicker(true)}
            >
                <ThemedText>
                {format(formData.expirationDate, 'dd/MM/yyyy', { locale: ptBR })}
                </ThemedText>
                <Ionicons name="calendar" size={24} color={isDark ? '#ddd' : '#666'} />
            </TouchableOpacity>
            {errors.expirationDate && (
              <Text style={styles.errorText}>{errors.expirationDate}</Text>
            )}
          </View>
          
            {/* Quantidade - 45% da largura */}
            <View style={[styles.formGroup, { width: '45%' }]}>
              <ThemedText style={styles.label}>Quantidade</ThemedText>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                  style={[styles.quantityButton, { 
                    backgroundColor: isEditMode 
                      ? '#4CAF50' // Verde para edição
                      : (isDark ? '#1565C0' : '#2196F3') // Azul para cadastro
                  }]}
                  onPress={() => {
                    if (formData.quantity > 1) {
                      setFormData(prev => ({ ...prev, quantity: prev.quantity - 1 }));
                    }
                  }}
                >
                  <Ionicons name="remove" size={18} color="#fff" />
              </TouchableOpacity>
              
              <TextInput
                  style={[
                    styles.input, 
                    styles.quantityInput,
                    errors.quantity && styles.inputError,
                    { 
                      backgroundColor: isDark ? '#1e1e1e' : '#fff',
                      borderColor: isDark ? '#333' : '#ddd',
                      color: isDark ? '#fff' : '#333',
                      textAlign: 'center',
                      fontSize: 16,
                      minWidth: 50,
                      paddingHorizontal: 5
                    }
                  ]}
                keyboardType="numeric"
                  value={formData.quantity === 0 ? '' : formData.quantity.toString()}
                  maxLength={4}
                onChangeText={(text) => {
                    // Permitir apenas números
                    const digitsOnly = text.replace(/[^0-9]/g, '');
                    // Permitir campo vazio (para que o usuário possa apagar e digitar novamente)
                    const newValue = digitsOnly === '' ? 0 : parseInt(digitsOnly, 10);
                    setFormData(prev => ({ ...prev, quantity: newValue }));
                }}
              />
              
              <TouchableOpacity
                  style={[styles.quantityButton, { 
                    backgroundColor: isEditMode 
                      ? '#4CAF50' // Verde para edição
                      : (isDark ? '#1565C0' : '#2196F3') // Azul para cadastro
                  }]}
                onPress={() => setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
              >
                  <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
              </View>
              {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
            </View>
          </View>
          
          {/* Date Picker em modal */}
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={formData.expirationDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()} // Bloquear datas anteriores a hoje
            />
          )}
          
          {/* Botão de Cadastrar/Atualizar */}
          <TouchableOpacity
            style={[
              styles.submitButton, 
              ((isLoading || (isEditMode && !hasDataChanged)) && styles.disabledButton),
              { 
                backgroundColor: isEditMode 
                  ? (isDark ? '#1565C0' : '#2196F3') // Azul para edição
                  : '#4CAF50', // Verde para cadastro
              }
            ]}
            onPress={handleSubmit}
            disabled={isLoading || (isEditMode && !hasDataChanged)}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name={isEditMode ? "create-outline" : "save-outline"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Atualizar Produto' : 'Cadastrar Produto'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#e53935',
  },
  errorText: {
    color: '#e53935',
    marginTop: 4,
    fontSize: 14,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
  },
  imageSection: {
    marginBottom: 20,
  },
  noImageContainer: {
    height: 200,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  noImageText: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 200,
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageButton: {
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 0.48,
  },
  imageButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityButton: {
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  formGroup: {
    marginBottom: 16,
  },
  prefixContainer: {
    backgroundColor: '#666',
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    justifyContent: 'center',
  },
  prefix: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 