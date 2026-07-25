const fs = require('fs');
const path = 'resources/js/simulator.js';
let lines = fs.readFileSync(path,'utf8').split('\n').filter(l=>!/^\s*(import|export)\b/.test(l));
for (let i = 1; i <= lines.length; i++) {
  const chunk = lines.slice(0, i).join('\n');
  try {
    new Function(chunk);
  } catch (e) {
    console.error('FAIL at line', i, '=>', lines[i-1]);
    console.error(e.toString());
    process.exit(0);
  }
}
console.log('ALL PARSED');
