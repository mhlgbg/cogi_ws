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
    // Check all tables
    console.log("=== Tables containing 'curriculum' ===");
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name LIKE '%curriculum%'
      ORDER BY table_name
    `);
    res.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    // Check if there's a join table for parent relation
    console.log("\n=== Check for parent relation table ===");
    const res2 = await client.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema='public' AND (table_name LIKE '%parent%' OR table_name LIKE '%section_parent%')
      ORDER BY table_name
    `);
    res2.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    // Try direct SQL to find parent
    console.log("\n=== Check curriculum_section columns with LIKE parent ===");
    const res3 = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name='curriculum_sections' AND column_name LIKE '%parent%'
    `);
    console.log(`  Found ${res3.rows.length} columns`);
    res3.rows.forEach(r => console.log(`  - ${r.column_name}`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
