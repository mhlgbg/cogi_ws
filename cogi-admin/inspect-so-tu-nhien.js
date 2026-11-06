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
    console.log("=== Section: Số tự nhiên (ID 207) ===");
    const res = await client.query(`
      SELECT id, title, section_type, body
      FROM curriculum_sections
      WHERE id = 207
    `);
    const section = res.rows[0];
    console.log(`Title: ${section.title}`);
    console.log(`Type: ${section.section_type}`);
    console.log(`Body length: ${(section.body || '').length} chars`);
    console.log(`Body: ${(section.body || '').substring(0, 300)}`);
    
    console.log("\n=== Source Locations linked to Số tự nhiên ===");
    const res2 = await client.query(`
      SELECT id, start_page, end_page, locator, excerpt
      FROM curriculum_source_locations
      WHERE id IN (
        SELECT csl_source_location_id FROM curriculum_source_locations_section_lnk
        WHERE curriculum_section_id = 207
      )
    `);
    console.log(`Found ${res2.rows.length} locations:`);
    res2.rows.forEach((r, i) => {
      console.log(`\n  [${i+1}] Pages ${r.start_page}-${r.end_page}, locator: ${r.locator}`);
      console.log(`      Excerpt (first 200): ${(r.excerpt || '').substring(0, 200)}`);
    });
    
    console.log("\n=== Check import mappings for Số tự nhiên ===");
    const res3 = await client.query(`
      SELECT * FROM curriculum_import_mappings
      WHERE target_document_id = '207'
      LIMIT 3
    `);
    console.log(`Found ${res3.rows.length} mappings`);
    res3.rows.forEach(r => {
      console.log(`  importKey: ${r.import_key}, entity: ${r.entity_type}`);
    });
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
