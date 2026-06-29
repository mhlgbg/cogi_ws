export default {
  routes: [
    {
      method: 'GET',
      path: '/learning-management/bootstrap',
      handler: 'learning-management.bootstrap',
      config: {
        auth: false,
        policies: [
          {
            name: 'global::has-tenant-permission',
            config: {
              key: 'learning.learning-object.manage',
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/learning-objects',
      handler: 'learning-management.listLearningObjects',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/learning-objects/:id',
      handler: 'learning-management.findOneLearningObject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/learning-objects',
      handler: 'learning-management.createLearningObject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/learning-objects/:id',
      handler: 'learning-management.updateLearningObject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/learning-objects/:id',
      handler: 'learning-management.deleteLearningObject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/subjects',
      handler: 'learning-management.listSubjects',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.subject.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/subjects',
      handler: 'learning-management.createSubject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.subject.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/subjects/:id',
      handler: 'learning-management.updateSubject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.subject.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/subjects/:id',
      handler: 'learning-management.deleteSubject',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.subject.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/grades',
      handler: 'learning-management.listGrades',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.grade.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/grades',
      handler: 'learning-management.createGrade',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.grade.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/grades/:id',
      handler: 'learning-management.updateGrade',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.grade.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/grades/:id',
      handler: 'learning-management.deleteGrade',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.grade.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/knowledge-nodes',
      handler: 'learning-management.listKnowledgeNodes',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/knowledge-nodes',
      handler: 'learning-management.createKnowledgeNode',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/skills',
      handler: 'learning-management.listSkills',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/skills',
      handler: 'learning-management.createSkill',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/formulas',
      handler: 'learning-management.listFormulas',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.formula.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/formulas',
      handler: 'learning-management.createFormula',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.formula.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/formulas/:id',
      handler: 'learning-management.updateFormula',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.formula.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/formulas/:id',
      handler: 'learning-management.deleteFormula',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.formula.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/visual-assets',
      handler: 'learning-management.listVisualAssets',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/visual-assets',
      handler: 'learning-management.createVisualAsset',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/learning-objects/:learningObjectId/content-blocks',
      handler: 'learning-management.listContentBlocks',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/content-blocks',
      handler: 'learning-management.createContentBlock',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/content-blocks/:id',
      handler: 'learning-management.updateContentBlock',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/content-blocks/:id',
      handler: 'learning-management.deleteContentBlock',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'GET',
      path: '/learning-management/questions',
      handler: 'learning-management.listQuestions',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.question.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/questions',
      handler: 'learning-management.createQuestion',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.question.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'PUT',
      path: '/learning-management/questions/:id',
      handler: 'learning-management.updateQuestion',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.question.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'DELETE',
      path: '/learning-management/questions/:id',
      handler: 'learning-management.deleteQuestion',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.question.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/question-options',
      handler: 'learning-management.createQuestionOption',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { keys: ['learning.question.manage', 'learning.learning-object.manage'] } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/learning-objects/:learningObjectId/attach-question',
      handler: 'learning-management.attachQuestion',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    },
    {
      method: 'POST',
      path: '/learning-management/learning-objects/:learningObjectId/detach-question',
      handler: 'learning-management.detachQuestion',
      config: {
        auth: false,
        policies: [{ name: 'global::has-tenant-permission', config: { key: 'learning.learning-object.manage' } }],
      },
    }
  ],
};
