const { Client } = require('pg');
(async () => {
  const client = new Client({ host: '127.0.0.1', port: 5432, user: 'cogi_user', password: '123456@', database: 'cogi_fw3' });
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM public.lucky_wheels WHERE upper(code) = 'AS2026';");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
})();
