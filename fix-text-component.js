const fs = require('fs');
const path = require('path');

// Ler o arquivo
const filePath = path.join(__dirname, 'app', 'products.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Verificar se há expressões condicionais que possam estar retornando strings diretamente
// Geralmente acontece em expressões ternárias que retornam strings em algumas condições
// e componentes em outras

// Localizar o botão de compartilhamento
const shareButtonRegex = /\{filteredProducts\.length > 0 && \(\s*<Pressable/g;
if (!shareButtonRegex.test(content)) {
  console.log("Problemas com a estrutura do botão de compartilhamento.");
  
  // Tentar encontrar e corrigir a renderização condicional
  content = content.replace(
    /\{filteredProducts\.length > 0 && ([^}]+)\}/g, 
    '{filteredProducts.length > 0 && ($1)}'
  );
}

// 2. Verificar se há expressões ternárias retornando strings diretamente
// Por exemplo: {condition ? "string" : <Component>}
// Isso precisa ser: {condition ? <Text>string</Text> : <Component>}
content = content.replace(
  /\{([^{}]+) \? ['"]([^'"]+)['"] : ([^{}]+)\}/g,
  '{$1 ? <ThemedText>$2</ThemedText> : $3}'
);

content = content.replace(
  /\{([^{}]+) \? ([^{}]+) : ['"]([^'"]+)['"] \}/g,
  '{$1 ? $2 : <ThemedText>$3</ThemedText>}'
);

// Salvar o arquivo modificado
fs.writeFileSync(filePath, content, 'utf8');

console.log('Verificações e correções aplicadas com sucesso!'); 