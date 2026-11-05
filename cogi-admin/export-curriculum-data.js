const pg = require("pg");
const fs = require("fs");
const path = require("path");

async function exportCurriculumData() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5432,
    user: "cogi_user",
    password: "123456@",
    database: "cogi_fw5"
  });
  
  await client.connect();
  
  try {
    console.log("📤 EXPORTING CURRICULUM DATA...\n");
    
    // Step 1: Find source document
    const docResult = await client.query(`
      SELECT id, code, title FROM curriculum_source_documents 
      WHERE code = 'VN-GDPT2018-MATH-SOURCE-01'
    `);
    
    if (docResult.rows.length === 0) {
      console.log("❌ Source document not found");
      return;
    }
    
    const sourceDoc = docResult.rows[0];
    console.log(`✓ Found source document: ${sourceDoc.code}`);
    
    // Step 2: Get mapping keyset
    console.log("Exporting mappings keyset...");
    const mappingsResult = await client.query(`
      SELECT DISTINCT entity_type, import_key, target_document_id
      FROM curriculum_import_mappings cim
      INNER JOIN curriculum_import_mappings_source_document_lnk link
        ON link.curriculum_import_mapping_id = cim.id
      WHERE link.curriculum_source_document_id = $1
    `, [sourceDoc.id]);
    
    const mappings = mappingsResult.rows;
    console.log(`✓ Found ${mappings.length} mappings`);
    
    // Build map of documentId -> importKey  
    const docToImportKey = {};
    mappings.forEach(m => {
      docToImportKey[m.target_document_id] = m.import_key;
    });
    
    // Check if mappings are valid (target_document_id exist)
    const validMappingsResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN cim.target_document_id IS NOT NULL THEN 1 END) as with_target,
        COUNT(CASE WHEN cim.target_document_id IS NULL THEN 1 END) as without_target
      FROM curriculum_import_mappings cim
      INNER JOIN curriculum_import_mappings_source_document_lnk link
        ON link.curriculum_import_mapping_id = cim.id
      WHERE link.curriculum_source_document_id = $1
    `, [sourceDoc.id]);
    
    console.log(`  - Mappings with target: ${validMappingsResult.rows[0].with_target}`);
    console.log(`  - Mappings without target: ${validMappingsResult.rows[0].without_target}`);
    
    // Step 3: Get all sections linked to mappings
    console.log("Exporting sections...");
    const sectionsResult = await client.query(`
      SELECT 
        cs.document_id as "documentId",
        cs.title,
        cs.body,
        cs.created_at
      FROM curriculum_sections cs
      WHERE EXISTS (
        SELECT 1 FROM curriculum_import_mappings cim
        INNER JOIN curriculum_import_mappings_source_document_lnk link
          ON link.curriculum_import_mapping_id = cim.id
        WHERE cim.target_document_id = cs.document_id
          AND cim.entity_type = 'section'
          AND link.curriculum_source_document_id = $1
      )
    `, [sourceDoc.id]);
    
    const sections = sectionsResult.rows;
    console.log(`✓ Found ${sections.length} sections`);
    
    // Step 4: Get all source locations linked to mappings
    console.log("Exporting source locations...");
    const locationsResult = await client.query(`
      SELECT 
        csl.document_id as "documentId",
        csl.start_page as "startPage",
        csl.end_page as "endPage",
        csl.locator,
        csl.excerpt,
        csl.created_at
      FROM curriculum_source_locations csl
      WHERE EXISTS (
        SELECT 1 FROM curriculum_import_mappings cim
        INNER JOIN curriculum_import_mappings_source_document_lnk link
          ON link.curriculum_import_mapping_id = cim.id
        WHERE cim.target_document_id = csl.document_id
          AND cim.entity_type = 'source_location'
          AND link.curriculum_source_document_id = $1
      )
    `, [sourceDoc.id]);
    
    const locations = locationsResult.rows;
    console.log(`✓ Found ${locations.length} source locations`);
    
    // Step 5: Get parent-child relationships
    console.log("Exporting parent-child relationships...");
    const parentLinksResult = await client.query(`
      SELECT
        cim_child.import_key as "childImportKey",
        cim_parent.import_key as "parentImportKey"
      FROM curriculum_sections_parent_lnk lnk
      INNER JOIN curriculum_sections cs_child 
        ON cs_child.id = lnk.curriculum_section_id
      INNER JOIN curriculum_sections cs_parent 
        ON cs_parent.id = lnk.inv_curriculum_section_id
      INNER JOIN curriculum_import_mappings cim_child
        ON cim_child.target_document_id = cs_child.document_id
        AND cim_child.entity_type = 'section'
      INNER JOIN curriculum_import_mappings cim_parent
        ON cim_parent.target_document_id = cs_parent.document_id
        AND cim_parent.entity_type = 'section'
      INNER JOIN curriculum_import_mappings_source_document_lnk link_child
        ON link_child.curriculum_import_mapping_id = cim_child.id
      INNER JOIN curriculum_import_mappings_source_document_lnk link_parent
        ON link_parent.curriculum_import_mapping_id = cim_parent.id
      WHERE link_child.curriculum_source_document_id = $1
        AND link_parent.curriculum_source_document_id = $1
    `, [sourceDoc.id]);
    
    const parentLinks = parentLinksResult.rows;
    console.log(`✓ Found ${parentLinks.length} parent-child relationships`);
    
    // Step 6: Get location-section relationships
    console.log("Exporting location-section relationships...");
    const locSectionLinksResult = await client.query(`
      SELECT
        cim_loc.import_key as "locationImportKey",
        cim_sec.import_key as "sectionImportKey"
      FROM curriculum_source_locations_section_lnk lnk
      INNER JOIN curriculum_source_locations csl 
        ON csl.id = lnk.curriculum_source_location_id
      INNER JOIN curriculum_sections cs 
        ON cs.id = lnk.curriculum_section_id
      INNER JOIN curriculum_import_mappings cim_loc
        ON cim_loc.target_document_id = csl.document_id
        AND cim_loc.entity_type = 'source_location'
      INNER JOIN curriculum_import_mappings cim_sec
        ON cim_sec.target_document_id = cs.document_id
        AND cim_sec.entity_type = 'section'
      INNER JOIN curriculum_import_mappings_source_document_lnk link_loc
        ON link_loc.curriculum_import_mapping_id = cim_loc.id
      INNER JOIN curriculum_import_mappings_source_document_lnk link_sec
        ON link_sec.curriculum_import_mapping_id = cim_sec.id
      WHERE link_loc.curriculum_source_document_id = $1
        AND link_sec.curriculum_source_document_id = $1
    `, [sourceDoc.id]);
    
    const locSectionLinks = locSectionLinksResult.rows;
    console.log(`✓ Found ${locSectionLinks.length} location-section relationships`);
    
    // Step 7: Build JSON structure
    const jsonData = {
      sourceDocument: {
        code: sourceDoc.code,
        title: sourceDoc.title
      },
      sections: sections.map(s => ({
        importKey: docToImportKey[s.documentId],
        title: s.title,
        body: s.body || null
      })),
      sourceLocations: locations.map(l => ({
        importKey: docToImportKey[l.documentId],
        startPage: l.startPage,
        endPage: l.endPage,
        locator: l.locator || null,
        excerpt: l.excerpt || null
      })),
      relationships: {
        parentChild: parentLinks,
        locationSection: locSectionLinks
      },
      metadata: {
        exportDate: new Date().toISOString(),
        totalSections: sections.length,
        totalLocations: locations.length,
        totalParentChildLinks: parentLinks.length,
        totalLocationSectionLinks: locSectionLinks.length
      }
    };
    
    // Step 8: Save to file
    const outputPath = path.join(
      __dirname,
      "COGI_Toan_2018_Cay_Lop_5_6_7_NoiDung_SoTuNhien_V1.json"
    );
    
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
    console.log(`\n✅ Exported to: ${outputPath}`);
    
    console.log("\n=== EXPORT SUMMARY ===");
    console.log(`✓ Sections: ${jsonData.metadata.totalSections}`);
    console.log(`✓ Source Locations: ${jsonData.metadata.totalLocations}`);
    console.log(`✓ Parent-Child Links: ${jsonData.metadata.totalParentChildLinks}`);
    console.log(`✓ Location-Section Links: ${jsonData.metadata.totalLocationSectionLinks}`);
    
  } catch (error) {
    console.error("\n❌ Export failed:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

exportCurriculumData()
  .then(() => process.exit(0))
  .catch(e => { 
    console.error(e); 
    process.exit(1); 
  });
