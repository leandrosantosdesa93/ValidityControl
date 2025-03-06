const fs = require('fs');
const path = require('path');

// Ler o arquivo
const filePath = path.join(__dirname, 'app', 'products.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Extrair a seção do renderHeader que contém o botão de compartilhamento
let matches = content.match(/function renderHeader\(\) \{[\s\S]*?return[\s\S]*?\}/);

if (matches) {
  console.log('Encontrou a função renderHeader:');
  
  // Procurar por padrões específicos que podem causar o erro
  const headerFunc = matches[0];
  
  // Procurar o botão de compartilhamento
  const shareButtonMatch = headerFunc.match(/\{filteredProducts\.length > 0 && \([\s\S]*?<Pressable[\s\S]*?<\/Pressable>[\s\S]*?\)\}/);
  
  if (shareButtonMatch) {
    console.log('\nBotão de compartilhamento encontrado:');
    console.log(shareButtonMatch[0]);
    
    // Verificar a estrutura dos parênteses
    const openParens = (shareButtonMatch[0].match(/\(/g) || []).length;
    const closeParens = (shareButtonMatch[0].match(/\)/g) || []).length;
    
    console.log(`\nParênteses de abertura: ${openParens}`);
    console.log(`Parênteses de fechamento: ${closeParens}`);
    
    if (openParens !== closeParens) {
      console.log('\nALERTA: Desbalanceamento de parênteses!');
    }
  } else {
    console.log('\nBotão de compartilhamento não encontrado com o padrão esperado');
    
    // Tentar encontrar qualquer trecho que mencione filteredProducts.length
    const anyFilteredProducts = headerFunc.match(/filteredProducts\.length[\s\S]*?}/g);
    if (anyFilteredProducts) {
      console.log('\nMenções a filteredProducts.length:');
      console.log(anyFilteredProducts.join('\n'));
    }
  }
  
  // Procurar por renderizações de texto sem componente Text
  const directStringRender = headerFunc.match(/return [^<]*['"][^'"]*['"];/g);
  if (directStringRender) {
    console.log('\nPossível renderização direta de string:');
    console.log(directStringRender.join('\n'));
  }
} else {
  console.log('Não foi possível encontrar a função renderHeader');
}

// Não modificamos o arquivo, apenas analisamos 