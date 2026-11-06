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
    console.log("=== curriculum_sections columns ===");
    const res1 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='curriculum_sections'
      ORDER BY ordinal_position
    `);
    res1.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
    console.log("\n=== curriculum_import_mappings columns ===");
    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='curriculum_import_mappings'
      ORDER BY ordinal_position
    `);
    res2.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
