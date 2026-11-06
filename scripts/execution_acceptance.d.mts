export interface Issue {code: string; message: string; requirement?: string; pendingAcceptance?: boolean}
export interface Validation {errors: Issue[]; gaps?: Issue[]; checks?: Record<string, unknown>[]; ids?: string[]}
export type Reader = (path: string) => Promise<Buffer>;
export interface Input {registry?: any; registration?: any; acceptance?: any; readFile?: Reader; root?: string; binding?: any; git?: any; mode?: string; expectedRequirementIds?: string[]}
export const CURIOS: string[];
export const STAGES: string[];
export const MINIMUM_REQUIREMENT_IDS: string[];
export const REGISTRATION_PATH: string;
export const REGISTRY_PATH: string;
export const RUNTIME_ROOTS: string[];
export function sha256(bytes: Buffer | string): string;
export function isRepoPath(path: unknown): boolean;
export function createReader(root: string): Reader;
export function hashRuntimeEntries(entries: Iterable<[string, Buffer]>): string;
export function collectRuntimeBinding(root: string, source?: string): Promise<any>;
export function gitEvidenceContext(root: string): any;
export function readZipEntries(bytes: Buffer): Map<string, Buffer>;
export function minimumIdsFromContract(text: string): string[];
export function extractNormativeClauses(path: string, text: string): {path: string; startLine: number; endLine: number; text: string}[];
export function validateSourceCoverage(input: Input): Promise<Validation>;
export function validateAssets(input: Input): Promise<Validation>;
export function validateRuntimeContracts(input: Input): Promise<Validation>;
export function validateRequirements(input: Input): Promise<Validation>;
export function validateProof(input: Input): Promise<Validation>;
export function validateAcceptance(input: Input): Promise<Validation & {schema: 1; mode: string; staticValid: boolean; reviewReady: boolean; overallFinal: boolean; status: string; summary: Record<string, number>}>;
