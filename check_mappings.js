const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./cogi-admin/database.db');

db.serialize(() => {
  db.get(`
    SELECT id FROM curriculum_source_documents WHERE code = 'VN-GDPT2018-MATH-SOURCE-01'
  `, (err, doc) => {
    if (err) {
      console.error('Error finding document:', err);
      db.close();
      return;
    }
    if (!doc) {
      console.log('Document not found');
      db.close();
      return;
    }
    
    console.log('Document ID:', doc.id);
    
    db.get(`
      SELECT COUNT(*) as cnt FROM curriculum_import_mappings 
      WHERE source_document_id = ? AND entity_type = 'section'
    `, [doc.id], (err, row) => {
      if (err) console.error('Error:', err);
      else console.log('Section mappings count:', row?.cnt || 0);
      
      db.get(`
        SELECT COUNT(*) as cnt FROM curriculum_import_mappings 
        WHERE source_document_id = ? AND entity_type = 'location'
      `, [doc.id], (err, row) => {
        if (err) console.error('Error:', err);
        else console.log('Location mappings count:', row?.cnt || 0);
        
        db.all(`
          SELECT import_key, entity_type, target_document_id FROM curriculum_import_mappings 
          WHERE source_document_id = ? LIMIT 5
        `, [doc.id], (err, rows) => {
          if (err) console.error('Error:', err);
          else {
            console.log('\nSample mappings:');
            rows.forEach(row => console.log(` - ${row.entity_type}: ${row.import_key} -> ${row.target_document_id}`));
          }
          db.close();
        });
      });
    });
  });
});
