export function publicAssetPath(filename: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedFilename = filename.startsWith("/") ? filename.slice(1) : filename;

  return `${normalizedBase}${normalizedFilename}`;
}
