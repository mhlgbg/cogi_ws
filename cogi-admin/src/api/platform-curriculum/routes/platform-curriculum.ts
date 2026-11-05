export default {
  routes: [
    {
      method: 'GET',
      path: '/platform/curriculums',
      handler: 'platform-curriculum.listCurricula',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/catalog',
      handler: 'platform-curriculum.listCatalog',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/:id',
      handler: 'platform-curriculum.getCurriculumDetail',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums',
      handler: 'platform-curriculum.createCurriculum',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/:id',
      handler: 'platform-curriculum.updateCurriculum',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/:id',
      handler: 'platform-curriculum.deleteCurriculum',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/subjects',
      handler: 'platform-curriculum.listSubjects',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/subjects',
      handler: 'platform-curriculum.createSubject',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/subjects/:id',
      handler: 'platform-curriculum.updateSubject',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/subjects/:id',
      handler: 'platform-curriculum.deleteSubject',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/education-levels',
      handler: 'platform-curriculum.listEducationLevels',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/education-levels',
      handler: 'platform-curriculum.createEducationLevel',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/education-levels/:id',
      handler: 'platform-curriculum.updateEducationLevel',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/education-levels/:id',
      handler: 'platform-curriculum.deleteEducationLevel',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/grades',
      handler: 'platform-curriculum.listGrades',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/grades',
      handler: 'platform-curriculum.createGrade',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/grades/:id',
      handler: 'platform-curriculum.updateGrade',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/grades/:id',
      handler: 'platform-curriculum.deleteGrade',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/versions',
      handler: 'platform-curriculum.listVersions',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/versions',
      handler: 'platform-curriculum.createVersion',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/versions/:id',
      handler: 'platform-curriculum.updateVersion',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/versions/:id',
      handler: 'platform-curriculum.deleteVersion',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/scopes',
      handler: 'platform-curriculum.listScopes',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/scopes',
      handler: 'platform-curriculum.createScope',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/scopes/:id',
      handler: 'platform-curriculum.updateScope',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/scopes/:id',
      handler: 'platform-curriculum.deleteScope',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/documents',
      handler: 'platform-curriculum.listDocuments',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/documents',
      handler: 'platform-curriculum.createDocument',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/documents/:id',
      handler: 'platform-curriculum.updateDocument',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/documents/:id',
      handler: 'platform-curriculum.deleteDocument',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/sections',
      handler: 'platform-curriculum.listSections',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/sections',
      handler: 'platform-curriculum.createSection',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/sections/:id',
      handler: 'platform-curriculum.updateSection',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/sections/:id',
      handler: 'platform-curriculum.deleteSection',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'GET',
      path: '/platform/curriculums/locations',
      handler: 'platform-curriculum.listLocations',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'POST',
      path: '/platform/curriculums/locations',
      handler: 'platform-curriculum.createLocation',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'PUT',
      path: '/platform/curriculums/locations/:id',
      handler: 'platform-curriculum.updateLocation',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
    {
      method: 'DELETE',
      path: '/platform/curriculums/locations/:id',
      handler: 'platform-curriculum.deleteLocation',
      config: {
        auth: false,
        middlewares: ['global::is-platform-admin'],
      },
    },
  ],
}
