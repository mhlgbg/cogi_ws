const pg = require("pg");

(async () => {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5432,
    user: "cogi_user",
    password: "123456@",
    database: "cogi_fw5"
  });
  
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='curriculum_source_locations'
      ORDER BY ordinal_position
    `);
    console.log("=== curriculum_source_locations columns ===");
    res.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
