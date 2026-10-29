export const EDITABLE_FILE_LIMIT = 512 * 1024;

export function decodeEditableFile(bytes: Uint8Array): string {
  if (bytes.byteLength > EDITABLE_FILE_LIMIT) {
    throw new Error('This file exceeds the 512 KB mobile editor limit');
  }
  if (bytes.includes(0)) throw new Error('This is a binary file. Attach it to a prompt instead');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('This file is not UTF-8 text. Attach it to a prompt instead');
  }
}

type FileAccess = {
  read: () => Promise<Uint8Array>;
  write: (bytes: Uint8Array) => Promise<unknown>;
};

export async function saveEditableFile(access: FileAccess, original: Uint8Array, text: string): Promise<Uint8Array> {
  const latest = await access.read();
  if (latest.length !== original.length || latest.some((value, index) => value !== original[index])) {
    throw new Error('The file changed on the server. Copy your edits, reload the file, and apply your changes again');
  }
  const next = new TextEncoder().encode(text);
  if (next.byteLength > EDITABLE_FILE_LIMIT) throw new Error('Your edits exceed the 512 KB mobile editor limit');
  await access.write(next);
  return next;
}

export function parentPath(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('/');
}

export function fileName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
}

export function serverFilePath(directory: string, path: string): string {
  if (path.startsWith('/') || path.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(path)) return path;
  return `${directory.replace(/[\\/]+$/, '')}/${path}`;
}
