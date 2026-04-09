import crypto from 'node:crypto';
import {
  ImportTenantUsersResult,
  importTenantUsersFromBuffer,
} from './import-tenant-users';

type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

type ImportJobProgress = {
  totalRows: number;
  processedRows: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
};

type ImportTenantUsersJob = {
  id: string;
  tenantId: number;
  roleId: number;
  fileName: string | null;
  status: ImportJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequested: boolean;
  progress: ImportJobProgress;
  result: ImportTenantUsersResult | null;
  error: string | null;
};

const importJobs = new Map<string, ImportTenantUsersJob>();
const JOB_TTL_MS = 1000 * 60 * 60;

function scheduleCleanup(jobId: string) {
  setTimeout(() => {
    importJobs.delete(jobId);
  }, JOB_TTL_MS).unref?.();
}

function cloneJob(job: ImportTenantUsersJob) {
  const percent = job.progress.totalRows > 0
    ? Math.min(100, Math.round((job.progress.processedRows / job.progress.totalRows) * 100))
    : 0;

  return {
    id: job.id,
    tenantId: job.tenantId,
    roleId: job.roleId,
    fileName: job.fileName,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    cancelRequested: job.cancelRequested,
    progress: {
      ...job.progress,
      percent,
    },
    result: job.result,
    error: job.error,
  };
}

function updateProgress(job: ImportTenantUsersJob, progress: Partial<ImportJobProgress>) {
  job.progress = {
    ...job.progress,
    ...progress,
  };
}

async function runImportJob(jobId: string, options: {
  tenantId: number;
  roleId: number;
  fileName: string | null;
  buffer: Buffer;
}) {
  const job = importJobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = new Date().toISOString();

  try {
    const result = await importTenantUsersFromBuffer({
      tenantId: options.tenantId,
      roleId: options.roleId,
      fileName: options.fileName,
      buffer: options.buffer,
      onProgress: async (progress) => {
        updateProgress(job, progress);
      },
      shouldCancel: async () => job.cancelRequested,
    });

    job.status = job.cancelRequested ? 'cancelled' : 'completed';
    job.finishedAt = new Date().toISOString();
    job.result = result;
    updateProgress(job, {
      totalRows: result.summary.totalRows,
      processedRows: result.summary.totalRows,
      createdCount: result.summary.createdCount,
      skippedCount: result.summary.skippedCount,
      errorCount: result.summary.errorCount,
    });
    scheduleCleanup(jobId);
  } catch (error: any) {
    job.finishedAt = new Date().toISOString();

    if (error?.message === 'IMPORT_CANCELLED') {
      job.status = 'cancelled';
      job.error = null;
    } else {
      job.status = 'failed';
      job.error = typeof error?.message === 'string' ? error.message : 'Failed to import users';
    }

    scheduleCleanup(jobId);
  }
}

export function createImportTenantUsersJob(options: {
  tenantId: number;
  roleId: number;
  fileName: string | null;
  buffer: Buffer;
}) {
  const id = crypto.randomUUID();
  const job: ImportTenantUsersJob = {
    id,
    tenantId: options.tenantId,
    roleId: options.roleId,
    fileName: options.fileName,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    cancelRequested: false,
    progress: {
      totalRows: 0,
      processedRows: 0,
      createdCount: 0,
      skippedCount: 0,
      errorCount: 0,
    },
    result: null,
    error: null,
  };

  importJobs.set(id, job);
  setTimeout(() => {
    runImportJob(id, options).catch((error) => {
      const failedJob = importJobs.get(id);
      if (!failedJob) return;
      failedJob.status = 'failed';
      failedJob.finishedAt = new Date().toISOString();
      failedJob.error = typeof error?.message === 'string' ? error.message : 'Failed to import users';
      scheduleCleanup(id);
    });
  }, 0);

  return cloneJob(job);
}

export function getImportTenantUsersJob(jobId: string, tenantId: number) {
  const job = importJobs.get(jobId);
  if (!job || job.tenantId !== tenantId) {
    return null;
  }

  return cloneJob(job);
}

export function cancelImportTenantUsersJob(jobId: string, tenantId: number) {
  const job = importJobs.get(jobId);
  if (!job || job.tenantId !== tenantId) {
    return null;
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return cloneJob(job);
  }

  job.cancelRequested = true;
  return cloneJob(job);
}