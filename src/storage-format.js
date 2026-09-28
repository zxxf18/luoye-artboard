export const DRAFT_STORAGE_VERSION = 3;

export function createDraftRecord(project, { id, revision = null, updatedAt = Date.now() } = {}) {
  return {
    storageVersion: DRAFT_STORAGE_VERSION,
    id: id || crypto.randomUUID(),
    revision: Number.isFinite(revision) ? revision : null,
    project,
    updatedAt,
  };
}

export function shouldSkipDraftWrite(current, revision) {
  return Number.isFinite(revision) && Number.isFinite(current?.revision) && current.revision === revision;
}

export function previousSessionId(record) {
  return `previous-session-${record?.id || record?.updatedAt || Date.now()}`;
}

export function galleryMetadata(item) {
  const { project, ...metadata } = item || {};
  return {
    ...metadata,
    storageVersion: DRAFT_STORAGE_VERSION,
    title: metadata.title || project?.title || '未命名作品',
  };
}

export function classifyStorageError(error) {
  if (error?.name === 'QuotaExceededError') return 'quota';
  if (error?.name === 'InvalidStateError' || error?.name === 'NotFoundError' || error?.name === 'VersionError') return 'unavailable';
  return 'unknown';
}

export function storageErrorMessage(error, operation = '保存') {
  switch (classifyStorageError(error)) {
    case 'quota': return `${operation}失败：本机存储空间不足，请清理旧作品后重试。`;
    case 'unavailable': return `${operation}失败：本机存储暂时不可用，请关闭其他画板窗口后重试。`;
    default: return `${operation}失败，请重试。`;
  }
}
