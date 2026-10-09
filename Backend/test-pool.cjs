const pool = require('./src/config/db').default;
async function test() {
  const [r] = await pool.query("SELECT id, name_ps, HEX(name_ps) as hex_ps FROM categories WHERE id=1");
  const s = r[0].name_ps;
  console.log('String:', s);
  console.log('Length:', s.length);
  console.log('Char codes:', [...s].map(c => c.charCodeAt(0)));
  console.log('JSON:', JSON.stringify(r[0]));
}
test().catch(console.error);
