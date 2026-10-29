import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser/lib/esm/main';
import { isFileNotFoundError } from '@opencode/client';
import type { Client } from './client';

export function validateConfig(text: string): void {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`Invalid configuration: ${printParseErrorCode(errors[0].error)} at character ${errors[0].offset}`);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The configuration must be a JSON object');
}

export function externalURL(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('The server returned an unsupported link');
  return url.toString();
}

type ConfigFileClient = {
  file: Pick<Client['file'], 'read'>;
  experimental: { file: Pick<Client['experimental']['file'], 'write'> };
};

export async function saveConfigFile(client: ConfigFileClient, directory: string, path: string, original: string | null, text: string): Promise<void> {
  validateConfig(text);
  let current: string | null;
  try { current = new TextDecoder().decode(await client.file.read({ location: { directory }, path })); }
  catch (error) { if (original === null && isFileNotFoundError(error)) current = null; else throw error; }
  if (current !== original) throw new Error('This file changed on the server. Close the editor and reopen the file before you save.');
  await client.experimental.file.write({ location: { directory }, path, payload: new TextEncoder().encode(text) });
}
