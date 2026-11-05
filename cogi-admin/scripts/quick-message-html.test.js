const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadHtmlHelper() {
  const modulePath = path.join(__dirname, '..', 'dist', 'src', 'api', 'quick-message', 'services', 'quick-message-html.js');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('quick message html: sanitizes fragments and full documents with whitelist policy', async () => {
  const helper = loadHtmlHelper();
  const sanitized = helper.sanitizeQuickMessageHtml(`<!DOCTYPE html>
  <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>ABC</title>
      <style>body{background:red}</style>
      <script>alert(1)</script>
    </head>
    <body>
      <h2 onclick="alert(1)">Thông báo</h2>
      <p>Nội dung <strong>quan trọng</strong></p>
      <a href="https://example.com" target="_self">Link tốt</a>
      <a href="mailto:test@example.com">Mail</a>
      <a href="javascript:alert(1)">Link xấu</a>
      <a href="data:text/html;base64,abc">Data</a>
      <iframe src="https://evil.example"></iframe>
      <table><thead><tr><th colspan="2">Ngày</th></tr></thead><tbody><tr><td rowspan="2">02/09</td><td>Khởi hành</td></tr></tbody></table>
    </body>
  </html>`);

  assert.match(sanitized, /<h2>Thông báo<\/h2>/);
  assert.match(sanitized, /<p>Nội dung <strong>quan trọng<\/strong><\/p>/);
  assert.match(sanitized, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">Link tốt<\/a>/);
  assert.match(sanitized, /<a href="mailto:test@example.com" target="_blank" rel="noopener noreferrer">Mail<\/a>/);
  assert.match(sanitized, /<table>/);
  assert.match(sanitized, /<th colspan="2">Ngày<\/th>/);
  assert.doesNotMatch(sanitized, /<!DOCTYPE/i);
  assert.doesNotMatch(sanitized, /<html/i);
  assert.doesNotMatch(sanitized, /<head/i);
  assert.doesNotMatch(sanitized, /<meta/i);
  assert.doesNotMatch(sanitized, /<title/i);
  assert.doesNotMatch(sanitized, /<style/i);
  assert.doesNotMatch(sanitized, /<script/i);
  assert.doesNotMatch(sanitized, /<iframe/i);
  assert.doesNotMatch(sanitized, /onclick=/i);
  assert.doesNotMatch(sanitized, /javascript:/i);
  assert.doesNotMatch(sanitized, /data:/i);
});

test('quick message html: keeps class and safe inline styles while stripping unsafe html', async () => {
  const helper = loadHtmlHelper();
  const sanitized = helper.sanitizeQuickMessageHtml(`
    <div class="test-box" style="background:#4668ad;color:#fff;padding:16px;border-radius:10px;position:fixed;background-image:url(javascript:alert(1))" onclick="alert(1)">
      TEST HTML STYLE
    </div>
    <script>alert(1)</script>
  `);

  assert.match(sanitized, /<div class="test-box" style="background:#4668ad;color:#fff;padding:16px;border-radius:10px">/);
  assert.match(sanitized, /TEST HTML STYLE/);
  assert.doesNotMatch(sanitized, /position\s*:/i);
  assert.doesNotMatch(sanitized, /background-image/i);
  assert.doesNotMatch(sanitized, /onclick=/i);
  assert.doesNotMatch(sanitized, /<script/i);
});

test('quick message html: body extraction keeps only body fragment', async () => {
  const helper = loadHtmlHelper();
  const fragment = helper.extractQuickMessageHtmlFragment('<html><head><title>ABC</title></head><body><div><p>Hello</p></div></body></html>');
  assert.equal(fragment, '<div><p>Hello</p></div>');
});