import { Ionicons } from '@expo/vector-icons';
import { NavigatorScreenParams } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type TabIconName = Extract<IconName, 
  | 'list' 
  | 'list-outline'
  | 'add-circle'
  | 'add-circle-outline'
  | 'warning'
  | 'warning-outline'
  | 'alert-circle'
  | 'alert-circle-outline'
  | 'home'
  | 'home-outline'
>;

// Tipos unificados para navegação
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  Products: undefined;
  Add: { productId?: string };
  Expiring: undefined;
  Expired: undefined;
  // Nomes de rotas do arquivo original src/navigation/types.ts
  ProductList: undefined;
  AddProduct: { productId?: string };
  ExpiringProducts: undefined;
  ExpiredProducts: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Products: undefined;
  Register: undefined;
  Expiring: undefined;
  Expired: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type RootTabScreenProps<T extends keyof RootTabParamList> = BottomTabScreenProps<
  RootTabParamList,
  T
>;

// Constantes de rotas (migradas do arquivo routes.ts)
export const ROUTES = {
  PRODUCT_LIST: 'ProductList',
  ADD_PRODUCT: 'AddProduct',
  EXPIRING_PRODUCTS: 'ExpiringProducts',
  EXPIRED_PRODUCTS: 'ExpiredProducts',
} as const; 