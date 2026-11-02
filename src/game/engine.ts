// Contract checkpoint: tests deliberately execute these pending implementations.
const pending = (): any => { throw new Error('探索引擎尚未实现'); };
export const newGame = pending;
export const advance = (..._args: any[]): any => pending();
export const publicRadar = pending;
export const upgrade = (..._args: any[]): any => pending();
export const claimReturn = pending;
export const tuning = pending;
export const restore = (..._args: any[]): any => pending();
