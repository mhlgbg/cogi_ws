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
    // Check parent table structure
    console.log("=== curriculum_sections_parent_lnk columns ===");
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name='curriculum_sections_parent_lnk'
      ORDER BY ordinal_position
    `);
    res.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
    // Check actual data
    console.log("\n=== Parent link data (sample) ===");
    const res2 = await client.query(`
      SELECT * FROM curriculum_sections_parent_lnk LIMIT 10
    `);
    console.log(`  Found ${res2.rows.length} parent links`);
    res2.rows.forEach(r => {
      console.log(`  Link: child(${r.curriculum_section_id}) -> parent(${r.inv_curriculum_section_id})`);
    });
    
    // Hierarchy
    console.log("\n=== Hierarchy for Class 6 (first 20 levels) ===");
    const res3 = await client.query(`
      WITH RECURSIVE tree AS (
        SELECT cs.id, cs.title, cs.section_type, cs.sort_order, NULL::int as parent_id, 1 as level
        FROM curriculum_sections cs
        WHERE cs.title LIKE '%Lớp 6%' AND NOT EXISTS (
          SELECT 1 FROM curriculum_sections_parent_lnk csp 
          WHERE csp.curriculum_section_id = cs.id
        )
        UNION ALL
        SELECT cs.id, cs.title, cs.section_type, cs.sort_order, csp.inv_curriculum_section_id, t.level + 1
        FROM curriculum_sections cs
        JOIN curriculum_sections_parent_lnk csp ON csp.curriculum_section_id = cs.id
        JOIN tree t ON csp.inv_curriculum_section_id = t.id
        WHERE t.level < 10
      )
      SELECT REPEAT('  ', level-1) || title AS hierarchy, id
      FROM tree
      ORDER BY level, sort_order
    `);
    res3.rows.forEach(r => console.log(`  ${r.hierarchy}`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
