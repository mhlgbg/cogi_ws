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
    // Query section schema
    const schemaResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'curriculum_sections'
      ORDER BY ordinal_position
    `);
    
    console.log("=== CURRICULUM_SECTIONS SCHEMA ===");
    console.log(JSON.stringify(schemaResult.rows, null, 2));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error("Error:", e.message); 
  process.exit(1); 
});
