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
    console.log("=== Check parent links for each LỚP 6 (ID 28, 72, 116, 195) ===");
    for (const id of [28, 72, 116, 195]) {
      const res = await client.query(`
        SELECT csp.curriculum_section_id as child_id, cs.title, cs.section_type
        FROM curriculum_sections_parent_lnk csp
        JOIN curriculum_sections cs ON cs.id = csp.curriculum_section_id
        WHERE csp.inv_curriculum_section_id = $1
        ORDER BY cs.sort_order
        LIMIT 5
      `, [id]);
      console.log(`\n  ID ${id} has ${res.rows.length} children:`);
      res.rows.forEach(r => console.log(`    - [${r.child_id}] ${r.title} (${r.section_type})`));
    }
    
    // Check the Math (Toán) hierarchy
    console.log("\n=== Find math subjects ===");
    const res2 = await client.query(`
      SELECT DISTINCT cs.id, cs.title, cs.section_type
      FROM curriculum_sections cs
      WHERE cs.title LIKE '%Toán%' OR cs.title LIKE '%TOÁN%'
      ORDER BY cs.id
    `);
    res2.rows.forEach(r => console.log(`  [${r.id}] ${r.title} (${r.section_type})`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
