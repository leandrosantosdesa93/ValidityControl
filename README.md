# ValidityControl

Aplicativo para controle de validade de produtos, desenvolvido com React Native e Expo.

## Funcionalidades

- Cadastro de produtos com código, descrição, quantidade e data de validade
- Captura de fotos dos produtos
- Visualização de produtos por status (válidos, a vencer, vencidos)
- Compartilhamento de listas de produtos
- Suporte a tema claro/escuro
- Busca por código, descrição ou data

## Melhorias Implementadas

### 1. Componentes Reutilizáveis

Foram criados componentes compartilhados para reduzir a duplicação de código:

- `ProductListHeader`: Cabeçalho padronizado para as listas de produtos
- `ProductCard`: Card de produto reutilizável em todas as telas
- `EmptyProductList`: Componente para exibir mensagem quando não há produtos

### 2. Gerenciamento de Estado Centralizado

- Implementação de uma store centralizada com Zustand para gerenciar produtos
- Funções para adicionar, atualizar e excluir produtos
- Cálculo automático de estatísticas
- Persistência de dados com AsyncStorage

### 3. Utilitários

- `expiration.ts`: Funções para cálculo de informações de expiração
- `errorHandler.ts`: Sistema de tratamento e log de erros

### 4. Testes Automatizados

- Testes unitários para funções de expiração
- Testes de componentes com React Testing Library
- Configuração do Jest para cobertura de código

## Estrutura do Projeto

```
ValidityControl/
├── app/                  # Telas principais
│   ├── expired.tsx       # Tela de produtos vencidos
│   ├── expiring.tsx      # Tela de produtos a vencer
│   ├── index.tsx         # Tela inicial
│   ├── products.tsx      # Tela de todos os produtos
│   └── register.tsx      # Tela de cadastro de produtos
├── components/           # Componentes reutilizáveis
│   ├── EmptyProductList.tsx
│   ├── ProductCard.tsx
│   ├── ProductListHeader.tsx
│   └── ThemedText.tsx
├── store/                # Gerenciamento de estado
│   └── productsStore.ts
├── utils/                # Utilitários
│   ├── errorHandler.ts
│   └── expiration.ts
└── __tests__/            # Testes automatizados
    ├── expiration.test.ts
    └── ProductCard.test.tsx
```

## Como Executar

1. Instale as dependências:
   ```
   npm install
   ```

2. Inicie o aplicativo:
   ```
   npx expo start
   ```

3. Execute os testes:
   ```
   npm test
   ```

## Recomendações para Desenvolvimento Futuro

1. **Melhorar a Cobertura de Testes**
   - Adicionar testes para todos os componentes
   - Implementar testes de integração

2. **Otimização de Performance**
   - Implementar virtualização para listas longas
   - Otimizar renderização com memo e useCallback

3. **Recursos Adicionais**
   - Notificações para produtos próximos do vencimento
   - Exportação de dados em diferentes formatos
   - Categorização de produtos

4. **Acessibilidade**
   - Melhorar suporte a leitores de tela
   - Implementar navegação por teclado
   - Aumentar contraste para melhor visibilidade
