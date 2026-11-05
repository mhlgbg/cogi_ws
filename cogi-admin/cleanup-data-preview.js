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
    console.log("=== STEP 1: IDENTIFY TARGET SOURCE DOCUMENT ===");
    const docResult = await client.query(`
      SELECT id, code, title FROM curriculum_source_documents 
      WHERE code = 'VN-GDPT2018-MATH-SOURCE-01'
    `);
    
    if (docResult.rows.length === 0) {
      console.log("❌ Source document VN-GDPT2018-MATH-SOURCE-01 not found");
      await client.end();
      return;
    }
    
    const sourceDocId = docResult.rows[0].id;
    console.log(`✓ Found: ID=${sourceDocId}, Code=${docResult.rows[0].code}, Title=${docResult.rows[0].title}`);
    
    // Step 2: Find all affected sections via source document relationship
    console.log("\n=== STEP 2: FIND SECTIONS TO DELETE ===");
    const sectionsResult = await client.query(`
      SELECT DISTINCT cs.id, cs.document_id, cs.title 
      FROM curriculum_sections cs
      INNER JOIN curriculum_sections_source_document_lnk lnk 
        ON lnk.curriculum_section_id = cs.id
      WHERE lnk.curriculum_source_document_id = $1
      ORDER BY cs.id
    `, [sourceDocId]);
    
    console.log(`Found ${sectionsResult.rows.length} sections`);
    if (sectionsResult.rows.length > 0) {
      console.log("Sample sections:");
      sectionsResult.rows.slice(0, 5).forEach(r => {
        console.log(`  - ID=${r.id}, DocID=${r.document_id}, Title=${r.title}`);
      });
    }
    
    // Step 3: Find all affected source locations
    console.log("\n=== STEP 3: FIND SOURCE LOCATIONS TO DELETE ===");
    const locationsResult = await client.query(`
      SELECT DISTINCT csl.id, csl.document_id 
      FROM curriculum_source_locations csl
      INNER JOIN curriculum_source_locations_source_document_lnk lnk 
        ON lnk.curriculum_source_location_id = csl.id
      WHERE lnk.curriculum_source_document_id = $1
      ORDER BY csl.id
    `, [sourceDocId]);
    
    console.log(`Found ${locationsResult.rows.length} source locations`);
    
    // Step 4: Find affected mappings
    console.log("\n=== STEP 4: FIND MAPPINGS TO DELETE ===");
    const mappingsResult = await client.query(`
      SELECT im.id, im.entity_type, im.import_key, im.target_document_id
      FROM curriculum_import_mappings im
      INNER JOIN curriculum_import_mappings_source_document_lnk link 
        ON link.curriculum_import_mapping_id = im.id
      WHERE link.curriculum_source_document_id = $1
      ORDER BY im.id
    `, [sourceDocId]);
    
    console.log(`Found ${mappingsResult.rows.length} mappings`);
    if (mappingsResult.rows.length > 0) {
      console.log("Sample mappings:");
      mappingsResult.rows.slice(0, 5).forEach(r => {
        console.log(`  - ID=${r.id}, Type=${r.entity_type}, Key=${r.import_key}`);
      });
    }
    
    // Step 5: Find affected import batches
    console.log("\n=== STEP 5: FIND IMPORT BATCHES ===");
    const batchesResult = await client.query(`
      SELECT DISTINCT b.id, b.status, b.created_at
      FROM curriculum_import_batches b
      INNER JOIN curriculum_import_batches_source_document_lnk lnk 
        ON lnk.curriculum_import_batch_id = b.id
      WHERE lnk.curriculum_source_document_id = $1
      ORDER BY b.created_at DESC
    `, [sourceDocId]);
    
    console.log(`Found ${batchesResult.rows.length} import batches`);
    
    // Step 6: Check for external references
    console.log("\n=== STEP 6: CHECK FOR EXTERNAL REFERENCES ===");
    const refResult = await client.query(`
      SELECT 
        'curriculum_sections_parent_lnk' as table_name,
        COUNT(*) as count
      FROM curriculum_sections_parent_lnk
      WHERE curriculum_section_id IN (
        SELECT cs.id FROM curriculum_sections cs
        INNER JOIN curriculum_sections_source_document_lnk lnk 
          ON lnk.curriculum_section_id = cs.id
        WHERE lnk.curriculum_source_document_id = $1
      )
      OR inv_curriculum_section_id IN (
        SELECT cs.id FROM curriculum_sections cs
        INNER JOIN curriculum_sections_source_document_lnk lnk 
          ON lnk.curriculum_section_id = cs.id
        WHERE lnk.curriculum_source_document_id = $1
      )
    `, [sourceDocId]);
    
    const parentLinks = parseInt(refResult.rows[0]?.count || 0);
    console.log(`Parent-child relationships involving these sections: ${parentLinks}`);
    
    // Step 7: PREVIEW - Show what will be deleted
    console.log("\n=== PREVIEW: DATA TO BE DELETED ===");
    console.log(`✓ Sections: ${sectionsResult.rows.length}`);
    console.log(`✓ Source Locations: ${locationsResult.rows.length}`);
    console.log(`✓ Import Mappings: ${mappingsResult.rows.length}`);
    console.log(`✓ Parent-child Links: ${parentLinks}`);
    console.log(`✓ Import Batches: ${batchesResult.rows.length}`);
    
    console.log("\n⚠️  NO DATA DELETED YET - RUN cleanup-data-delete.js AFTER REVIEW");
    
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
})().catch(e => { 
  console.error(e); 
  process.exit(1); 
});
