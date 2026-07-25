const fs = require('fs');
const s = fs.readFileSync('resources/js/simulator.js','utf8');
for(let i=0;i<200 && i<s.length;i++){
  const c = s[i];
  const code = s.charCodeAt(i);
  process.stdout.write(i+':'+code+':'+(code<32?('['+code+']'):c)+'\n');
}
