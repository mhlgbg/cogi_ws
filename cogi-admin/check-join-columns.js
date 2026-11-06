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
    console.log("=== curriculum_source_locations_section_lnk columns ===");
    const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name='curriculum_source_locations_section_lnk'
      ORDER BY ordinal_position
    `);
    res.rows.forEach(r => console.log(`  - ${r.column_name}`));
    
    console.log("\n=== Sample data from join table ===");
    const res2 = await client.query(`
      SELECT * FROM curriculum_source_locations_section_lnk LIMIT 5
    `);
    res2.rows.forEach(r => {
      console.log(`  ${JSON.stringify(r)}`);
    });
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
