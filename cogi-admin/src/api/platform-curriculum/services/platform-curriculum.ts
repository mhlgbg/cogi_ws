const CURRICULUM_UID = 'api::curriculum.curriculum';
const SUBJECT_UID = 'api::curriculum-subject.curriculum-subject';
const EDUCATION_LEVEL_UID = 'api::education-level.education-level';
const GRADE_UID = 'api::curriculum-grade.curriculum-grade';
const VERSION_UID = 'api::subject-curriculum-version.subject-curriculum-version';
const SCOPE_UID = 'api::curriculum-scope.curriculum-scope';
const DOCUMENT_UID = 'api::curriculum-source-document.curriculum-source-document';
const SECTION_UID = 'api::curriculum-section.curriculum-section';
const LOCATION_UID = 'api::curriculum-source-location.curriculum-source-location';

const FORBIDDEN_VERSION_FIELDS = new Set(['publishedAt', 'publishedBy', 'contentHash']);
const FORBIDDEN_TARGETS = new Set(['published', 'superseded']);

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function ensureStatusValue(value: unknown, allowed: string[], field: string) {
  const nextValue = toStringValue(value);
  if (!nextValue) return allowed[0];
  if (!allowed.includes(nextValue)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return nextValue;
}

function normalizePayload(input: Record<string, any> | null | undefined) {
  const next = { ...(input || {}) };
  for (const field of FORBIDDEN_VERSION_FIELDS) {
    delete next[field];
  }
  return next;
}

async function findOne(uid: string, id: number | string) {
  const normalizedId = toPositiveInt(id);
  if (!normalizedId) {
    throw new Error(`${uid} is missing a valid id`);
  }

  return strapi.db.query(uid).findOne({
    where: { id: normalizedId },
    select: ['id'],
  });
}

async function ensureExists(uid: string, id: number | string, label: string) {
  const normalizedId = toPositiveInt(id);
  if (!normalizedId) {
    throw new Error(`${label} must point to a valid record`);
  }

  const row = await findOne(uid, normalizedId);
  if (!row?.id) {
    throw new Error(`${label} not found`);
  }
  return row;
}

async function ensureUnique(uid: string, field: string, value: unknown, excludeId?: number | string, context?: string) {
  const text = toStringValue(value);
  if (!text) return;

  const rows = await strapi.db.query(uid).findMany({
    where: { [field]: text },
    select: ['id'],
  });

  const duplicate = rows.find((row: any) => String(row.id) !== String(excludeId));
  if (duplicate) {
    throw new Error(`${context || field} already exists`);
  }
}

async function ensureVersionCodeUnique(curriculumId: number | string, subjectId: number | string, versionCode: unknown, excludeId?: number | string) {
  const text = toStringValue(versionCode);
  if (!text) return;

  const rows = await strapi.db.query(VERSION_UID).findMany({
    where: { versionCode: text },
    populate: ['curriculum', 'subject'],
    select: ['id'],
  });

  const duplicate = rows.find((row: any) => {
    const curriculumFromRow = Array.isArray(row?.curriculum) ? row.curriculum[0] : row?.curriculum;
    const subjectFromRow = Array.isArray(row?.subject) ? row.subject[0] : row?.subject;
    const sameCurriculum = String(curriculumFromRow?.id ?? curriculumFromRow) === String(curriculumId)
    const sameSubject = String(subjectFromRow?.id ?? subjectFromRow) === String(subjectId)
    return String(row.id) !== String(excludeId) && sameCurriculum && sameSubject;
  });

  if (duplicate) {
    throw new Error('Version code already exists for this curriculum + subject');
  }
}

async function ensureScopeUnique(versionId: number | string, gradeId: number | string, excludeId?: number | string) {
  const rows = await strapi.db.query(SCOPE_UID).findMany({
    where: { subjectCurriculumVersion: Number(versionId), curriculumGrade: Number(gradeId) },
    select: ['id'],
  });

  const duplicate = rows.find((row: any) => String(row.id) !== String(excludeId));
  if (duplicate) {
    throw new Error('Curriculum scope already exists for this version and grade');
  }
}

async function validateReferences(uid: string, payload: Record<string, any>, required: string[]) {
  for (const field of required) {
    const raw = payload[field];
    if (raw === null || raw === undefined || raw === '') {
      throw new Error(`${field} is required`);
    }

    const id = toPositiveInt(raw?.id ?? raw);
    if (!id) {
      throw new Error(`${field} must point to a valid record`);
    }
    await ensureExists(uid, id, field);
  }
}

async function denyIfPublishedVersion(versionId: number | string) {
  const version = await strapi.db.query(VERSION_UID).findOne({
    where: { id: Number(versionId) },
    select: ['id', 'status'],
  });

  if (version && FORBIDDEN_TARGETS.has(String(version.status || ''))) {
    throw new Error('Published or superseded versions are immutable');
  }
}

async function validateCurriculum(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const title = toText(payload.title || payload.name);
  const code = toText(payload.code);

  if (!code) throw new Error('code is required');
  if (!title) throw new Error('title is required');

  await ensureUnique(CURRICULUM_UID, 'code', code, excludeId, 'Curriculum code');
  return {
    ...payload,
    code,
    title,
    status: ensureStatusValue(payload.status, ['draft', 'active', 'archived'], 'status'),
    description: payload.description ?? null,
  };
}

async function validateSubject(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const code = toText(payload.code);
  const name = toText(payload.name);

  if (!code) throw new Error('code is required');
  if (!name) throw new Error('name is required');

  await ensureUnique(SUBJECT_UID, 'code', code, excludeId, 'Curriculum Subject code');
  return {
    ...payload,
    code,
    name,
    description: payload.description ?? null,
  };
}

async function validateEducationLevel(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const code = toText(payload.code);
  const name = toText(payload.name);

  if (!code) throw new Error('code is required');
  if (!name) throw new Error('name is required');

  await ensureUnique(EDUCATION_LEVEL_UID, 'code', code, excludeId, 'Education Level code');
  return {
    ...payload,
    code,
    name,
    description: payload.description ?? null,
  };
}

async function validateGrade(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const code = toText(payload.code);
  const name = toText(payload.name);
  const educationLevelId = toPositiveInt(payload.educationLevel?.id ?? payload.educationLevel ?? payload.education_level_id ?? payload.educationLevelId);

  if (!code) throw new Error('code is required');
  if (!name) throw new Error('name is required');
  if (!educationLevelId) throw new Error('educationLevel is required');

  await ensureExists(EDUCATION_LEVEL_UID, educationLevelId, 'educationLevel');
  await ensureUnique(GRADE_UID, 'code', code, excludeId, 'Curriculum Grade code');

  return {
    ...payload,
    code,
    name,
    gradeNumber: Number(payload.gradeNumber ?? 0),
    sortOrder: Number(payload.sortOrder ?? 0),
    educationLevel: educationLevelId,
  };
}

async function validateVersion(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const curriculumId = toPositiveInt(payload.curriculum?.id ?? payload.curriculum ?? payload.curriculumId);
  const subjectId = toPositiveInt(payload.subject?.id ?? payload.subject ?? payload.subjectId);
  const versionCode = toText(payload.versionCode);

  if (!curriculumId) throw new Error('curriculum is required');
  if (!subjectId) throw new Error('subject is required');
  if (!versionCode) throw new Error('versionCode is required');

  await ensureExists(CURRICULUM_UID, curriculumId, 'curriculum');
  await ensureExists(SUBJECT_UID, subjectId, 'subject');
  await ensureVersionCodeUnique(curriculumId, subjectId, versionCode, excludeId);

  const normalizedStatus = ensureStatusValue(payload.status ?? 'draft', ['draft'], 'status');
  if (payload.status === 'review') {
    throw new Error('Review workflow is not implemented in M1.2. Only draft versions are supported.');
  }

  if (payload.status && FORBIDDEN_TARGETS.has(String(payload.status))) {
    throw new Error('Published and superseded states cannot be written through the draft API');
  }

  return {
    ...payload,
    curriculum: curriculumId,
    subject: subjectId,
    versionCode,
    versionLabel: toText(payload.versionLabel) || null,
    status: normalizedStatus,
    description: payload.description ?? null,
    supersedesVersion: payload.supersedesVersion ? toPositiveInt(payload.supersedesVersion?.id ?? payload.supersedesVersion) : null,
  };
}

async function validateScope(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const versionId = toPositiveInt(payload.subjectCurriculumVersion?.id ?? payload.subjectCurriculumVersion ?? payload.versionId ?? payload.subjectCurriculumVersionId);
  const gradeId = toPositiveInt(payload.curriculumGrade?.id ?? payload.curriculumGrade ?? payload.gradeId ?? payload.curriculumGradeId);
  const code = toText(payload.code);

  if (!versionId) throw new Error('subjectCurriculumVersion is required');
  if (!gradeId) throw new Error('curriculumGrade is required');
  if (!code) throw new Error('code is required');

  await ensureExists(VERSION_UID, versionId, 'subjectCurriculumVersion');
  await ensureExists(GRADE_UID, gradeId, 'curriculumGrade');
  await ensureUnique(SCOPE_UID, 'code', code, excludeId, 'Curriculum Scope code');
  await ensureScopeUnique(versionId, gradeId, excludeId);

  return {
    ...payload,
    code,
    subjectCurriculumVersion: versionId,
    curriculumGrade: gradeId,
    sortOrder: Number(payload.sortOrder ?? 0),
    status: ensureStatusValue(payload.status ?? 'draft', ['draft', 'active', 'archived'], 'status'),
  };
}

async function validateDocument(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const title = toText(payload.title);
  const code = toText(payload.code);

  if (!title) throw new Error('title is required');
  if (!code) throw new Error('code is required');

  await ensureUnique(DOCUMENT_UID, 'code', code, excludeId, 'Curriculum Source Document code');

  const safeFileRef = payload.fileRef !== undefined && payload.fileRef !== null ? toText(payload.fileRef) || null : null;
  const safeChecksum = payload.checksum !== undefined && payload.checksum !== null ? null : null;

  return {
    ...payload,
    code,
    title,
    documentNumber: payload.documentNumber ?? null,
    issuedDate: payload.issuedDate ?? null,
    description: payload.description ?? null,
    fileRef: safeFileRef,
    checksum: safeChecksum,
    status: ensureStatusValue(payload.status ?? 'draft', ['draft', 'active', 'archived'], 'status'),
  };
}

async function checkSectionHierarchy(parentId: number, sourceDocumentId: number, excludeId?: number | string) {
  const visited = new Set<string>();
  let currentParent = parentId;

  while (currentParent) {
    const currentKey = String(currentParent);
    if (visited.has(currentKey)) {
      throw new Error('A section cannot create a parent cycle');
    }
    visited.add(currentKey);

    if (String(currentParent) === String(excludeId)) {
      throw new Error('A section cannot reference itself as parent');
    }

    const row = await strapi.db.query(SECTION_UID).findOne({
      where: { id: Number(currentParent) },
      populate: ['sourceDocument', 'parent'],
      select: ['id', 'sourceDocument', 'parent'],
    });

    if (!row) {
      throw new Error('parent section not found');
    }

    const rowDocumentId = toPositiveInt(row.sourceDocument?.id ?? row.sourceDocument);
    if (rowDocumentId && String(rowDocumentId) !== String(sourceDocumentId)) {
      throw new Error('Parent section must belong to the same source document');
    }

    const nextParent = row.parent && typeof row.parent === 'object' ? toPositiveInt(row.parent.id ?? row.parent) : toPositiveInt(row.parent);
    if (!nextParent) {
      break;
    }
    currentParent = nextParent;
  }
}

async function validateSection(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const sourceDocumentId = toPositiveInt(payload.sourceDocument?.id ?? payload.sourceDocument ?? payload.sourceDocumentId);
  const title = toText(payload.title);
  const parentId = payload.parent && typeof payload.parent === 'object' ? toPositiveInt(payload.parent.id ?? payload.parent) : toPositiveInt(payload.parent);

  if (!sourceDocumentId) throw new Error('sourceDocument is required');
  if (!title) throw new Error('title is required');
  if (parentId && String(parentId) === String(excludeId)) {
    throw new Error('A section cannot reference itself as parent');
  }

  await ensureExists(DOCUMENT_UID, sourceDocumentId, 'sourceDocument');
  if (parentId) {
    await ensureExists(SECTION_UID, parentId, 'parent');
    await checkSectionHierarchy(parentId, sourceDocumentId, excludeId);
  }

  return {
    ...payload,
    title,
    sectionType: payload.sectionType ?? null,
    body: payload.body ?? null,
    sortOrder: Number(payload.sortOrder ?? 0),
    sourceDocument: sourceDocumentId,
    parent: parentId ?? null,
  };
}

async function validateLocation(input: Record<string, any>, excludeId?: number | string) {
  const payload = normalizePayload(input);
  const sourceDocumentId = toPositiveInt(payload.sourceDocument?.id ?? payload.sourceDocument ?? payload.sourceDocumentId);
  const sectionId = payload.section && typeof payload.section === 'object' ? toPositiveInt(payload.section.id ?? payload.section) : toPositiveInt(payload.section);
  const startPage = payload.startPage !== undefined && payload.startPage !== null ? Number(payload.startPage) : null;
  const endPage = payload.endPage !== undefined && payload.endPage !== null ? Number(payload.endPage) : null;

  if (!sourceDocumentId) throw new Error('sourceDocument is required');
  await ensureExists(DOCUMENT_UID, sourceDocumentId, 'sourceDocument');
  if (sectionId) {
    const section = await strapi.db.query(SECTION_UID).findOne({
      where: { id: Number(sectionId) },
      populate: ['sourceDocument'],
      select: ['id', 'sourceDocument'],
    });
    if (!section) {
      throw new Error('section not found');
    }
    const sectionDocumentId = toPositiveInt(section.sourceDocument?.id ?? section.sourceDocument);
    if (sectionDocumentId && String(sectionDocumentId) !== String(sourceDocumentId)) {
      throw new Error('Section must belong to the same source document');
    }
  }

  if (startPage !== null && Number.isNaN(startPage)) {
    throw new Error('startPage must be a valid integer');
  }
  if (endPage !== null && Number.isNaN(endPage)) {
    throw new Error('endPage must be a valid integer');
  }
  if (startPage !== null && endPage !== null && endPage < startPage) {
    throw new Error('endPage cannot be smaller than startPage');
  }

  return {
    ...payload,
    sourceDocument: sourceDocumentId,
    section: sectionId ?? null,
    startPage,
    endPage,
    locator: payload.locator ?? null,
    excerpt: payload.excerpt ?? null,
  };
}

async function deleteIfNoReferences(uid: string, id: number | string) {
  if (uid === CURRICULUM_UID) {
    const versions = await strapi.db.query(VERSION_UID).findMany({
      where: { curriculum: Number(id) },
      select: ['id'],
    });
    if (versions.length > 0) {
      throw new Error('Cannot delete curriculum while subject curriculum versions still reference it');
    }
  }

  if (uid === SUBJECT_UID) {
    const versions = await strapi.db.query(VERSION_UID).findMany({
      where: { subject: Number(id) },
      select: ['id'],
    });
    if (versions.length > 0) {
      throw new Error('Cannot delete subject while subject curriculum versions still reference it');
    }
  }

  if (uid === EDUCATION_LEVEL_UID) {
    const grades = await strapi.db.query(GRADE_UID).findMany({
      where: { educationLevel: Number(id) },
      select: ['id'],
    });
    if (grades.length > 0) {
      throw new Error('Cannot delete education level while grades still reference it');
    }
  }

  if (uid === GRADE_UID) {
    const scopes = await strapi.db.query(SCOPE_UID).findMany({
      where: { curriculumGrade: Number(id) },
      select: ['id'],
    });
    if (scopes.length > 0) {
      throw new Error('Cannot delete grade while curriculum scopes still reference it');
    }
  }

  if (uid === VERSION_UID) {
    await denyIfPublishedVersion(id);
    const scopes = await strapi.db.query(SCOPE_UID).findMany({
      where: { subjectCurriculumVersion: Number(id) },
      select: ['id'],
    });
    if (scopes.length > 0) {
      throw new Error('Cannot delete version while curriculum scopes still reference it');
    }
  }

  if (uid === SCOPE_UID) {
    // no further references to enforce
  }

  if (uid === DOCUMENT_UID) {
    const sections = await strapi.db.query(SECTION_UID).findMany({
      where: { sourceDocument: Number(id) },
      select: ['id'],
    });
    const locations = await strapi.db.query(LOCATION_UID).findMany({
      where: { sourceDocument: Number(id) },
      select: ['id'],
    });
    if (sections.length > 0 || locations.length > 0) {
      throw new Error('Cannot delete source document while sections or locations still reference it');
    }
  }

  if (uid === SECTION_UID) {
    const childSections = await strapi.db.query(SECTION_UID).findMany({
      where: { parent: Number(id) },
      select: ['id'],
    });
    const locations = await strapi.db.query(LOCATION_UID).findMany({
      where: { section: Number(id) },
      select: ['id'],
    });
    if (childSections.length > 0) {
      throw new Error('Cannot delete section while child sections still reference it');
    }
    if (locations.length > 0) {
      throw new Error('Cannot delete section while source locations still reference it');
    }
  }
}

export default {
  async listEntity(uid: string, query: Record<string, any> = {}) {
    const page = Number(query.page ?? 1) || 1;
    const pageSize = Number(query.pageSize ?? 50) || 50;

    const records = await strapi.db.query(uid).findMany({
      orderBy: { id: 'desc' },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      populate: query.populate === 'false' ? {} : {},
    });

    const total = await strapi.db.query(uid).count();

    return {
      data: records,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
    };
  },

  async listCurricula(query: Record<string, any> = {}) {
    return this.listEntity(CURRICULUM_UID, query);
  },

  async getCurriculumDetail(id: number | string) {
    const curriculum = await strapi.db.query(CURRICULUM_UID).findOne({
      where: { id: Number(id) },
      populate: {},
    });

    if (!curriculum) {
      throw new Error('Curriculum not found');
    }

    return curriculum;
  },

  async createCurriculum(input: Record<string, any>) {
    const payload = await validateCurriculum(input);
    return strapi.db.query(CURRICULUM_UID).create({ data: payload });
  },

  async updateCurriculum(id: number | string, input: Record<string, any>) {
    await ensureExists(CURRICULUM_UID, id, 'curriculum');
    const payload = await validateCurriculum(input, id);
    return strapi.db.query(CURRICULUM_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteCurriculum(id: number | string) {
    await ensureExists(CURRICULUM_UID, id, 'curriculum');
    await deleteIfNoReferences(CURRICULUM_UID, id);
    return strapi.db.query(CURRICULUM_UID).delete({ where: { id: Number(id) } });
  },

  async createSubject(input: Record<string, any>) {
    const payload = await validateSubject(input);
    return strapi.db.query(SUBJECT_UID).create({ data: payload });
  },

  async updateSubject(id: number | string, input: Record<string, any>) {
    await ensureExists(SUBJECT_UID, id, 'subject');
    const payload = await validateSubject(input, id);
    return strapi.db.query(SUBJECT_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteSubject(id: number | string) {
    await ensureExists(SUBJECT_UID, id, 'subject');
    await deleteIfNoReferences(SUBJECT_UID, id);
    return strapi.db.query(SUBJECT_UID).delete({ where: { id: Number(id) } });
  },

  async createEducationLevel(input: Record<string, any>) {
    const payload = await validateEducationLevel(input);
    return strapi.db.query(EDUCATION_LEVEL_UID).create({ data: payload });
  },

  async updateEducationLevel(id: number | string, input: Record<string, any>) {
    await ensureExists(EDUCATION_LEVEL_UID, id, 'education level');
    const payload = await validateEducationLevel(input, id);
    return strapi.db.query(EDUCATION_LEVEL_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteEducationLevel(id: number | string) {
    await ensureExists(EDUCATION_LEVEL_UID, id, 'education level');
    await deleteIfNoReferences(EDUCATION_LEVEL_UID, id);
    return strapi.db.query(EDUCATION_LEVEL_UID).delete({ where: { id: Number(id) } });
  },

  async createGrade(input: Record<string, any>) {
    const payload = await validateGrade(input);
    return strapi.db.query(GRADE_UID).create({ data: payload });
  },

  async updateGrade(id: number | string, input: Record<string, any>) {
    await ensureExists(GRADE_UID, id, 'grade');
    const payload = await validateGrade(input, id);
    return strapi.db.query(GRADE_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteGrade(id: number | string) {
    await ensureExists(GRADE_UID, id, 'grade');
    await deleteIfNoReferences(GRADE_UID, id);
    return strapi.db.query(GRADE_UID).delete({ where: { id: Number(id) } });
  },

  async createVersion(input: Record<string, any>) {
    const payload = await validateVersion(input);
    return strapi.db.query(VERSION_UID).create({ data: payload });
  },

  async updateVersion(id: number | string, input: Record<string, any>) {
    await ensureExists(VERSION_UID, id, 'version');
    await denyIfPublishedVersion(id);
    const payload = await validateVersion(input, id);
    return strapi.db.query(VERSION_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteVersion(id: number | string) {
    await ensureExists(VERSION_UID, id, 'version');
    await deleteIfNoReferences(VERSION_UID, id);
    return strapi.db.query(VERSION_UID).delete({ where: { id: Number(id) } });
  },

  async createScope(input: Record<string, any>) {
    const payload = await validateScope(input);
    return strapi.db.query(SCOPE_UID).create({ data: payload });
  },

  async updateScope(id: number | string, input: Record<string, any>) {
    await ensureExists(SCOPE_UID, id, 'scope');
    const payload = await validateScope(input, id);
    return strapi.db.query(SCOPE_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteScope(id: number | string) {
    await ensureExists(SCOPE_UID, id, 'scope');
    return strapi.db.query(SCOPE_UID).delete({ where: { id: Number(id) } });
  },

  async createDocument(input: Record<string, any>) {
    const payload = await validateDocument(input);
    return strapi.db.query(DOCUMENT_UID).create({ data: payload });
  },

  async updateDocument(id: number | string, input: Record<string, any>) {
    await ensureExists(DOCUMENT_UID, id, 'document');
    const payload = await validateDocument(input, id);
    return strapi.db.query(DOCUMENT_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteDocument(id: number | string) {
    await ensureExists(DOCUMENT_UID, id, 'document');
    await deleteIfNoReferences(DOCUMENT_UID, id);
    return strapi.db.query(DOCUMENT_UID).delete({ where: { id: Number(id) } });
  },

  async createSection(input: Record<string, any>) {
    const payload = await validateSection(input);
    return strapi.db.query(SECTION_UID).create({ data: payload });
  },

  async updateSection(id: number | string, input: Record<string, any>) {
    await ensureExists(SECTION_UID, id, 'section');
    const payload = await validateSection(input, id);
    return strapi.db.query(SECTION_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteSection(id: number | string) {
    await ensureExists(SECTION_UID, id, 'section');
    await deleteIfNoReferences(SECTION_UID, id);
    return strapi.db.query(SECTION_UID).delete({ where: { id: Number(id) } });
  },

  async createLocation(input: Record<string, any>) {
    const payload = await validateLocation(input);
    return strapi.db.query(LOCATION_UID).create({ data: payload });
  },

  async updateLocation(id: number | string, input: Record<string, any>) {
    await ensureExists(LOCATION_UID, id, 'location');
    const payload = await validateLocation(input, id);
    return strapi.db.query(LOCATION_UID).update({
      where: { id: Number(id) },
      data: payload,
    });
  },

  async deleteLocation(id: number | string) {
    await ensureExists(LOCATION_UID, id, 'location');
    return strapi.db.query(LOCATION_UID).delete({ where: { id: Number(id) } });
  },

  async listCatalog() {
    const [curricula, subjects, educationLevels, grades, versions, scopes, documents, sections, locations, importMappings] = await Promise.all([
      strapi.db.query(CURRICULUM_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(SUBJECT_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(EDUCATION_LEVEL_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(GRADE_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(VERSION_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(SCOPE_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(DOCUMENT_UID).findMany({ orderBy: { id: 'desc' }, populate: {} }),
      strapi.db.query(SECTION_UID).findMany({
        orderBy: { id: 'desc' },
        populate: {
          sourceDocument: true,
          parent: true,
        },
      }),
      strapi.db.query(LOCATION_UID).findMany({
        orderBy: { id: 'desc' },
        populate: {
          sourceDocument: true,
          section: true,
        },
      }),
      strapi.db.query('api::curriculum-import-mapping.curriculum-import-mapping').findMany({
        populate: { sourceDocument: true },
        select: ['id', 'documentId', 'entityType', 'importKey', 'targetDocumentId', 'lastImportedAt', 'updatedAt', 'createdAt'],
      }),
    ]);

    const latestSectionTargetIds = resolveLatestTargetIds(importMappings || [], 'section');
    const latestLocationTargetIds = resolveLatestTargetIds(importMappings || [], 'source-location');

    const filteredSections = (sections || []).filter((section) => {
      if (!latestSectionTargetIds.size) return true;
      const identifiers = new Set([
        String(section?.id ?? ''),
        String(section?.documentId ?? ''),
        String(section?.document_id ?? ''),
      ].filter(Boolean));
      return Array.from(identifiers).some((value) => latestSectionTargetIds.has(value));
    });

    const filteredLocations = (locations || []).filter((location) => {
      if (!latestLocationTargetIds.size) return true;
      const identifiers = new Set([
        String(location?.id ?? ''),
        String(location?.documentId ?? ''),
        String(location?.document_id ?? ''),
      ].filter(Boolean));
      return Array.from(identifiers).some((value) => latestLocationTargetIds.has(value));
    });

    const uniqueSections = dedupeLogicalRows(filteredSections, (section) => {
      const documentId = normalizeRelationId(section?.sourceDocument);
      const recordId = toText(section?.documentId ?? section?.document_id ?? section?.id ?? '');
      return `${documentId}::${recordId}`;
    });

    const uniqueLocations = dedupeLogicalRows(filteredLocations, (location) => {
      const documentId = normalizeRelationId(location?.sourceDocument);
      const sectionId = normalizeRelationId(location?.section);
      const recordId = toText(location?.documentId ?? location?.document_id ?? location?.id ?? '');
      return `${documentId}::${sectionId || 'none'}::${recordId}`;
    });

    return {
      curricula: curricula || [],
      subjects: subjects || [],
      educationLevels: educationLevels || [],
      grades: grades || [],
      versions: versions || [],
      scopes: scopes || [],
      documents: documents || [],
      sections: uniqueSections,
      locations: uniqueLocations,
    };
  },
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeRelationId(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.length ? normalizeRelationId(value[0]) : '';
  if (typeof value === 'object') {
    const nestedId = (value as any)?.documentId ?? (value as any)?.document_id ?? (value as any)?.id ?? (value as any)?._id;
    return nestedId === null || nestedId === undefined || nestedId === '' ? '' : String(nestedId);
  }
  return String(value);
}

function resolveLatestTargetIds(rows: Record<string, any>[] = [], entityType: 'section' | 'source-location') {
  const latestByKey = new Map<string, Record<string, any>>();

  for (const row of rows) {
    const nextEntityType = toText(row?.entityType ?? row?.entity_type ?? '');
    if (nextEntityType !== entityType) continue;

    const sourceDocumentId = normalizeRelationId(row?.sourceDocument ?? row?.source_document ?? row?.sourceDocumentId ?? row?.source_document_id ?? row?.documentId ?? row?.document_id ?? '');
    const importKey = toText(row?.importKey ?? row?.import_key ?? '');
    if (!sourceDocumentId || !importKey) continue;

    const key = `${sourceDocumentId}::${importKey}`;
    const current = latestByKey.get(key);
    const candidateTime = toText(row?.lastImportedAt ?? row?.last_imported_at ?? row?.updatedAt ?? row?.updated_at ?? row?.createdAt ?? row?.created_at ?? '');
    const currentTime = toText(current?.lastImportedAt ?? current?.last_imported_at ?? current?.updatedAt ?? current?.updated_at ?? current?.createdAt ?? current?.created_at ?? '');

    if (!current || candidateTime.localeCompare(currentTime) > 0) {
      latestByKey.set(key, row);
    }
  }

  return new Set((Array.from(latestByKey.values()) || []).flatMap((row) => {
    const candidates = [
      row?.targetDocumentId,
      row?.target_document_id,
      row?.targetId,
      row?.id,
      row?.documentId,
      row?.document_id,
    ];
    return candidates
      .filter((candidate) => candidate !== null && candidate !== undefined && candidate !== '')
      .map((candidate) => String(candidate));
  }));
}

function sortByUpdatedAtDesc(a: Record<string, any>, b: Record<string, any>) {
  const aTime = a?.updatedAt || a?.publishedAt || a?.createdAt || '';
  const bTime = b?.updatedAt || b?.publishedAt || b?.createdAt || '';
  if (aTime === bTime) return Number(b?.id ?? 0) - Number(a?.id ?? 0);
  return String(bTime).localeCompare(String(aTime));
}

function dedupeLogicalRows(rows: Record<string, any>[] = [], keyBuilder: (row: Record<string, any>) => string) {
  const index = new Map<string, Record<string, any>>();

  for (const row of rows) {
    const key = keyBuilder(row);
    if (!key) {
      index.set(`${Math.random().toString(36).slice(2)}:${row?.id ?? rows.length}`, row);
      continue;
    }

    const existing = index.get(key);
    if (!existing || sortByUpdatedAtDesc(row, existing) > 0) {
      index.set(key, row);
    }
  }

  return [...index.values()].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
}
