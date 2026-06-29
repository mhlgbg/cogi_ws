import { errors } from '@strapi/utils';
import { extractRelationRef, hasOwn, toText } from '../../../../utils/tenant-scope';

const CANDIDATE_EXAM_UID = 'api::candidate-exam.candidate-exam';
const CAMPAIGN_UID = 'api::campaign.campaign';
const ADMISSION_APPLICATION_UID = 'api::admission-application.admission-application';

type GenericRecord = Record<string, unknown>;

function normalizeScoreValue(value: unknown, fallback: number | null = null) {
	if (value === null || value === undefined || value === '') return fallback;
	const parsed = Number(String(value).trim().replace(/,/g, '.'));
	if (!Number.isFinite(parsed)) {
		throw new errors.ApplicationError('Score fields must be valid numbers');
	}
	if (parsed < 0) {
		throw new errors.ApplicationError('Score fields cannot be negative');
	}
	return parsed;
}

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

function splitFullName(fullName: string) {
	const normalized = String(fullName || '').trim().replace(/\s+/g, ' ');
	if (!normalized) {
		return { lastName: null, firstName: null };
	}

	const parts = normalized.split(' ');
	if (parts.length === 1) {
		return { lastName: null, firstName: parts[0] };
	}

	const firstName = parts.pop() || null;
	const lastName = parts.length > 0 ? parts.join(' ') : null;
	return { lastName, firstName };
}

async function loadExistingCandidateExam(where: unknown) {
	const normalizedWhere = typeof where === 'object' && where !== null
		? Object.fromEntries(
			Object.entries(where as Record<string, unknown>).filter(
				([key, value]) => !(key === 'locale' && (value === '' || value === null)),
			),
		)
		: where;

	if (!normalizedWhere) return null;

	return strapi.db.query(CANDIDATE_EXAM_UID).findOne({
		where: normalizedWhere,
		populate: {
			tenant: { select: ['id', 'documentId'] },
			admissionSeason: {
				select: ['id', 'documentId'],
				populate: {
					tenant: { select: ['id', 'documentId'] },
				},
			},
			admissionApplication: {
				select: ['id', 'applicationCode', 'studentCode', 'studentName', 'dob', 'gender', 'currentSchool'],
				populate: {
					tenant: { select: ['id', 'documentId'] },
					campaign: { select: ['id', 'documentId'] },
				},
			},
		},
	});
}

async function loadCampaign(ref: string | number | null) {
	if (!ref) return null;
	return strapi.db.query(CAMPAIGN_UID).findOne({
		where: { id: ref },
		populate: {
			tenant: { select: ['id', 'documentId'] },
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
		select: ['id', 'applicationCode', 'studentCode', 'studentName', 'dob', 'gender', 'currentSchool'],
	});
}

async function findCandidateExamBySeasonAndApplicationCode(tenantRef: string | number, seasonRef: string | number, applicationCode: string) {
	return strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			admissionSeason: { id: { $eq: seasonRef } },
			applicationCode: { $eq: applicationCode },
			$or: [
				{ isDeleted: false },
				{ isDeleted: { $null: true } },
			],
		},
		select: ['id', 'applicationCode'],
	});
}

async function findCandidateExamBySeasonAndStudentCode(tenantRef: string | number, seasonRef: string | number, studentCode: string) {
	return strapi.db.query(CANDIDATE_EXAM_UID).findMany({
		where: {
			tenant: { id: { $eq: tenantRef } },
			admissionSeason: { id: { $eq: seasonRef } },
			studentCode: { $eq: studentCode },
			$or: [
				{ isDeleted: false },
				{ isDeleted: { $null: true } },
			],
		},
		select: ['id', 'studentCode'],
	});
}

async function syncShadowColumns(id: unknown, refs: {
	tenantRef?: string | number | null;
	seasonRef?: string | number | null;
	applicationRef?: string | number | null;
}) {
	if (!id) return;

	const knex = strapi.db.connection;
	const hasTable = await knex.schema.hasTable('candidate_exams');
	if (!hasTable) return;

	const patch: Record<string, unknown> = {};
	if (refs.tenantRef !== undefined && await knex.schema.hasColumn('candidate_exams', 'tenant_id')) {
		patch.tenant_id = refs.tenantRef ?? null;
	}
	if (refs.seasonRef !== undefined && await knex.schema.hasColumn('candidate_exams', 'admission_season_id')) {
		patch.admission_season_id = refs.seasonRef ?? null;
	}
	if (refs.applicationRef !== undefined && await knex.schema.hasColumn('candidate_exams', 'admission_application_id')) {
		patch.admission_application_id = refs.applicationRef ?? null;
	}

	if (Object.keys(patch).length === 0) return;
	await knex('candidate_exams').where({ id }).update(patch);
}

