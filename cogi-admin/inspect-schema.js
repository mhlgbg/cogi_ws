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
    // Check columns
    console.log("=== All columns in curriculum_sections ===");
    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name='curriculum_sections'
      ORDER BY ordinal_position
    `);
    res.rows.forEach(r => console.log(`  - ${r.column_name}`));
    
    // Check parent relation through polymorphic
    console.log("\n=== Check joins for parent relation ===");
    const res2 = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name LIKE '%relation%' OR table_name LIKE '%morph%'
      LIMIT 10
    `);
    console.log(`  Found ${res2.rows.length} relation/morph tables`);
    
    // Try to find parent using Strapi's morphology
    console.log("\n=== Sample Sections (all) ===");
    const res3 = await client.query(`
      SELECT id, title, section_type, sort_order
      FROM curriculum_sections
      ORDER BY id
      LIMIT 20
    `);
    res3.rows.forEach(r => console.log(`  [${r.id}] ${r.title} (type: ${r.section_type})`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
