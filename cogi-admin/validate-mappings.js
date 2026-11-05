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
    const docResult = await client.query(`
      SELECT id FROM curriculum_source_documents 
      WHERE code = 'VN-GDPT2018-MATH-SOURCE-01'
    `);
    const sourceDocId = docResult.rows[0].id;
    
    // Check how many mapping target_document_id values actually exist in sections
    const validResult = await client.query(`
      SELECT 
        COUNT(DISTINCT cim.target_document_id) as total_targets,
        COUNT(DISTINCT cs.document_id) as existing_sections,
        COUNT(DISTINCT csl.document_id) as existing_locations
      FROM curriculum_import_mappings cim
      INNER JOIN curriculum_import_mappings_source_document_lnk link
        ON link.curriculum_import_mapping_id = cim.id
      LEFT JOIN curriculum_sections cs 
        ON cs.document_id = cim.target_document_id AND cim.entity_type = 'section'
      LEFT JOIN curriculum_source_locations csl 
        ON csl.document_id = cim.target_document_id AND cim.entity_type = 'source_location'
      WHERE link.curriculum_source_document_id = $1
    `, [sourceDocId]);
    
    console.log("=== MAPPING TARGET VALIDATION ===");
    console.log(`Total distinct targets in mappings: ${validResult.rows[0].total_targets}`);
    console.log(`Existing sections matching targets: ${validResult.rows[0].existing_sections}`);
    console.log(`Existing locations matching targets: ${validResult.rows[0].existing_locations}`);
    
    // Sample some mapping targets to see what they look like
    const sampleResult = await client.query(`
      SELECT DISTINCT
        entity_type,
        target_document_id,
        CASE WHEN cs.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as section_status,
        CASE WHEN csl.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as location_status
      FROM curriculum_import_mappings cim
      INNER JOIN curriculum_import_mappings_source_document_lnk link
        ON link.curriculum_import_mapping_id = cim.id
      LEFT JOIN curriculum_sections cs 
        ON cs.document_id = cim.target_document_id AND cim.entity_type = 'section'
      LEFT JOIN curriculum_source_locations csl 
        ON csl.document_id = cim.target_document_id AND cim.entity_type = 'source_location'
      WHERE link.curriculum_source_document_id = $1
      LIMIT 20
    `, [sourceDocId]);
    
    console.log("\n=== SAMPLE MAPPING TARGETS (first 20) ===");
    sampleResult.rows.forEach(r => {
      const status = r.entity_type === 'section' ? r.section_status : r.location_status;
      console.log(`  ${r.entity_type}: ${r.target_document_id} [${status}]`);
    });
    
  } finally {
    await client.end();
  }
})().catch(console.error);
