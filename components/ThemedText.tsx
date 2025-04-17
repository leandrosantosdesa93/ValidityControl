import { Text, TextStyle } from 'react-native';
import { useColorScheme } from '@hooks/useColorScheme';

type ThemedTextProps = Text['props'] & {
  type?: 'title' | 'subtitle' | 'body' | 'caption' | 'defaultSemiBold' | 'link';
};

export function ThemedText({ style, type = 'body', ...props }: ThemedTextProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getTextStyle = (): TextStyle => {
    switch (type) {
      case 'title':
        return {
          fontSize: 24,
          fontWeight: 'bold',
        };
      case 'subtitle':
        return {
          fontSize: 18,
          fontWeight: '600' as TextStyle['fontWeight'],
        };
      case 'caption':
        return {
          fontSize: 12,
          opacity: 0.7,
        };
      case 'defaultSemiBold':
        return {
          fontSize: 16,
          fontWeight: '600' as TextStyle['fontWeight'],
        };
      case 'link':
        return {
          fontSize: 16,
          color: isDark ? '#2196F3' : '#1976D2',
          textDecorationLine: 'underline',
        };
      default:
        return {
          fontSize: 16,
        };
    }
  };

  return (
    <Text
      {...props}
      style={[
        {
          color: isDark ? '#fff' : '#000',
        },
        getTextStyle(),
        style,
      ]}
    />
  );
}
