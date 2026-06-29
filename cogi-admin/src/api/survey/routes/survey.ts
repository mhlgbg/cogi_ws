export default {
  routes: [
    {
      method: 'GET',
      path: '/survey/my-assignments',
      handler: 'survey.myAssignments',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/survey/assignment/:id',
      handler: 'survey.getAssignment',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/survey/save-draft',
      handler: 'survey.saveDraft',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/survey-responses/:responseId/answers/batch',
      handler: 'survey.saveAnswersBatch',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/survey-responses/:responseId/answers/batch',
      handler: 'survey.saveAnswersBatch',
      config: {
        auth: false,
      },
    },
    {
      method: 'PATCH',
      path: '/survey-responses/:responseId/answers/batch',
      handler: 'survey.saveAnswersBatch',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/survey/submit',
      handler: 'survey.submit',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/survey/submit',
      handler: 'survey.submit',
      config: {
        auth: false,
      },
    },
    {
      method: 'PATCH',
      path: '/survey/submit',
      handler: 'survey.submit',
      config: {
        auth: false,
      },
    },
  ],
};