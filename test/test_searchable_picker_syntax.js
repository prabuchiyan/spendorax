const fs = require('fs');
const babel = require('@babel/parser');
const code = fs.readFileSync('src/components/SearchableItemPickerModal.js', 'utf8');
babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
console.log('SearchableItemPickerModal parsed successfully!');
