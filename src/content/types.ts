export type DiscoveryKind = 'artifact' | 'creature' | 'event';
export interface Discovery { id: string; kind: DiscoveryKind; name: string; description: string; interaction: string; milestone: number; rarity: '寻常' | '稀奇' | '异常'; icon: 'receipt' | 'tape' | 'nested' | 'mouse' | 'signal'; }
export interface Region { id: string; name: string; visualTheme: string; discoveries: Discovery[]; }
export interface Planet { id: string; name: string; subtitle: string; color: string; playable: boolean; regions: Region[]; }
