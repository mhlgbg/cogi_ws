import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInlineFillPlaceholderToken, extractInlineFillPlaceholders, validateInlineFillLayout } from '../src/modules/assessments/components/inlineFillLayoutUtils.js'

const entries = [
  { question: { code: 'PET1-T3-P2-L-PT3-Q14' } },
  { question: { code: 'PET1-T3-P2-L-PT3-Q15' } },
  { question: { code: 'PET1-T3-P2-L-PT3-Q16' } },
  { question: { code: 'PET1-T3-P2-L-PT3-Q17' } },
  { question: { code: 'PET1-T3-P2-L-PT3-Q18' } },
  { question: { code: 'PET1-T3-P2-L-PT3-Q19' } },
]

test('inline fill placeholder helpers extract PET part 3 tokens', () => {
  const html = '<p>Caspar\'s mother dances across a {{PET1-T3-P2-L-PT3-Q14}} in the circus.</p><p>{{PET1-T3-P2-L-PT3-Q15}}</p>'
  assert.equal(buildInlineFillPlaceholderToken('PET1-T3-P2-L-PT3-Q14'), '{{PET1-T3-P2-L-PT3-Q14}}')
  assert.deepEqual(extractInlineFillPlaceholders(html).map((item) => item.code), ['PET1-T3-P2-L-PT3-Q14', 'PET1-T3-P2-L-PT3-Q15'])
})

test('inline fill validation reports missing and unknown placeholders without crashing', () => {
  const html = `
    <h2>Caspar and the Circus Family</h2>
    <p>{{PET1-T3-P2-L-PT3-Q14}}</p>
    <p>{{PET1-T3-P2-L-PT3-Q15}}</p>
    <p>{{PET1-T3-P2-L-PT3-Q16}}</p>
    <p>{{PET1-T3-P2-L-PT3-Q17}}</p>
    <p>{{PET1-T3-P2-L-PT3-Q18}}</p>
    <p>{{UNKNOWN-Q20}}</p>
  `
  const result = validateInlineFillLayout(html, entries)
  assert.deepEqual(result.unknownCodes, ['UNKNOWN-Q20'])
  assert.deepEqual(result.missingQuestionCodes, ['PET1-T3-P2-L-PT3-Q19'])
  assert.equal(result.hasRenderablePlaceholders, true)
})

test('inline fill validation flags duplicate placeholders', () => {
  const html = '<p>{{PET1-T3-P2-L-PT3-Q14}} {{PET1-T3-P2-L-PT3-Q14}}</p>'
  const result = validateInlineFillLayout(html, entries)
  assert.deepEqual(result.duplicateCodes, ['PET1-T3-P2-L-PT3-Q14'])
})