export type Edition = 'second' | 'third';
export type ImplementationState = 'pending' | 'tested';

export interface SourceRef {
  path: string;
  page: number;
  row: number;
  column: number;
  verified: boolean;
}

export type RawRecord = Readonly<Record<string, unknown>>;

export interface CatalogEntry {
  kind: 'action' | 'character';
  id: string;
  edition: Edition;
  name: string;
  source: SourceRef;
  assetId: string;
  copies: number;
  implementation: ImplementationState;
  raw: RawRecord;
}

export type SemanticPlayMode = 'distance' | 'rest' | 'advance' | 'attack' | 'other';

export interface ActionMode extends RawRecord {
  name: string;
  playMode: SemanticPlayMode;
}

export interface ActionCard extends CatalogEntry {
  kind: 'action';
  category: string;
  printed_category?: string | string[];
  printed_text: string;
  timing: string[];
  specification: string[];
  questions: string[];
  modes?: ActionMode[];
  stats?: RawRecord;
  character_overrides?: RawRecord[];
}

export interface CharacterAbility extends RawRecord {
  id: string;
  name: string;
  timing: string[];
  specification: string;
  activation: string;
  implementation: ImplementationState;
}

export interface CharacterCard extends CatalogEntry {
  kind: 'character';
  sex: '男' | '女' | '不明';
  initial_faction: 'GOOD' | 'EVIL' | 'ヴァンミール';
  transformation_only: boolean;
  base_stats: CharacterBaseStats;
  allegiance_text: string;
  inherits_abilities_from: string | null;
  objective: string;
  defeat_condition: string;
  owned_techniques: string[];
  owned_followers: string[];
  abilities: CharacterAbility[];
  restrictions: string[];
}

export interface CharacterBaseStats {
  warrior_level: number;
  magic_level: number;
  spirit: number;
  endurance: number;
}

export interface DeckRow {
  id: string;
  copies: number;
}

export interface Ruleset {
  id: string;
  edition: 'second';
  actionCardCount: number;
  characterCardCount: number;
  minPlayers: number;
  maxPlayers: number;
}
