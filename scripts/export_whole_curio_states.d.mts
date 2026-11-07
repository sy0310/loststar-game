import type {Reader} from './execution_acceptance.mjs';
export const registeredWholeStateMasters: Record<string, any>;
export function exportWholeCurioState(options: {id: string; state: string; raw?: Buffer; readFile?: Reader}): Promise<{entry: any; png: Buffer; webp: Buffer}>;
