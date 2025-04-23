import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { RootTabScreenProps } from '../types/navigation';

export default function RegisterScreen({ navigation: _navigation }: RootTabScreenProps<'Register'>) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Cadastrar Novo Produto</Text>
      {/* TODO: Add product registration form */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
}); 