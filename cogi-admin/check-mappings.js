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
    // Query column names
    const schemaResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'curriculum_import_mappings'
      ORDER BY ordinal_position
    `);
    
    console.log("=== MAPPING TABLE SCHEMA ===");
    console.log(JSON.stringify(schemaResult.rows, null, 2));
    
    // Sample data
    const sampleResult = await client.query(`
      SELECT * FROM curriculum_import_mappings LIMIT 3
    `);
    
    console.log("\n=== SAMPLE MAPPING RECORDS ===");
    console.log(JSON.stringify(sampleResult.rows, null, 2));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