async function ensureCandidateExamIsValid(params: { data?: GenericRecord; where?: unknown }) {
	const data = (params.data || {}) as GenericRecord;
	const existing = await loadExistingCandidateExam(params.where);
	const requestTenantId = getRequestContextTenantId();

	if ((data.tenant === null || data.tenant === undefined || data.tenant === '') && requestTenantId) {
		data.tenant = requestTenantId;
	}

	const tenantRef = extractRelationRef(data.tenant)
		|| extractEntryRelationRef(existing?.tenant)
		|| requestTenantId;
	const applicationRef = extractRelationRef(data.admissionApplication)
		|| extractEntryRelationRef(existing?.admissionApplication);
	let seasonRef = extractRelationRef(data.admissionSeason)
		|| extractEntryRelationRef(existing?.admissionSeason);
	const requestedSeasonRef = extractRelationRef(data.admissionSeason);

	if (!tenantRef) {
		throw new errors.ApplicationError('tenant is required');
	}

	if (existing?.id && requestedSeasonRef && String(requestedSeasonRef) !== String(extractEntryRelationRef(existing?.admissionSeason))) {
		throw new errors.ApplicationError('admissionSeason cannot be changed');
	}

	const admissionApplication = await loadAdmissionApplication(applicationRef);
	if (applicationRef && !admissionApplication) {
		throw new errors.ApplicationError('admissionApplication is invalid');
	}

	if (!seasonRef && admissionApplication?.campaign) {
		seasonRef = extractEntryRelationRef(admissionApplication.campaign);
	}

	const season = await loadCampaign(seasonRef);
	if (!season) {
		throw new errors.ApplicationError('admissionSeason is required');
	}

	const seasonTenantRef = extractEntryRelationRef(season?.tenant);
	if (String(seasonTenantRef) !== String(tenantRef)) {
		throw new errors.ApplicationError('admissionSeason does not belong to the current tenant');
	}

	if (admissionApplication) {
		const applicationTenantRef = extractEntryRelationRef(admissionApplication?.tenant);
		const applicationCampaignRef = extractEntryRelationRef(admissionApplication?.campaign);
		if (String(applicationTenantRef) !== String(tenantRef)) {
			throw new errors.ApplicationError('admissionApplication does not belong to the current tenant');
		}
		if (seasonRef && String(applicationCampaignRef) !== String(seasonRef)) {
			throw new errors.ApplicationError('admissionApplication does not belong to the selected admissionSeason');
		}
	}

	const applicationCode = String(
		hasOwn(data, 'applicationCode') ? data.applicationCode : (existing?.applicationCode ?? admissionApplication?.applicationCode ?? ''),
	).trim().toUpperCase();
	const studentCode = String(
		hasOwn(data, 'studentCode') ? data.studentCode : (existing?.studentCode ?? admissionApplication?.studentCode ?? ''),
	).trim().toUpperCase();

	const candidateNumber = String(
		hasOwn(data, 'candidateNumber') ? data.candidateNumber : (existing?.candidateNumber ?? ''),
	).trim().toUpperCase();

	const fullName = String(
		hasOwn(data, 'fullName') ? data.fullName : (existing?.fullName ?? admissionApplication?.studentName ?? ''),
	).trim();
	const nameParts = splitFullName(fullName);

	const ignoreId = existing?.id ? String(existing.id) : null;
	if (applicationCode) {
		const siblingsByApplication = await findCandidateExamBySeasonAndApplicationCode(tenantRef, seasonRef as string | number, applicationCode);
		const duplicateApplication = (siblingsByApplication || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
		if (duplicateApplication) {
			throw new errors.ApplicationError('applicationCode must be unique within the tenant and admissionSeason');
		}
	}

	if (studentCode) {
		const siblingsByStudentCode = await findCandidateExamBySeasonAndStudentCode(tenantRef, seasonRef as string | number, studentCode);
		const duplicateStudentCode = (siblingsByStudentCode || []).find((item: any) => !ignoreId || String(item?.id) !== ignoreId);
		if (duplicateStudentCode) {
			throw new errors.ApplicationError('studentCode must be unique within the tenant and admissionSeason');
		}
	}

	data.tenant = tenantRef;
	data.admissionSeason = seasonRef as string | number;
	data.admissionApplication = applicationRef || null;
	data.applicationCode = applicationCode || null;
	data.studentCode = studentCode || null;
	data.fullName = fullName || null;
	const combinedExistingLastName = [existing?.lastName, existing?.middleName]
		.map((item) => String(item || '').trim())
		.filter(Boolean)
		.join(' ');
	data.lastName = String(hasOwn(data, 'lastName') ? data.lastName : (combinedExistingLastName || nameParts.lastName || '')).trim() || null;
	data.middleName = null;
	data.firstName = String(hasOwn(data, 'firstName') ? data.firstName : (existing?.firstName ?? nameParts.firstName ?? '')).trim() || null;
	data.dateOfBirth = hasOwn(data, 'dateOfBirth') ? (toText(data.dateOfBirth) || null) : (existing?.dateOfBirth ?? admissionApplication?.dob ?? null);
	data.gender = hasOwn(data, 'gender') ? (toText(data.gender).toLowerCase() || null) : (toText(existing?.gender || admissionApplication?.gender).toLowerCase() || null);
	data.primarySchool = String(hasOwn(data, 'primarySchool') ? data.primarySchool : (existing?.primarySchool ?? admissionApplication?.currentSchool ?? '')).trim() || null;
	data.cardImagePath = String(hasOwn(data, 'cardImagePath') ? data.cardImagePath : (existing?.cardImagePath ?? '')).trim() || null;
	data.candidateNumber = candidateNumber || null;
	const vietnameseScore = normalizeScoreValue(hasOwn(data, 'vietnameseScore') ? data.vietnameseScore : existing?.vietnameseScore, existing?.vietnameseScore ?? null);
	const englishScore = normalizeScoreValue(hasOwn(data, 'englishScore') ? data.englishScore : existing?.englishScore, existing?.englishScore ?? null);
	const mathScore = normalizeScoreValue(hasOwn(data, 'mathScore') ? data.mathScore : existing?.mathScore, existing?.mathScore ?? null);
	const incentiveScore = normalizeScoreValue(hasOwn(data, 'incentiveScore') ? data.incentiveScore : existing?.incentiveScore, existing?.incentiveScore ?? 0) ?? 0;
	const totalScoreInput = hasOwn(data, 'totalScore') ? data.totalScore : existing?.totalScore;
	const totalScore = totalScoreInput === null || totalScoreInput === undefined || totalScoreInput === ''
		? [vietnameseScore, englishScore, mathScore, incentiveScore].reduce((sum, item) => sum + (Number(item) || 0), 0)
		: normalizeScoreValue(totalScoreInput, existing?.totalScore ?? null);
	data.vietnameseScore = vietnameseScore;
	data.englishScore = englishScore;
	data.mathScore = mathScore;
	data.incentiveScore = incentiveScore;
	data.totalScore = totalScore;
	data.candidateExamStatus = toText(hasOwn(data, 'candidateExamStatus') ? data.candidateExamStatus : existing?.candidateExamStatus).toLowerCase() || 'draft';
	data.cardDownloadCount = Number(hasOwn(data, 'cardDownloadCount') ? data.cardDownloadCount : (existing?.cardDownloadCount ?? 0)) || 0;

	await syncShadowColumns(existing?.id, {
		tenantRef,
		seasonRef,
		applicationRef,
	});
}

export default {
	async beforeCreate(event: any) {
		await ensureCandidateExamIsValid({
			data: event.params?.data,
		});
	},

	async beforeUpdate(event: any) {
		await ensureCandidateExamIsValid({
			data: event.params?.data,
			where: event.params?.where,
		});
	},

	async afterCreate(event: any) {
		await syncShadowColumns(event.result?.id, {
			tenantRef: extractRelationRef(event.params?.data?.tenant) || getRequestContextTenantId(),
			seasonRef: extractRelationRef(event.params?.data?.admissionSeason),
			applicationRef: extractRelationRef(event.params?.data?.admissionApplication),
		});
	},

	async afterUpdate(event: any) {
		await syncShadowColumns(event.result?.id, {
			tenantRef: extractRelationRef(event.params?.data?.tenant)
				|| extractEntryRelationRef(event.result?.tenant)
				|| getRequestContextTenantId(),
			seasonRef: extractRelationRef(event.params?.data?.admissionSeason)
				|| extractEntryRelationRef(event.result?.admissionSeason),
			applicationRef: extractRelationRef(event.params?.data?.admissionApplication)
				|| extractEntryRelationRef(event.result?.admissionApplication),
		});
	},
};