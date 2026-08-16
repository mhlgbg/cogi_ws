import { useState } from 'react'
import {
  createExamProgram as createExamProgramRequest,
  setExamProgramActive as setExamProgramActiveRequest,
  updateExamProgram as updateExamProgramRequest,
} from '../services/examProgramApi'

export default function useExamProgramMutations() {
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
    createExamProgram: (payload) => runMutation('create', () => createExamProgramRequest(payload)),
    updateExamProgram: (id, payload) => runMutation('update', () => updateExamProgramRequest(id, payload)),
    setExamProgramActive: (id, isActive) => runMutation('toggle-active', () => setExamProgramActiveRequest(id, isActive)),
  }
}