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
    // Check hierarchy for Class 6
    console.log("=== Hierarchy for Class 6 ===");
    const res = await client.query(`
      WITH RECURSIVE section_tree AS (
        SELECT id, title, parent_id, sort_order, section_type, 1 AS level
        FROM curriculum_sections
        WHERE parent_id IS NULL AND title LIKE '%Lớp 6%'
        UNION ALL
        SELECT s.id, s.title, s.parent_id, s.sort_order, s.section_type, st.level + 1
        FROM curriculum_sections s
        JOIN section_tree st ON s.parent_id = st.id
        WHERE st.level < 5
      )
      SELECT 
        REPEAT('  ', level-1) || title AS hierarchy,
        id, parent_id, section_type, sort_order
      FROM section_tree
      ORDER BY level, sort_order
      LIMIT 30
    `);
    res.rows.forEach(r => console.log(r.hierarchy));
    
    console.log("\n=== Section details (first 5) ===");
    const res2 = await client.query(`
      SELECT id, title, parent_id, section_type, body
      FROM curriculum_sections
      WHERE title LIKE '%Lớp 6%' OR title LIKE '%Số tự nhiên%'
      ORDER BY id
      LIMIT 5
    `);
    res2.rows.forEach(r => {
      console.log(`[${r.id}] ${r.title} (parent: ${r.parent_id}, type: ${r.section_type})`);
      if (r.body) {
        console.log(`    Body (first 150 chars): ${r.body.substring(0, 150)}...`);
      }
    });
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
