import { useState } from 'react'
import {
  createOutcomeStandard as createOutcomeStandardRequest,
  setOutcomeStandardActive as setOutcomeStandardActiveRequest,
  updateOutcomeStandard as updateOutcomeStandardRequest,
} from '../services/outcomeStandardApi'

export default function useOutcomeStandardMutations() {
  const [activeMutation, setActiveMutation] = useState('')

  async function runMutation(type, action) {
    if (activeMutation) return null
    setActiveMutation(type)
    try {
      return await action()
    } finally {
      setActiveMutation('')
    }
  }

  return {
    activeMutation,
    createOutcomeStandard: (payload) => runMutation('create', () => createOutcomeStandardRequest(payload)),
    updateOutcomeStandard: (id, payload) => runMutation('update', () => updateOutcomeStandardRequest(id, payload)),
    setOutcomeStandardActive: (id, isActive) => runMutation('toggle-active', () => setOutcomeStandardActiveRequest(id, isActive)),
  }
}