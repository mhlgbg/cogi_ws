import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mime from 'mime-types';
import storageService from '../services/storage-service';

const REVIEW_MESSAGE_MAX_FILE_SIZE = 20 * 1024 * 1024;
const ADMISSION_ENTITY_TYPE = 'api::admission-application.admission-application';
const FILE_ASSET_UID = 'api::file-asset.file-asset';

type UploadedFileLike = {
	filepath?: string;
	path?: string;
	tempFilePath?: string;
	originalFilename?: string;
	newFilename?: string;
	mimetype?: string;
	type?: string;
	size?: number;
	name?: string;
	dataUrl?: string;
};

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
		const error = new Error('Invalid admission message file dataUrl') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	const mimeType = String(matched[1] || '').trim().toLowerCase() || 'application/octet-stream';
	const base64Payload = String(matched[2] || '').replace(/\s+/g, '');
	if (!base64Payload) {
		const error = new Error('Admission message file payload is empty') as Error & { status?: number };
		error.status = 400;
		throw error;
	}

	return {
		mimeType,
		buffer: Buffer.from(base64Payload, 'base64'),
	};
}

function isLegacyDataUrlFile(value: unknown): value is UploadedFileLike {
	return isRecord(value)
		&& typeof value.dataUrl === 'string'
		&& String(value.dataUrl || '').trim().startsWith('data:');
}

function resolveMimeType(file: UploadedFileLike) {
	return String(file.mimetype || file.type || '').trim().toLowerCase() || 'application/octet-stream';
}

function resolveFileSize(file: UploadedFileLike) {
	const size = Number(file.size || 0);
	return Number.isFinite(size) && size >= 0 ? size : 0;
}

function resolveSourcePath(file: UploadedFileLike) {
	return String(file.filepath || file.path || file.tempFilePath || '').trim();
}

function resolveOriginalFileName(file: UploadedFileLike) {
	return String(file.originalFilename || file.newFilename || file.name || 'tep-dinh-kem').trim() || 'tep-dinh-kem';
}

function ensureAllowedMimeType(mimeType: string) {
	if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
		return;
	}

	const error = new Error('Chi cho phep dinh kem anh hoac PDF') as Error & { status?: number };
	error.status = 400;
	throw error;
}

function ensureAllowedFileSize(size: number) {
	if (size > 0 && size <= REVIEW_MESSAGE_MAX_FILE_SIZE) {
		return;
	}

	const error = new Error('Tep dinh kem vuot qua gioi han 20MB') as Error & { status?: number };
	error.status = 400;
	throw error;
}

async function createTempFileFromDataUrl(dataUrlFile: UploadedFileLike, fileName: string, index: number) {
	const parsed = parseDataUrl(dataUrlFile.dataUrl);
	const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'admission-msg-'));
	const tempFilePath = path.join(tempDirectory, `upload-${Date.now()}-${index}${getFileExtension(fileName, parsed.mimeType)}`);
	await fs.writeFile(tempFilePath, parsed.buffer);

	return {
		tempDirectory,
		tempFilePath,
		mimeType: parsed.mimeType,
		size: parsed.buffer.byteLength,
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

export async function persistAdmissionMessageFiles(
	files: UploadedFileLike[],
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
	const attachments = await Promise.all((Array.isArray(files) ? files : []).map(async (file, index) => {
		const fileName = resolveOriginalFileName(file);
		let sourcePath = '';
		let mimeType = '';
		let size = 0;
		let tempDirectory = '';
		let isMultipartTemp = false;

		if (isLegacyDataUrlFile(file)) {
			const tempFile = await createTempFileFromDataUrl(file, fileName, index);
			tempDirectory = tempFile.tempDirectory;
			sourcePath = tempFile.tempFilePath;
			mimeType = tempFile.mimeType;
			size = tempFile.size;
		} else {
			mimeType = resolveMimeType(file);
			size = resolveFileSize(file);
			sourcePath = resolveSourcePath(file);
			isMultipartTemp = true;

			if (!sourcePath) {
				const error = new Error('Khong tim thay tep dinh kem hop le') as Error & { status?: number };
				error.status = 400;
				throw error;
			}
		}

		ensureAllowedMimeType(mimeType);
		ensureAllowedFileSize(size);

		try {
			const fileAsset = await storageService.uploadLocalFile({
				tenant: {
					id: options.tenantId,
					code: options.tenantCode,
				},
				file: {
					filepath: sourcePath,
					originalFilename: fileName,
					mimetype: mimeType,
					size,
				},
				moduleKey: 'admissions',
				entityType: ADMISSION_ENTITY_TYPE,
				entityId: options.applicationId || options.applicationKey || null,
				uploadedBy: options.uploadedBy,
				isPublic: false,
				metadata: {
					fieldKey: 'attachments',
					category: 'conversation-attachment',
				},
			});

			cleanupTargets.push(buildCleanupTarget(fileAsset));

			return {
				name: fileName,
				url: String(fileAsset?.url || '').trim(),
				mime: mimeType,
				size,
				fileAssetId: Number(fileAsset?.id || 0) || null,
				storageProvider: 'local',
			};
		} finally {
			if (tempDirectory) {
				await cleanupTempFile(sourcePath, tempDirectory);
			} else if (isMultipartTemp && sourcePath) {
				try {
					await fs.unlink(sourcePath);
				} catch {
					// Ignore temp file cleanup failures.
				}
			}
		}
	}));

	return {
		attachments,
		cleanupTargets,
		writtenFilePaths: cleanupTargets.map((item) => item.filePath).filter(Boolean),
		fileAssetIds: cleanupTargets
			.map((item) => Number(item.fileAssetId || 0))
			.filter((value) => Number.isInteger(value) && value > 0),
	};
}

export async function removePersistedAdmissionMessageFiles(filePaths: Array<string | CleanupTarget>) {
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
