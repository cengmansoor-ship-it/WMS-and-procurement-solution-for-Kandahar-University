const fs = require('fs');
const txt = fs.readFileSync('public/forms/official-forms.html', 'utf8');
const start = txt.indexOf('id="formTemplate2"');
const end = txt.indexOf('id="formTemplate3"');
const slice = txt.slice(start, end);

const matches = slice.match(/<div class="[^"]+"/g) || [];
const counts = {};
matches.forEach(m => counts[m] = (counts[m] || 0) + 1);
console.log(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 30));

const sectionMatches = slice.match(/class="(form-container|paper-a4|viewer-card|ribbon-shell|document-page)"/g) || [];
console.log("Important classes:", sectionMatches);
