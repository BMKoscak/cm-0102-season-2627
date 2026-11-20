import type { RealPlayerSeed } from '../types/contracts';
import { ENGLAND_ROSTERS } from './rosters/england';
import { EUROPE_REST_ROSTERS } from './rosters/europeRest';
import { FRANCE_ROSTERS } from './rosters/france';
import { GERMANY_ROSTERS } from './rosters/germany';
import { ITALY_ROSTERS } from './rosters/italy';
import { SLOVENIA_AND_BALKANS_ROSTERS } from './rosters/sloveniaAndBalkans';
import { SPAIN_ROSTERS } from './rosters/spain';
import { WONDERKIDS_AND_FREE_AGENTS } from './rosters/wonderkidsAndFreeAgents';

/**
 * Curated 2026/27 Real Player Database for Championship Manager 01/02 — Season 2026/27.
 * Covers all 18 playable leagues across 13 countries, deep Slovenia PrvaLiga & 2. SNL squads,
 * 55+ wonderkids (isWonderkid: true), and 35+ Day-1 Free Agents (clubId: null).
 */
export const REAL_PLAYERS_SEED: RealPlayerSeed[] = [
  ...ENGLAND_ROSTERS,
  ...SPAIN_ROSTERS,
  ...ITALY_ROSTERS,
  ...GERMANY_ROSTERS,
  ...FRANCE_ROSTERS,
  ...SLOVENIA_AND_BALKANS_ROSTERS,
  ...EUROPE_REST_ROSTERS,
  ...WONDERKIDS_AND_FREE_AGENTS,
];
