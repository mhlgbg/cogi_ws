import { useState } from 'react'
import {
  createExamComponent as createExamComponentRequest,
  setExamComponentActive as setExamComponentActiveRequest,
  updateExamComponent as updateExamComponentRequest,
} from '../services/examComponentApi'

export default function useExamComponentMutations() {
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
    createExamComponent: (payload) => runMutation('create', () => createExamComponentRequest(payload)),
    updateExamComponent: (id, payload) => runMutation('update', () => updateExamComponentRequest(id, payload)),
    setExamComponentActive: (id, isActive) => runMutation('toggle-active', () => setExamComponentActiveRequest(id, isActive)),
  }
}