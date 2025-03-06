import { View } from 'react-native';
import { useColorScheme } from '@hooks/useColorScheme';

export function ThemedView(props: View['props']) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: isDark ? '#000' : '#fff',
        },
        props.style,
      ]}
    />
  );
}
