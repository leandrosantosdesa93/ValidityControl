import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  | 'help'
  | 'cog'
>;

export type RootStackParamList = {
  Products: undefined;
  Add: { productId?: string };
  Expiring: undefined;
  Expired: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>; 