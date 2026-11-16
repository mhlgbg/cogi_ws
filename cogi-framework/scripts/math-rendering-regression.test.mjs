import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMathDelimitedText, renderMathExpressionToHtml } from '../src/components/math/mathRendering.js'

test('parses node title formula with escaped backslash delimiter content', () => {
  const segments = parseMathDelimitedText('Toán 8: $a\\ne 0$')
  const mathSegments = segments.filter((segment) => segment.type === 'math')

  assert.equal(mathSegments.length, 1)
  assert.equal(mathSegments[0].value, 'a\\ne 0')
  assert.equal(mathSegments[0].displayMode, false)
})

test('parses node title formula when \\n was converted to real newline', () => {
  const segments = parseMathDelimitedText('Toán 8: $a\ne 0$')
  const mathSegments = segments.filter((segment) => segment.type === 'math')

  assert.equal(mathSegments.length, 1)
  assert.equal(mathSegments[0].value, 'a\ne 0')
})

test('normalizes newline-escaped latex command before KaTeX render', () => {
  const htmlFromEscaped = renderMathExpressionToHtml('a\\ne 0', { displayMode: false })
  const htmlFromNewline = renderMathExpressionToHtml('a\ne 0', { displayMode: false })

  assert.ok(htmlFromEscaped.includes('katex'))
  assert.ok(htmlFromNewline.includes('katex'))
  assert.equal(htmlFromNewline, htmlFromEscaped)
})

test('does not treat currency suffix dollar as math opening', () => {
  const segments = parseMathDelimitedText('Giá 100$ và $x+1$')
  const mathSegments = segments.filter((segment) => segment.type === 'math')

  assert.equal(mathSegments.length, 1)
  assert.equal(mathSegments[0].value, 'x+1')
})

