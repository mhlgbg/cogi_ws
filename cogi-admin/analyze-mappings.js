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
    // Query 1: Mappings for specific importKeys with section details
    const mappingsResult = await client.query(`
      SELECT 
        im.id,
        im.document_id as mapping_doc_id,
        im.entity_type,
        im.import_key,
        im.target_document_id,
        im.last_imported_at,
        im.updated_at,
        cs.id as section_id,
        cs.document_id as section_document_id,
        cs.title as section_title,
        csd.code as source_doc_code
      FROM curriculum_import_mappings im
      LEFT JOIN curriculum_import_mappings_source_document_lnk link 
        ON link.curriculum_import_mapping_id = im.id
      LEFT JOIN curriculum_source_documents csd 
        ON csd.id = link.curriculum_source_document_id
      LEFT JOIN curriculum_sections cs 
        ON CAST(cs.id AS TEXT) = im.target_document_id
      WHERE im.entity_type = 'section' 
        AND im.import_key IN (
          'SEC-V-3-G05', 'SEC-V-3-G06', 'SEC-V-3-G06-1', 
          'SEC-V-3-G06-1-1', 'SEC-V-3-G06-1-1-A', 'SEC-V-3-G07'
        )
      ORDER BY im.import_key, im.last_imported_at DESC
    `);
    
    console.log("=== MAPPINGS FOR TARGET SECTIONS ===");
    console.log(JSON.stringify(mappingsResult.rows, null, 2));
    console.log(`Total rows: ${mappingsResult.rows.length}`);
    
    // Query 2: Find all LỚP 5, 6, 7 sections
    const classesResult = await client.query(`
      SELECT 
        id, 
        document_id, 
        title, 
        parent,
        source_document_id,
        created_at,
        updated_at
      FROM curriculum_sections
      WHERE title IN ('LỚP 5', 'LỚP 6', 'LỚP 7')
      ORDER BY title, id
    `);
    
    console.log("\n=== ALL CLASS SECTIONS (LỚP 5, 6, 7) ===");
    console.log(JSON.stringify(classesResult.rows, null, 2));
    console.log(`Total rows: ${classesResult.rows.length}`);
    
    // Query 3: Check for duplicate/multiple versions
    const dupResult = await client.query(`
      SELECT 
        import_key, 
        COUNT(*) as mapping_count,
        STRING_AGG(DISTINCT CAST(id AS TEXT), ',') as mapping_ids,
        STRING_AGG(DISTINCT target_document_id, ',') as target_ids
      FROM curriculum_import_mappings
      WHERE entity_type = 'section'
      GROUP BY import_key
      HAVING COUNT(*) > 1
      ORDER BY import_key
    `);
    
    console.log("\n=== DUPLICATE MAPPINGS (Multiple per key) ===");
    console.log(JSON.stringify(dupResult.rows, null, 2));
    console.log(`Total duplicate key groups: ${dupResult.rows.length}`);
    
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error("Error:", e.message); 
  process.exit(1); 
});
