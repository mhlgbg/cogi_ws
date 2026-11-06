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
    console.log("=== Full hierarchy for Math Class 6 (ID 195) ===");
    const res = await client.query(`
      WITH RECURSIVE tree AS (
        SELECT cs.id, cs.title, cs.section_type, cs.sort_order, NULL::int as parent_id, 1 as level
        FROM curriculum_sections cs
        WHERE cs.id = 195
        UNION ALL
        SELECT cs.id, cs.title, cs.section_type, cs.sort_order, csp.inv_curriculum_section_id, t.level + 1
        FROM curriculum_sections cs
        JOIN curriculum_sections_parent_lnk csp ON csp.curriculum_section_id = cs.id
        JOIN tree t ON csp.inv_curriculum_section_id = t.id
        WHERE t.level < 8
      )
      SELECT REPEAT('  ', level-1) || '[' || id || '] ' || title AS hierarchy, id, section_type, level, sort_order
      FROM tree
      ORDER BY level, sort_order, id
    `);
    res.rows.forEach(r => console.log(`${r.hierarchy} (type: ${r.section_type}, lvl: ${r.level})`));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
