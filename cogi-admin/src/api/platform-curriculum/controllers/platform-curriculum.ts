const curriculumService = new Proxy({} as any, {
  get(_target, prop) {
    const service = strapi.service('api::platform-curriculum.platform-curriculum' as any) as any;
    if (!service) {
      throw new Error('Curriculum service is not available');
    }
    const value = service[prop as keyof typeof service];
    return typeof value === 'function' ? value.bind(service) : value;
  },
});

function normalizeHttpStatus(error: any) {
  const explicitStatus = Number(error?.status);
  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600) {
    return explicitStatus;
  }

  const message = String(error?.message || '');
  if (/required|must point|already exists|not found|must be one of|cannot|immutable|not implemented/i.test(message)) {
    return 400;
  }

  return 500;
}

export default {
  async listCurricula(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listCurricula(ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curricula',
        },
      }
    }
  },

  async getCurriculumDetail(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.getCurriculumDetail(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum detail',
        },
      }
    }
  },

  async createCurriculum(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createCurriculum(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create curriculum',
        },
      }
    }
  },

  async updateCurriculum(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateCurriculum(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update curriculum',
        },
      }
    }
  },

  async deleteCurriculum(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteCurriculum(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete curriculum',
        },
      }
    }
  },

  async listCatalog(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listCatalog(ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum catalog',
        },
      }
    }
  },

  async listSubjects(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-subject.curriculum-subject', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum subjects',
        },
      }
    }
  },

  async createSubject(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createSubject(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create subject',
        },
      }
    }
  },

  async updateSubject(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateSubject(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update subject',
        },
      }
    }
  },

  async deleteSubject(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteSubject(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete subject',
        },
      }
    }
  },

  async listEducationLevels(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::education-level.education-level', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load education levels',
        },
      }
    }
  },

  async createEducationLevel(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createEducationLevel(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create education level',
        },
      }
    }
  },

  async updateEducationLevel(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateEducationLevel(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update education level',
        },
      }
    }
  },

  async deleteEducationLevel(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteEducationLevel(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete education level',
        },
      }
    }
  },

  async listGrades(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-grade.curriculum-grade', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum grades',
        },
      }
    }
  },

  async createGrade(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createGrade(payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create grade',
        },
      }
    }
  },

  async updateGrade(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateGrade(ctx.params?.id, payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update grade',
        },
      }
    }
  },

  async deleteGrade(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteGrade(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete grade',
        },
      }
    }
  },

  async listVersions(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::subject-curriculum-version.subject-curriculum-version', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum versions',
        },
      }
    }
  },

  async createVersion(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createVersion(payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create curriculum version',
        },
      }
    }
  },

  async updateVersion(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateVersion(ctx.params?.id, payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update curriculum version',
        },
      }
    }
  },

  async deleteVersion(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteVersion(ctx.params?.id) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete curriculum version',
        },
      }
    }
  },

  async listScopes(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-scope.curriculum-scope', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum scopes',
        },
      }
    }
  },

  async createScope(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createScope(payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create curriculum scope',
        },
      }
    }
  },

  async updateScope(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateScope(ctx.params?.id, payload) }
    } catch (error: any) {
      const status = normalizeHttpStatus(error)
      ctx.status = status
      ctx.body = {
        data: null,
        error: {
          status,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update curriculum scope',
        },
      }
    }
  },

  async deleteScope(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteScope(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete curriculum scope',
        },
      }
    }
  },

  async listDocuments(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-source-document.curriculum-source-document', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load source documents',
        },
      }
    }
  },

  async createDocument(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createDocument(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create source document',
        },
      }
    }
  },

  async updateDocument(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateDocument(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update source document',
        },
      }
    }
  },

  async deleteDocument(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteDocument(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete source document',
        },
      }
    }
  },

  async listSections(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-section.curriculum-section', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load curriculum sections',
        },
      }
    }
  },

  async createSection(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createSection(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create curriculum section',
        },
      }
    }
  },

  async updateSection(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateSection(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update curriculum section',
        },
      }
    }
  },

  async deleteSection(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteSection(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete curriculum section',
        },
      }
    }
  },

  async listLocations(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.listEntity('api::curriculum-source-location.curriculum-source-location', ctx.query || {}) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to load source locations',
        },
      }
    }
  },

  async createLocation(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.createLocation(payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to create source location',
        },
      }
    }
  },

  async updateLocation(ctx: any) {
    try {
      const payload = ctx.request?.body?.data || ctx.request?.body || {}
      ctx.body = { data: await curriculumService.updateLocation(ctx.params?.id, payload) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to update source location',
        },
      }
    }
  },

  async deleteLocation(ctx: any) {
    try {
      ctx.body = { data: await curriculumService.deleteLocation(ctx.params?.id) }
    } catch (error: any) {
      ctx.status = error?.status || 500
      ctx.body = {
        data: null,
        error: {
          status: error?.status || 500,
          name: error?.name || 'ApplicationError',
          message: error?.message || 'Failed to delete source location',
        },
      }
    }
  },
}
