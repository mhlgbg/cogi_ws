import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mime from 'mime-types';
import storageService from '../services/storage-service';

const FILE_ASSET_UID = 'api::file-asset.file-asset';
const ADMISSION_ENTITY_TYPE = 'api::admission-application.admission-application';
const ADMISSION_FORM_MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FORM_MIME_TYPES = new Set([
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
]);

type CleanupTarget = {
	filePath: string;
	fileAssetId?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveStorageRoot() {
	const configuredRoot = String(process.env.STORAGE_ROOT || './storage').trim() || './storage';
	return path.isAbsolute(configuredRoot)
		? configuredRoot
		: path.resolve(process.cwd(), configuredRoot);
}

function getFileExtension(fileName: unknown, mimeType: string) {
	const rawName = String(fileName || '').trim();
	const parsedExtension = path.extname(rawName).toLowerCase();
	if (parsedExtension) return parsedExtension;

	const mimeExtension = mime.extension(mimeType);
	return mimeExtension ? `.${mimeExtension}` : '';
}

function parseDataUrl(dataUrl: unknown) {
	const text = String(dataUrl || '').trim();
	const matched = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([a-z0-9+/=\r\n]+)$/i.exec(text);
	if (!matched) {
		const error = new Error('Invalid admission file dataUrl') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const mimeType = String(matched[1] || '').trim().toLowerCase() || 'application/octet-stream';
	const base64Payload = String(matched[2] || '').replace(/\s+/g, '');
	if (!base64Payload) {
		const error = new Error('Admission file payload is empty') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	return {
		mimeType,
		buffer: Buffer.from(base64Payload, 'base64'),
	};
}

function isLegacyDataUrlFile(value: unknown): value is Record<string, unknown> {
	return isRecord(value)
		&& typeof value.dataUrl === 'string'
		&& String(value.dataUrl || '').trim().startsWith('data:');
}

function ensureAllowedMimeType(mimeType: string) {
	if (ALLOWED_FORM_MIME_TYPES.has(mimeType)) {
		return;
	}

	const error = new Error('Chi cho phep upload JPG, JPEG, PNG, WEBP hoac PDF') as Error & { status?: number };
	error.status = 400;
	throw error;
}

function ensureAllowedFileSize(size: number) {
	if (size > 0 && size <= ADMISSION_FORM_MAX_FILE_SIZE) {
		return;
	}

	const error = new Error('Minh chung vuot qua gioi han 10MB') as Error & { status?: number };
	error.status = 400;
	throw error;
}

async function createTempFileFromDataUrl(file: Record<string, unknown>, fieldPath: string, index: number) {
	const parsed = parseDataUrl(file.dataUrl);
	const originalName = String(file.name || 'tep-dinh-kem').trim() || 'tep-dinh-kem';
	const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'admission-form-'));
	const safeFieldPath = (fieldPath || 'field').replace(/[^a-zA-Z0-9_-]+/g, '-');
	const tempFilePath = path.join(
		tempDirectory,
		`upload-${Date.now()}-${safeFieldPath}-${index}${getFileExtension(originalName, parsed.mimeType)}`,
	);
	await fs.writeFile(tempFilePath, parsed.buffer);

	return {
		tempDirectory,
		tempFilePath,
		mimeType: parsed.mimeType,
		size: parsed.buffer.byteLength,
		originalName,
	};
}

async function cleanupTempFile(tempFilePath: string, tempDirectory: string) {
	if (tempFilePath) {
		try {
			await fs.unlink(tempFilePath);
		} catch {
			// Ignore temp file cleanup failures.
		}
	}

	if (tempDirectory) {
		try {
			await fs.rmdir(tempDirectory);
		} catch {
			// Ignore temp directory cleanup failures.
		}
	}
}

function buildCleanupTarget(fileAsset: any): CleanupTarget {
	const relativePath = String(fileAsset?.relativePath || '').trim();
	return {
		filePath: relativePath ? path.join(resolveStorageRoot(), ...relativePath.split('/').filter(Boolean)) : '',
		fileAssetId: Number(fileAsset?.id || 0) || null,
	};
}

function isPersistedFileEntry(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value)) return false;
	const url = String(value.url || '').trim();
	if (!url) return false;

	return Boolean(
		value.fileAssetId
		|| value.mime
		|| value.type
		|| value.name
		|| value.size !== undefined,
	);
}

function collectFileAssetIds(value: unknown, target = new Set<number>()) {
	if (Array.isArray(value)) {
		for (const entry of value) collectFileAssetIds(entry, target);
		return target;
	}

	if (!isRecord(value)) {
		return target;
	}

	if (isPersistedFileEntry(value)) {
		const fileAssetId = Number(value.fileAssetId || 0);
		if (Number.isInteger(fileAssetId) && fileAssetId > 0) {
			target.add(fileAssetId);
		}
	}

	for (const entry of Object.values(value)) {
		collectFileAssetIds(entry, target);
	}

	return target;
}

