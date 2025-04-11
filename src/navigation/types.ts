import { NavigatorScreenParams } from '@react-navigation/native';
import { ROUTES } from './routes';

export type RootStackParamList = {
  Root: NavigatorScreenParams<TabParamList>;
};

export type TabParamList = {
  [ROUTES.HOME]: undefined;
  [ROUTES.PRODUCTS]: undefined;
  [ROUTES.REGISTER]: undefined;
  [ROUTES.EXPIRING]: undefined;
  [ROUTES.EXPIRED]: undefined;
}; 