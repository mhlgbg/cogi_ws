import { errors } from '@strapi/utils';
import { extractRelationRef } from '../../../../utils/tenant-scope';

const CANDIDATE_EXAM_LOG_UID = 'api::candidate-exam-log.candidate-exam-log';
const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';

type GenericRecord = Record<string, unknown>;

function getRequestContextTenantId(): number | string | null {
	const requestContext = strapi.requestContext?.get?.();
	const tenantId = requestContext?.state?.tenantId ?? requestContext?.state?.tenant?.id;
	if (tenantId === null || tenantId === undefined || tenantId === '') return null;
	return tenantId;
}

function extractEntryRelationRef(value: unknown): string | number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string' || typeof value === 'number') return value;
	if (typeof value !== 'object') return null;

	const relation = value as { id?: number | string; documentId?: string };
	if (relation.id !== undefined) return relation.id;
	if (relation.documentId) return relation.documentId;
	return null;
}

async function loadExistingLog(where: unknown) {
	if (!where) return null;
	return strapi.db.query(CANDIDATE_EXAM_LOG_UID).findOne({
		where,
		populate: {
			tenant: { select: ['id', 'documentId'] },
			admissionSeason: { select: ['id', 'documentId'] },
			candidateExam: {
				select: ['id'],
				populate: {
					tenant: { select: ['id', 'documentId'] },
					admissionSeason: { select: ['id', 'documentId'] },
					admissionApplication: { select: ['id', 'documentId'] },
				},
			},
			admissionApplication: { select: ['id', 'documentId'] },
		},
	});
}

async function loadCandidateExam(ref: string | number | null) {
	if (!ref) return null;
	return strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: { id: ref },
		populate: {
			tenant: { select: ['id', 'documentId'] },
			admissionSeason: { select: ['id', 'documentId'] },
			admissionApplication: { select: ['id', 'documentId'] },
		},
	});
}

async function loadAdmissionApplication(ref: string | number | null) {
	if (!ref) return null;
	return strapi.db.query(ADMISSION_APPLICATION_UID).findOne({
		where: { id: ref },
		populate: {
			tenant: { select: ['id', 'documentId'] },
			campaign: { select: ['id', 'documentId'] },
		},
		select: ['id'],
	});
}

async function ensureCandidateExamLogIsValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingLog(params.where);
	const requestTenantId = getRequestContextTenantId();

	const candidateExamRef = extractRelationRef(data.candidateExam) || extractEntryRelationRef(existing?.candidateExam);
	const candidateExam = await loadCandidateExam(candidateExamRef);
	if (!candidateExam) {
		throw new errors.ApplicationError('candidateExam is required');
	}

	const tenantRef = extractRelationRef(data.tenant)
		|| extractEntryRelationRef(existing?.tenant)
		|| extractEntryRelationRef(candidateExam?.tenant)
		|| requestTenantId;
	const seasonRef = extractRelationRef(data.admissionSeason)
		|| extractEntryRelationRef(existing?.admissionSeason)
		|| extractEntryRelationRef(candidateExam?.admissionSeason);
	const applicationRef = extractRelationRef(data.admissionApplication)
		|| extractEntryRelationRef(existing?.admissionApplication)
		|| extractEntryRelationRef(candidateExam?.admissionApplication);

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}
	if (!seasonRef) {
		throw new errors.ApplicationError('admissionSeason is required');
	}

	if (String(extractEntryRelationRef(candidateExam?.tenant)) !== String(tenantRef)) {
		throw new errors.ApplicationError('candidateExam does not belong to the current tenant');
	}
	if (String(extractEntryRelationRef(candidateExam?.admissionSeason)) !== String(seasonRef)) {
		throw new errors.ApplicationError('candidateExam does not belong to the selected admissionSeason');
	}

	const admissionApplication = await loadAdmissionApplication(applicationRef);
	if (applicationRef && !admissionApplication) {
		throw new errors.ApplicationError('admissionApplication is invalid');
	}
	if (admissionApplication && String(extractEntryRelationRef(admissionApplication?.tenant)) !== String(tenantRef)) {
		throw new errors.ApplicationError('admissionApplication does not belong to the current tenant');
	}

	data.tenant = tenantRef;
	data.admissionSeason = seasonRef;
	data.candidateExam = candidateExamRef;
	data.admissionApplication = applicationRef || null;
	data.actionAt = String(data.actionAt || existing?.actionAt || new Date().toISOString());
	data.actorType = String(data.actorType || existing?.actorType || 'system').trim().toLowerCase();
}

export default {
	async beforeCreate(event: any) {
		await ensureCandidateExamLogIsValid({ data: event.params?.data });
	},
	async beforeUpdate(event: any) {
		await ensureCandidateExamLogIsValid({ data: event.params?.data, where: event.params?.where });
	},
};