const { Client } = require('pg'); (async ()=>{ const client = new Client({ host: '127.0.0.1', port: 5432, user: 'cogi_user', password: '123456@', database: 'cogi_fw3' }); await client.connect(); const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='lucky_wheels' ORDER BY ordinal_position;`); console.log(JSON.stringify(res.rows, null, 2)); await client.end();})().catch(e=>{ console.error(e); process.exit(1); });



curl.exe -i -X POST "http://localhost:1339/api/public/lucky-wheels/AS2026/participants/lookup" `  -H "Content-Type: application/json" -H "x-tenant-code: cogi" `
  -d "{\"participantCode\":\"AJA7W\"}"