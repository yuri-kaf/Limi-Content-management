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

// Firestore writes are fire-and-forget throughout the UI. Without this the
// promise rejects unhandled and the user just sees nothing happen — which is
// exactly how expired security rules presented as "the button is broken".
export async function runWrite(action: () => Promise<unknown>, what: string) {
  try {
    await action();
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    const message =
      code === 'permission-denied'
        ? `Could not ${what}: the database rejected the write (permission denied). Check the Firestore security rules for this project.`
        : `Could not ${what}: ${(err as Error)?.message ?? 'unknown error'}`;
    console.error(`[limi] ${what} failed`, err);
    alert(message);
    return false;
  }
}
