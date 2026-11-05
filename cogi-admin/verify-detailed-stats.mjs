import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'cogi_fw5',
  user: 'cogi_user',
  password: '123456@',
});

async function verify() {
  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');

    // ===== STEP 1: Số bản ghi vật lý =====
    console.log('=== STEP 1: Số bản ghi vật lý ===\n');
    
    const physicalCounts = {};
    for (const table of ['curriculum_sections', 'curriculum_source_locations', 'curriculum_import_mappings']) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM ${table}`);
      physicalCounts[table] = parseInt(res.rows[0].cnt);
    }
    
    console.log(`1. Bản ghi vật lý:`);
    Object.entries(physicalCounts).forEach(([table, cnt]) => {
      console.log(`   ${table}: ${cnt}`);
    });
    console.log();

    // ===== STEP 2: Số documentId duy nhất =====
    console.log('=== STEP 2: Số documentId logic duy nhất ===\n');
    
    const uniqueDocsRes = await client.query(`
      SELECT COUNT(DISTINCT document_id) as unique_count FROM curriculum_sections
    `);
    const uniqueDocs = parseInt(uniqueDocsRes.rows[0].unique_count);
    console.log(`2. DocumentIds duy nhất trong curriculum_sections: ${uniqueDocs}\n`);

    // ===== STEP 3: Số Draft/Published =====
    console.log('=== STEP 3: Số Draft / Published ===\n');
    
    const draftPublishedRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN published_at IS NULL THEN 1 END) as draft_count,
        COUNT(CASE WHEN published_at IS NOT NULL THEN 1 END) as published_count
      FROM curriculum_sections
    `);
    const { draft_count, published_count } = draftPublishedRes.rows[0];
    console.log(`3. Trạng thái trong curriculum_sections:`);
    console.log(`   Draft: ${draft_count}`);
    console.log(`   Published: ${published_count}`);
    console.log(`   Total: ${draft_count + published_count}\n`);

    // ===== STEP 4: Số khóa mapping duy nhất =====
    console.log('=== STEP 4: Số khóa mapping duy nhất (sourceDocument + entityType + importKey) ===\n');
    
    // Đầu tiên, kiểm tra có sourceDocument link không
    const mappingSampleRes = await client.query(`
      SELECT m.*, lnk.curriculum_source_document_id as source_doc_from_link
      FROM curriculum_import_mappings m
      LEFT JOIN curriculum_import_mappings_source_document_lnk lnk 
        ON m.id = lnk.curriculum_import_mapping_id
      LIMIT 3
    `);
    
    console.log(`   Sample mappings (first 3):`);
    mappingSampleRes.rows.forEach((row, idx) => {
      console.log(`   [${idx}] id=${row.id}, import_key=${row.import_key.substring(0,20)}, target_doc_id=${row.target_document_id}, source_doc_link=${row.source_doc_from_link}`);
    });
    console.log();

    const uniqueMappingKeysRes = await client.query(`
      SELECT COUNT(DISTINCT CONCAT(lnk.curriculum_source_document_id, '|', m.entity_type, '|', m.import_key)) as unique_keys
      FROM curriculum_import_mappings m
      LEFT JOIN curriculum_import_mappings_source_document_lnk lnk 
        ON m.id = lnk.curriculum_import_mapping_id
    `);
    const uniqueMappingKeys = parseInt(uniqueMappingKeysRes.rows[0].unique_keys);
    console.log(`4. Khóa mapping duy nhất (sourceDoc|entityType|importKey): ${uniqueMappingKeys}\n`);

    // ===== STEP 5: Số mapping có target hợp lệ =====
    console.log('=== STEP 5: Số mapping có target_document_id hợp lệ ===\n');
    
    const validTargetRes = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) as valid_targets,
        COUNT(CASE WHEN s.id IS NULL THEN 1 END) as invalid_targets
      FROM curriculum_import_mappings m
      LEFT JOIN curriculum_sections s ON m.target_document_id = s.document_id
    `);
    
    const { total, valid_targets, invalid_targets } = validTargetRes.rows[0];
    console.log(`5. Tính hợp lệ của target_document_id:`);
    console.log(`   Total mappings: ${total}`);
    console.log(`   ✓ Valid (section exists): ${valid_targets}`);
    console.log(`   ✗ Invalid (section NOT found): ${invalid_targets}`);
    console.log(`   Tỷ lệ lỗi: ${Math.round(invalid_targets * 100 / total)}%\n`);

    // ===== STEP 6: Kiểm tra target_document_id data type =====
    console.log('=== STEP 6: Loại dữ liệu target_document_id ===\n');
    
    const targetTypesRes = await client.query(`
      SELECT 
        CASE 
          WHEN target_document_id ~ '^[0-9]+$' THEN 'Numeric'
          WHEN LENGTH(target_document_id) > 10 THEN 'Long alphanumeric (Strapi)'
          ELSE 'Other'
        END as target_type,
        COUNT(*) as cnt
      FROM curriculum_import_mappings
      GROUP BY target_type
    `);
    
    console.log(`6. Phân loại target_document_id:`);
    targetTypesRes.rows.forEach(row => {
      console.log(`   ${row.target_type}: ${row.cnt}`);
    });
    console.log();

    // ===== STEP 7: Kiểm tra mapping trùng =====
    console.log('=== STEP 7: Số mapping bị trùng khóa nghiệp vụ ===\n');
    
    const duplicateMappingsRes = await client.query(`
      SELECT 
        lnk.curriculum_source_document_id,
        m.entity_type,
        m.import_key,
        COUNT(*) as cnt
      FROM curriculum_import_mappings m
      LEFT JOIN curriculum_import_mappings_source_document_lnk lnk 
        ON m.id = lnk.curriculum_import_mapping_id
      GROUP BY lnk.curriculum_source_document_id, m.entity_type, m.import_key
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `);
    
    console.log(`7. Mappings bị trùng (có >1 mapping cho cùng key):`);
    if (duplicateMappingsRes.rows.length === 0) {
      console.log(`   ✓ Không có trùng\n`);
    } else {
      console.log(`   ✗ Tìm thấy ${duplicateMappingsRes.rows.length} nhóm trùng:`);
      duplicateMappingsRes.rows.slice(0, 10).forEach(row => {
        console.log(`      sourceDoc=${row.curriculum_source_document_id} | ${row.entity_type} | ${row.import_key.substring(0,30)} → ${row.cnt} mappings`);
      });
      if (duplicateMappingsRes.rows.length > 10) {
        console.log(`      ... và ${duplicateMappingsRes.rows.length - 10} nhóm khác`);
      }
      console.log();
    }

    // ===== STEP 8: Chi tiết mapping theo Grade =====
    console.log('=== STEP 8: Chi tiết mapping cho G05, G06, G07 ===\n');
    
    const gradeDetailsRes = await client.query(`
      SELECT 
        SUBSTRING(m.import_key, 1, 10) as grade_key,
        COUNT(*) as total_mappings,
        COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) as valid_targets,
        COUNT(CASE WHEN s.id IS NULL THEN 1 END) as invalid_targets,
        CASE 
          WHEN COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) = COUNT(*) THEN '✓ OK'
          WHEN COUNT(CASE WHEN s.id IS NULL THEN 1 END) = COUNT(*) THEN '✗ ALL BROKEN'
          ELSE '⚠ PARTIAL'
        END as status
      FROM curriculum_import_mappings m
      LEFT JOIN curriculum_sections s ON m.target_document_id = s.document_id
      WHERE m.import_key LIKE 'SEC-V-3-G0[567]%'
      GROUP BY SUBSTRING(m.import_key, 1, 10)
      ORDER BY grade_key
    `);
    
    gradeDetailsRes.rows.forEach(row => {
      console.log(`   ${row.grade_key}:`);
      console.log(`      Total: ${row.total_mappings}, Valid: ${row.valid_targets}, Invalid: ${row.invalid_targets} ${row.status}`);
    });
    console.log();

    // ===== STEP 9: Tính thống kê tổng hợp =====
    console.log('=== STEP 9: Tóm tắt thống kê ===\n');
    
    console.log(`Physical records:`);
    console.log(`  - curriculum_sections: ${physicalCounts.curriculum_sections}`);
    console.log(`  - curriculum_source_locations: ${physicalCounts.curriculum_source_locations}`);
    console.log(`  - curriculum_import_mappings: ${physicalCounts.curriculum_import_mappings}`);
    console.log();
    console.log(`Logic unique identifiers:`);
    console.log(`  - Unique documentIds: ${uniqueDocs}`);
    console.log(`  - Unique mapping keys (sourceDoc|type|key): ${uniqueMappingKeys}`);
    console.log();
    console.log(`Data quality:`);
    console.log(`  - Valid mappings (target exists): ${valid_targets} (${Math.round(valid_targets * 100 / total)}%)`);
    console.log(`  - Invalid mappings (target NOT found): ${invalid_targets} (${Math.round(invalid_targets * 100 / total)}%)`);
    console.log();
    console.log(`Issues detected:`);
    console.log(`  - Duplicate mapping keys: ${duplicateMappingsRes.rows.length}`);
    console.log();

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

verify();
