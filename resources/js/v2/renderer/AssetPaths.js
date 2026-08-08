export function resourceImage(filename) {
  if (!filename) return null;
  if (typeof filename !== 'string') return null;
  if (filename.startsWith('/')) return filename;
  return `/images/resources/${filename}`;
}

export function machineImage(filename) {
  if (!filename) return null;
  if (typeof filename !== 'string') return null;
  if (filename.startsWith('/')) return filename;
  return `/images/machines/${filename}`;
}

export function scenarioImage(filename) {
  if (!filename) return null;
  if (typeof filename !== 'string') return null;
  if (filename.startsWith('/')) return filename;
  return `/images/scenarios/${filename}`;
}

export function uiImage(filename) {
  if (!filename) return null;
  if (typeof filename !== 'string') return null;
  if (filename.startsWith('/')) return filename;
  return `/images/ui/${filename}`;
}
