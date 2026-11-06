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
    console.log("=== Current Sections Count ===");
    const res1 = await client.query(`
      SELECT section_type, COUNT(*) as count
      FROM curriculum_sections
      GROUP BY section_type
    `);
    res1.rows.forEach(r => console.log(`  - ${r.section_type}: ${r.count}`));
    
    console.log("\n=== Sample Section (Class 6) ===");
    const res2 = await client.query(`
      SELECT id, title, section_type, sort_order, body 
      FROM curriculum_sections
      WHERE title LIKE '%Số tự nhiên%' OR title LIKE '%Lớp 6%'
      LIMIT 3
    `);
    res2.rows.forEach(r => {
      console.log(`  [${r.id}] ${r.title} (type: ${r.section_type}, sort: ${r.sort_order})`);
      console.log(`      Body: ${(r.body || '').substring(0, 100)}...`);
    });
    
    console.log("\n=== Sample Source Locations ===");
    const res3 = await client.query(`
      SELECT id, start_page, end_page, locator, excerpt
      FROM curriculum_source_locations
      LIMIT 3
    `);
    res3.rows.forEach(r => {
      console.log(`  [${r.id}] pages ${r.start_page}-${r.end_page}, locator: ${r.locator}`);
      console.log(`      Excerpt: ${(r.excerpt || '').substring(0, 100)}...`);
    });
    
    console.log("\n=== Import Mappings Sample ===");
    const res4 = await client.query(`
      SELECT id, entity_type, import_key, target_document_id, source_hash
      FROM curriculum_import_mappings
      LIMIT 3
    `);
    res4.rows.forEach(r => {
      console.log(`  [${r.id}] ${r.entity_type}: ${r.import_key} -> ${r.target_document_id}`);
    });
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
