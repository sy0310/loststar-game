export type DiscoveryKind = 'artifact' | 'creature' | 'event';
export type ArtId = 'receipt' | 'tape' | 'nested' | 'mouse' | 'signal' | 'hermit' | 'tagbird' | 'cosmic-parcel' | 'stamp' | 'bell' | 'night-clock' | 'blank-letter';
export interface Discovery {
  id: string;
  kind: DiscoveryKind;
  name: string;
  description: string;
  interaction: string;
  fieldNote: string;
  milestone: number;
  rarity: '寻常' | '稀奇' | '异常';
  icon: ArtId;
  presentation: { headline: string; line: string; cue: 'parcel' | 'resident' | 'glitch' };
}
export interface Region { id: string; name: string; visualTheme: string; discoveries: Discovery[]; }
export interface Planet { id: string; name: string; subtitle: string; color: string; playable: boolean; regions: Region[]; }
export interface SurveySignal { id: string; name: string; description: string; fieldNote: string; }
