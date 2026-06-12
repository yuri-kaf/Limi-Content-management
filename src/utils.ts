export function extractDriveFileId(url: string): string | null {
  if (!url) return null;

  const filePathMatch = url.match(/\/file\/d\/([-\w]{25,})/);
  if (filePathMatch) return filePathMatch[1];

  const idParamMatch = url.match(/[?&]id=([-\w]{25,})/);
  if (idParamMatch) return idParamMatch[1];

  const docsMatch = url.match(/\/d\/([-\w]{25,})/);
  if (docsMatch) return docsMatch[1];

  const genericMatch = url.match(/([-\w]{25,})/);
  if (genericMatch) return genericMatch[1];

  return null;
}

export function getDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