async function persistDataUrlFile(
	file: Record<string, unknown>,
	options: {
		tenantId?: string | number | null;
		tenantCode?: string | null;
		campaignCode?: string | number | null;
		applicationKey?: string | number | null;
		applicationId?: string | number | null;
		uploadedBy?: string | number | null;
		fieldPath: string;
		index: number;
	},
	cleanupTargets: CleanupTarget[],
) {
	const tempFile = await createTempFileFromDataUrl(file, options.fieldPath || 'field', options.index);
	ensureAllowedMimeType(tempFile.mimeType);
	ensureAllowedFileSize(tempFile.size);

	try {
		const fileAsset = await storageService.uploadLocalFile({
			tenant: {
				id: options.tenantId,
				code: options.tenantCode,
			},
			file: {
				filepath: tempFile.tempFilePath,
				originalFilename: tempFile.originalName,
				mimetype: tempFile.mimeType,
				size: tempFile.size,
			},
			moduleKey: 'admissions',
			entityType: ADMISSION_ENTITY_TYPE,
			entityId: options.applicationId || options.applicationKey || null,
			uploadedBy: options.uploadedBy,
			isPublic: false,
			metadata: {
				fieldKey: options.fieldPath || null,
			},
		});

		cleanupTargets.push(buildCleanupTarget(fileAsset));

		const nextFile = { ...file };
		delete nextFile.dataUrl;

		return {
			...nextFile,
			name: String(file.name || '').trim() || tempFile.originalName,
			size: Number.isFinite(Number(file.size)) ? Number(file.size) : tempFile.size,
			type: String(file.type || '').trim() || tempFile.mimeType,
			mime: tempFile.mimeType,
			url: String(fileAsset?.url || '').trim(),
			fileAssetId: Number(fileAsset?.id || 0) || null,
			storageProvider: 'local',
		};
	} finally {
		await cleanupTempFile(tempFile.tempFilePath, tempFile.tempDirectory);
	}
}

async function persistValue(
	value: unknown,
	options: {
		tenantId?: string | number | null;
		tenantCode?: string | null;
		campaignCode?: string | number | null;
		applicationKey?: string | number | null;
		applicationId?: string | number | null;
		uploadedBy?: string | number | null;
		fieldPath: string;
	},
	cleanupTargets: CleanupTarget[],
): Promise<unknown> {
	if (Array.isArray(value)) {
		const entries = await Promise.all(value.map((entry, index) => persistValue(entry, {
			...options,
			fieldPath: `${options.fieldPath}[${index}]`,
		}, cleanupTargets)));
		return entries;
	}

	if (isLegacyDataUrlFile(value)) {
		return persistDataUrlFile(value, {
			...options,
			index: 0,
		}, cleanupTargets);
	}

	if (isRecord(value)) {
		const nextEntries = await Promise.all(Object.entries(value).map(async ([key, entry], index) => {
			if (isLegacyDataUrlFile(entry)) {
				return [key, await persistDataUrlFile(entry, {
					...options,
					fieldPath: options.fieldPath ? `${options.fieldPath}.${key}` : key,
					index,
				}, cleanupTargets)] as const;
			}

			return [key, await persistValue(entry, {
				...options,
				fieldPath: options.fieldPath ? `${options.fieldPath}.${key}` : key,
			}, cleanupTargets)] as const;
		}));

		return Object.fromEntries(nextEntries);
	}

	return value;
}

export async function persistAdmissionFormDataFiles(
	formData: Record<string, unknown>,
	options: {
		tenantId?: string | number | null;
		tenantCode?: string | null;
		campaignCode?: string | number | null;
		applicationKey?: string | number | null;
		applicationId?: string | number | null;
		uploadedBy?: string | number | null;
	},
) {
	const cleanupTargets: CleanupTarget[] = [];
	const persistedFormData = await persistValue(formData, {
		...options,
		fieldPath: '',
	}, cleanupTargets);

	return {
		formData: isRecord(persistedFormData) ? persistedFormData : {},
		cleanupTargets,
		writtenFilePaths: cleanupTargets.map((item) => item.filePath).filter(Boolean),
		fileAssetIds: cleanupTargets
			.map((item) => Number(item.fileAssetId || 0))
			.filter((value) => Number.isInteger(value) && value > 0),
	};
}

export async function syncAdmissionFormFileAssetsEntityId(fileAssetIds: number[], entityId: number) {
	if (!Array.isArray(fileAssetIds) || fileAssetIds.length === 0) return;
	if (!Number.isInteger(entityId) || entityId <= 0) return;

	await Promise.all(fileAssetIds.map(async (fileAssetId) => {
		await strapi.db.query(FILE_ASSET_UID).update({
			where: { id: fileAssetId },
			data: {
				entityId: String(entityId),
			},
		});
	}));
}

export async function markRemovedAdmissionFormFileAssetsDeleted(previousFormData: unknown, nextFormData: unknown) {
	const previousFileAssetIds = collectFileAssetIds(previousFormData);
	const nextFileAssetIds = collectFileAssetIds(nextFormData);
	const removedIds = Array.from(previousFileAssetIds).filter((id) => !nextFileAssetIds.has(id));

	if (removedIds.length === 0) return;

	await Promise.all(removedIds.map(async (fileAssetId) => {
		await strapi.db.query(FILE_ASSET_UID).update({
			where: { id: fileAssetId },
			data: {
				status: 'DELETED',
				isDeleted: true,
			},
		});
	}));
}

export async function removePersistedAdmissionFiles(filePaths: Array<string | CleanupTarget>) {
	const cleanupTargets = (Array.isArray(filePaths) ? filePaths : []).map((entry) => {
		if (typeof entry === 'string') {
			return {
				filePath: entry,
				fileAssetId: null,
			};
		}

		return {
			filePath: String(entry?.filePath || '').trim(),
			fileAssetId: Number(entry?.fileAssetId || 0) || null,
		};
	});

	await Promise.all(cleanupTargets.map(async (entry) => {
		if (!entry.filePath) return;
		try {
			await fs.unlink(entry.filePath);
		} catch {
			// Ignore cleanup failures for best-effort rollback.
		}
	}));

	await Promise.all(cleanupTargets.map(async (entry) => {
		if (!entry.fileAssetId) return;
		try {
			await strapi.db.query(FILE_ASSET_UID).delete({ where: { id: entry.fileAssetId } });
		} catch {
			// Ignore cleanup failures for best-effort rollback.
		}
	}));
}
