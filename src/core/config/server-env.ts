// Validated server-only configuration; secrets are never returned to the browser.
import 'server-only';
import { parseServerEnvironment } from './env-schema';

export const serverEnvironment = parseServerEnvironment(process.env);
