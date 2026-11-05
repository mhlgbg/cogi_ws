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
    // Query 1: Check class sections
    const classesResult = await client.query(`
      SELECT 
        id, 
        document_id, 
        title
      FROM curriculum_sections
      WHERE title IN ('LỚP 5', 'LỚP 6', 'LỚP 7')
      ORDER BY title, id
    `);
    
    console.log("=== CLASS SECTIONS (LỚP 5, 6, 7) ===");
    console.log(JSON.stringify(classesResult.rows, null, 2));
    
    // Get their IDs
    const classIds = classesResult.rows.map(r => r.id);
    console.log("\nClass section IDs:", classIds);
    
    if (classIds.length > 0) {
      // Query 2: Get direct children in link table
      const linkResult = await client.query(`
        SELECT 
          csp.curriculum_section_id as child_id,
          csp.inv_curriculum_section_id as parent_id,
          child.document_id as child_doc_id,
          child.title as child_title,
          parent.title as parent_title
        FROM curriculum_sections_parent_lnk csp
        LEFT JOIN curriculum_sections child ON child.id = csp.curriculum_section_id
        LEFT JOIN curriculum_sections parent ON parent.id = csp.inv_curriculum_section_id
        WHERE csp.inv_curriculum_section_id = ANY($1)
        ORDER BY csp.inv_curriculum_section_id, child.title
      `, [classIds]);
      
      console.log("\n=== DIRECT CHILDREN IN LINK TABLE ===");
      console.log(`Total rows: ${linkResult.rows.length}`);
      if (linkResult.rows.length > 0) {
        console.log(JSON.stringify(linkResult.rows, null, 2));
      }
    }
    
    // Query 3: Count all parent-child relationships
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as total_pairs,
        COUNT(DISTINCT inv_curriculum_section_id) as unique_parents
      FROM curriculum_sections_parent_lnk
    `);
    
    console.log("\n=== TOTAL PARENT-CHILD RELATIONSHIPS ===");
    console.log(JSON.stringify(countResult.rows, null, 2));
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error("Error:", e.message); 
  process.exit(1); 
});
