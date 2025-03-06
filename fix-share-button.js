const fs = require('fs');
const path = require('path');

// Ler o arquivo
const filePath = path.join(__dirname, 'app', 'products.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Corrigir a duplicação da condição filteredProducts.length > 0
const duplicatedPattern = /\{filteredProducts\.length > 0 && \(\s*\{filteredProducts\.length > 0 && \(/g;
const correctedPattern = '{filteredProducts.length > 0 && (';

content = content.replace(duplicatedPattern, correctedPattern);

// Salvar o arquivo modificado
fs.writeFileSync(filePath, content, 'utf8');

console.log('Condição duplicada corrigida com sucesso!'); 