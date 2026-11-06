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
    console.log("=== Find Lớp 6 ===");
    const res = await client.query(`
      SELECT id, title, section_type, sort_order
      FROM curriculum_sections
      WHERE title ILIKE '%lớp 6%' OR title LIKE '%LỚP 6%'
      ORDER BY id
    `);
    console.log(`Found ${res.rows.length} records:`);
    res.rows.forEach(r => console.log(`  [${r.id}] ${r.title} (type: ${r.section_type}, sort: ${r.sort_order})`));
    
    if (res.rows.length > 0) {
      const class6Id = res.rows[0].id;
      
      console.log(`\n=== Hierarchy under ID ${class6Id} (top 30 children) ===`);
      const res2 = await client.query(`
        WITH RECURSIVE tree AS (
          SELECT cs.id, cs.title, cs.section_type, cs.sort_order, NULL::int as parent_id, 1 as level
          FROM curriculum_sections cs
          WHERE cs.id = $1
          UNION ALL
          SELECT cs.id, cs.title, cs.section_type, cs.sort_order, csp.inv_curriculum_section_id, t.level + 1
          FROM curriculum_sections cs
          JOIN curriculum_sections_parent_lnk csp ON csp.curriculum_section_id = cs.id
          JOIN tree t ON csp.inv_curriculum_section_id = t.id
          WHERE t.level < 6
        )
        SELECT REPEAT('  ', level-1) || title AS hierarchy, id, section_type, level
        FROM tree
        ORDER BY level, sort_order
        LIMIT 30
      `, [class6Id]);
      res2.rows.forEach(r => console.log(`  [${r.id}] ${r.hierarchy} (type: ${r.section_type})`));
    }
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
