import test from 'node:test'
import assert from 'node:assert/strict'

const { extractQuickMessageHtmlFragment, sanitizeQuickMessageHtml } = await import('../src/modules/crm/components/quickMessageHtml.js')
const { getQuickMessageRenderedHtml, normalizeQuickMessageContentType } = await import('../src/modules/crm/components/quickMessageUi.js')
const { sanitizeClassSessionContentHtml, getClassSessionContentPreview } = await import('../src/modules/class-management/utils/classSessionContentHtml.js')

test('quick message html frontend helper sanitizes full documents for preview', () => {
  const html = sanitizeQuickMessageHtml(`<!DOCTYPE html><html><head><title>X</title><script>alert(1)</script></head><body><h2 onclick="alert(1)">Hello</h2><a href="javascript:alert(1)">Bad</a><table><tr><td>1</td></tr></table></body></html>`)
  assert.match(html, /<h2>Hello<\/h2>/)
  assert.match(html, /<table>/)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /onclick=/i)
  assert.doesNotMatch(html, /javascript:/i)
})

test('quick message html frontend helper extracts body content only', () => {
  assert.equal(extractQuickMessageHtmlFragment('<html><body><p>Only body</p></body></html>'), '<p>Only body</p>')
})

test('quick message html frontend helper keeps legacy html-looking text literal unless contentType is html', () => {
  assert.equal(normalizeQuickMessageContentType(undefined), 'text')
  assert.equal(getQuickMessageRenderedHtml('<h1>Hello</h1>', 'text'), '')
  assert.match(getQuickMessageRenderedHtml('<h1>Hello</h1>', 'html'), /<h1>Hello<\/h1>/)
})

test('quick message html frontend helper keeps safe layout styles for rich quick messages', () => {
  const html = sanitizeQuickMessageHtml(`
    <div style="max-width:980px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.45">
      <section style="border:1px solid #d6deeb;border-radius:10px;overflow:hidden;margin:0 0 12px;background:#fff">
        <div class="day-head" style="display:table;width:100%;table-layout:fixed;background:#4668ad;color:#fff;position:fixed;background-image:url(javascript:alert(1))">
          <div style="display:table-cell;vertical-align:middle;padding:10px 11px;font-size:14px">02/09</div>
        </div>
      </section>
      <script>alert(1)</script>
    </div>
  `)

  assert.match(html, /<div style="max-width:980px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.45">/)
  assert.match(html, /<section style="border:1px solid #d6deeb;border-radius:10px;overflow:hidden;margin:0 0 12px;background:#fff">/)
  assert.match(html, /<div class="day-head" style="display:table;width:100%;table-layout:fixed;background:#4668ad;color:#fff">/)
  assert.match(html, /<div style="display:table-cell;vertical-align:middle;padding:10px 11px;font-size:14px">02\/09<\/div>/)
  assert.doesNotMatch(html, /position\s*:/i)
  assert.doesNotMatch(html, /background-image/i)
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /<script/i)
})

test('assignment html helpers keep rich detail content and shorten list preview safely', () => {
  const richHtml = '<p>Hướng dẫn <strong>quan trọng</strong>.</p><ul><li>Xem <a href="https://example.com/a">link A</a></li><li>Xem <a href="https://example.com/b">link B</a></li></ul>'
  const detailHtml = sanitizeClassSessionContentHtml(richHtml)
  const preview = getClassSessionContentPreview(richHtml, 40)

  assert.match(detailHtml, /<strong>quan trọng<\/strong>/)
  assert.match(detailHtml, /href="https:\/\/example.com\/a"/)
  assert.match(detailHtml, /target="_blank"/)
  assert.match(detailHtml, /rel="noopener noreferrer"/)
  assert.equal(preview.includes('<a'), false)
  assert.equal(preview.includes('<strong'), false)
  assert.match(preview, /Hướng dẫn\s+quan trọng\s*\./)
})

test('assignment html helpers preserve legacy plain text content', () => {
  const plainText = 'Dong 1\n\nDong 2 voi link https://example.com'
  const detailHtml = sanitizeClassSessionContentHtml(plainText)
  const preview = getClassSessionContentPreview(plainText, 80)

  assert.match(detailHtml, /<p>Dong 1<\/p><p>Dong 2 voi link https:\/\/example.com<\/p>/)
  assert.equal(preview, 'Dong 1 Dong 2 voi link https://example.com')
})