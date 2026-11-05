const pg = require("pg");

async function cleanupCurriculumData() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5432,
    user: "cogi_user",
    password: "123456@",
    database: "cogi_fw5"
  });
  
  await client.connect();
  
  try {
    console.log("🗑️  CLEANING CURRICULUM TEST DATA...\n");
    
    // Step 1: Find source document
    const docResult = await client.query(`
      SELECT id FROM curriculum_source_documents 
      WHERE code = 'VN-GDPT2018-MATH-SOURCE-01'
    `);
    
    if (docResult.rows.length === 0) {
      console.log("❌ Source document not found");
      return;
    }
    
    const sourceDocId = docResult.rows[0].id;
    
    // Step 2: Delete import mappings
    console.log("Deleting import mappings...");
    const delMappingsResult = await client.query(`
      DELETE FROM curriculum_import_mappings im
      WHERE EXISTS (
        SELECT 1 FROM curriculum_import_mappings_source_document_lnk link
        WHERE link.curriculum_import_mapping_id = im.id
          AND link.curriculum_source_document_id = $1
      )
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delMappingsResult.rowCount} mappings`);
    
    // Step 3: Delete mapping links
    console.log("Deleting mapping-source links...");
    const delMappingLinksResult = await client.query(`
      DELETE FROM curriculum_import_mappings_source_document_lnk
      WHERE curriculum_source_document_id = $1
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delMappingLinksResult.rowCount} mapping links`);
    
    // Step 4: Delete import batch links
    console.log("Deleting batch-source links...");
    const delBatchLinksResult = await client.query(`
      DELETE FROM curriculum_import_batches_source_document_lnk
      WHERE curriculum_source_document_id = $1
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delBatchLinksResult.rowCount} batch links`);
    
    // Step 5: Delete import batches
    console.log("Deleting import batches...");
    const delBatchesResult = await client.query(`
      DELETE FROM curriculum_import_batches b
      WHERE NOT EXISTS (
        SELECT 1 FROM curriculum_import_batches_source_document_lnk
        WHERE curriculum_import_batch_id = b.id
      )
    `);
    console.log(`✓ Deleted ${delBatchesResult.rowCount} import batches`);
    
    // Step 6: Delete parent-child links
    console.log("Deleting parent-child relationships...");
    const delParentLinksResult = await client.query(`
      DELETE FROM curriculum_sections_parent_lnk
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
    console.log(`✓ Deleted ${delParentLinksResult.rowCount} parent-child links`);
    
    // Step 7: Delete source-section links
    console.log("Deleting section-source links...");
    const delSectionLinksResult = await client.query(`
      DELETE FROM curriculum_sections_source_document_lnk
      WHERE curriculum_source_document_id = $1
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delSectionLinksResult.rowCount} section-source links`);
    
    // Step 8: Delete source-location links
    console.log("Deleting location-source links...");
    const delLocationLinksResult = await client.query(`
      DELETE FROM curriculum_source_locations_source_document_lnk
      WHERE curriculum_source_document_id = $1
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delLocationLinksResult.rowCount} location-source links`);
    
    // Step 9: Delete location-section links
    console.log("Deleting location-section links...");
    const delLocSectionLinksResult = await client.query(`
      DELETE FROM curriculum_source_locations_section_lnk
      WHERE curriculum_source_location_id IN (
        SELECT csl.id FROM curriculum_source_locations csl
        INNER JOIN curriculum_source_locations_source_document_lnk lnk 
          ON lnk.curriculum_source_location_id = csl.id
        WHERE lnk.curriculum_source_document_id = $1
      )
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delLocSectionLinksResult.rowCount} location-section links`);
    
    // Step 10: Delete source locations
    console.log("Deleting source locations...");
    const delLocationsResult = await client.query(`
      DELETE FROM curriculum_source_locations csl
      WHERE csl.id IN (
        SELECT csl2.id FROM curriculum_source_locations csl2
        INNER JOIN curriculum_source_locations_source_document_lnk lnk 
          ON lnk.curriculum_source_location_id = csl2.id
        WHERE lnk.curriculum_source_document_id = $1
      )
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delLocationsResult.rowCount} source locations`);
    
    // Step 11: Delete sections
    console.log("Deleting sections...");
    const delSectionsResult = await client.query(`
      DELETE FROM curriculum_sections cs
      WHERE cs.id IN (
        SELECT cs2.id FROM curriculum_sections cs2
        INNER JOIN curriculum_sections_source_document_lnk lnk 
          ON lnk.curriculum_section_id = cs2.id
        WHERE lnk.curriculum_source_document_id = $1
      )
    `, [sourceDocId]);
    console.log(`✓ Deleted ${delSectionsResult.rowCount} sections`);
    
    console.log("\n=== CLEANUP SUMMARY ===");
    console.log(`✓ Sections: ${delSectionsResult.rowCount}`);
    console.log(`✓ Source Locations: ${delLocationsResult.rowCount}`);
    console.log(`✓ Import Mappings: ${delMappingsResult.rowCount}`);
    console.log(`✓ Parent-child Links: ${delParentLinksResult.rowCount}`);
    console.log(`✓ Import Batches: ${delBatchesResult.rowCount}`);
    console.log("\n✅ Cleanup completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

cleanupCurriculumData()
  .then(() => process.exit(0))
  .catch(e => { 
    console.error(e); 
    process.exit(1); 
  });
