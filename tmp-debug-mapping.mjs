import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'cogi_fw5',
  user: 'cogi_user',
  password: '123456@',
});

try {
  await client.connect();
  
  // Count total mappings
  const countRes = await client.query('SELECT COUNT(*) FROM curriculum_import_mapping');
  console.log('Total mappings:', countRes.rows[0].count);
  
  // Find mappings for sourceDocument VN-GDPT2018-MATH-SOURCE-01
  const mathRes = await client.query(`
    SELECT m.id, m."sourceDocument", m."entityType", m."importKey", m."targetDocumentId"
    FROM curriculum_import_mapping m
    JOIN curriculum_source_document d ON m."sourceDocument" = d.id
    WHERE d.code = 'VN-GDPT2018-MATH-SOURCE-01'
    LIMIT 10
  `);
  console.log('Math document mappings:', mathRes.rows.length);
  if (mathRes.rows.length > 0) {
    console.log(mathRes.rows.slice(0, 3));
  }
  
  // Check if SEC-V-3-G06-1-1-A mapping exists
  const secRes = await client.query(`
    SELECT m.id, m."sourceDocument", m."entityType", m."importKey", m."targetDocumentId"
    FROM curriculum_import_mapping m
    WHERE m."importKey" = 'SEC-V-3-G06-1-1-A' AND m."entityType" = 'section'
  `);
  console.log('SEC-V-3-G06-1-1-A mapping found:', secRes.rows.length > 0 ? secRes.rows[0] : 'NOT FOUND');
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await client.end();
}
