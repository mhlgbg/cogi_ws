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
    console.log(`Body (first 500): ${(section.body || '').substring(0, 500)}`);
    
    console.log("\n=== Source Locations linked to Số tự nhiên (ID 207) ===");
    const res2 = await client.query(`
      SELECT csl.id, csl.start_page, csl.end_page, csl.locator, csl.excerpt
      FROM curriculum_source_locations csl
      JOIN curriculum_source_locations_section_lnk lnk 
        ON lnk.curriculum_source_location_id = csl.id
      WHERE lnk.curriculum_section_id = 207
    `);
    console.log(`Found ${res2.rows.length} locations:`);
    res2.rows.forEach((r, i) => {
      console.log(`\n  [${i+1}] Location ID ${r.id}, Pages ${r.start_page}-${r.end_page}`);
      console.log(`      Locator: ${r.locator}`);
      console.log(`      Excerpt (first 200): ${(r.excerpt || '').substring(0, 200)}`);
    });
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
