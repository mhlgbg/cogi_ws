import { useState } from 'react'
import {
  createExamSubject as createExamSubjectRequest,
  setExamSubjectActive as setExamSubjectActiveRequest,
  updateExamSubject as updateExamSubjectRequest,
} from '../services/examSubjectApi'

export default function useExamSubjectMutations() {
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
    createExamSubject: (payload) => runMutation('create', () => createExamSubjectRequest(payload)),
    updateExamSubject: (id, payload) => runMutation('update', () => updateExamSubjectRequest(id, payload)),
    setExamSubjectActive: (id, isActive) => runMutation('toggle-active', () => setExamSubjectActiveRequest(id, isActive)),
  }
}