import type { RealPlayerSeed } from '../../types/contracts';
import { K, M, p } from './helpers';

export const WONDERKIDS_AND_FREE_AGENTS: RealPlayerSeed[] = [
  // =========================================================================
  // EXTRA 2026/27 GLOBAL & SLOVENIAN WONDERKIDS (isWonderkid: true, age 16-21)
  // =========================================================================
  // England
  p({ name: 'Trey Nyoni', clubId: 'liverpool', nat: 'ENG', age: 19, pos: ['MC', 'AMC'], num: 98, ca: 136, pa: 179, wk: true, val: M(18), wage: K(24), exp: '2029-06-30', h: 180, w: 70, t: { passing: 16, technique: 16, dribbling: 16 }, m: { decisions: 16, creativity: 16 } }),
  p({ name: 'Shea Lacey', clubId: 'manchester-united', nat: 'ENG', age: 19, pos: ['FR', 'AMC'], foot: 'left', num: 61, ca: 133, pa: 178, wk: true, val: M(16), wage: K(20), exp: '2029-06-30', h: 174, w: 66, t: { dribbling: 17, technique: 17, setPieces: 16 }, m: { flair: 18 } }),
  p({ name: 'Ayden Heaven', clubId: 'manchester-united', nat: 'ENG', age: 19, pos: ['DC', 'DL'], foot: 'left', num: 26, ca: 138, pa: 176, wk: true, val: M(20), wage: K(30), exp: '2029-06-30', h: 189, w: 80, t: { tackling: 15, passing: 15 }, p: { pace: 16 } }),
  p({ name: 'Vitor Reis', clubId: 'manchester-city', nat: 'BRA', age: 20, pos: ['DC'], num: 22, ca: 147, pa: 182, wk: true, val: M(36), wage: K(65), exp: '2029-06-30', h: 186, w: 77, t: { tackling: 16, passing: 16, heading: 16 }, m: { anticipation: 17, decisions: 16 } }),
  p({ name: 'Sverre Nypan', clubId: 'manchester-city', nat: 'NOR', age: 19, pos: ['MC', 'AMC'], foot: 'both', num: 44, ca: 144, pa: 183, wk: true, val: M(30), wage: K(45), exp: '2030-06-30', caps: 2, h: 182, w: 73, t: { passing: 16, technique: 17, dribbling: 16 }, m: { creativity: 17, decisions: 16, determination: 17 } }),
  p({ name: 'Josh Acheampong', clubId: 'chelsea', nat: 'ENG', age: 20, pos: ['DR', 'DC'], num: 34, ca: 142, pa: 176, wk: true, val: M(24), wage: K(38), exp: '2029-06-30', h: 185, w: 76, t: { tackling: 15, dribbling: 15 }, p: { pace: 17, stamina: 16 } }),
  p({ name: 'Tyrique George', clubId: 'chelsea', nat: 'ENG', age: 20, pos: ['FL', 'FR'], num: 32, ca: 140, pa: 175, wk: true, val: M(20), wage: K(32), exp: '2029-06-30', h: 181, w: 72, t: { dribbling: 16, technique: 16 }, p: { pace: 18, acceleration: 18 } }),
  p({ name: 'Stefanos Tzimas', clubId: 'brighton', nat: 'GRE', age: 20, pos: ['FC'], num: 9, ca: 145, pa: 179, wk: true, val: M(28), wage: K(42), exp: '2030-06-30', caps: 4, h: 186, w: 79, t: { finishing: 16, dribbling: 15 }, p: { pace: 17, strength: 16 } }),
  p({ name: 'Charalampos Kostoulas', clubId: 'brighton', nat: 'GRE', age: 19, pos: ['FC', 'AMC'], num: 39, ca: 143, pa: 182, wk: true, val: M(32), wage: K(40), exp: '2030-06-30', caps: 2, h: 185, w: 78, t: { finishing: 16, technique: 16 }, m: { bravery: 17, determination: 18, workRate: 18 }, p: { strength: 17 } }),
  p({ name: 'Harry Amass', clubId: 'manchester-united', nat: 'ENG', age: 19, pos: ['DL', 'ML'], foot: 'left', num: 41, ca: 135, pa: 174, wk: true, val: M(14), wage: K(20), exp: '2029-06-30', h: 181, w: 73, t: { crossing: 15, dribbling: 15 }, p: { pace: 17 } }),

  // Spain
  p({ name: 'Héctor Fort', clubId: 'barcelona', nat: 'ESP', age: 20, pos: ['DR', 'DL'], num: 32, ca: 144, pa: 175, wk: true, val: M(22), wage: K(38), exp: '2029-06-30', h: 185, w: 75, t: { passing: 15, tackling: 15 } }),
  p({ name: 'Toni Fernández', clubId: 'barcelona', nat: 'ESP', age: 18, pos: ['FR', 'AMC', 'FC'], foot: 'left', num: 42, ca: 136, pa: 182, wk: true, val: M(20), wage: K(22), exp: '2029-06-30', h: 173, w: 65, t: { dribbling: 17, technique: 17, finishing: 15 }, m: { flair: 17 } }),
  p({ name: 'Guille Fernández', clubId: 'barcelona', nat: 'ESP', age: 18, pos: ['MC', 'AMC'], num: 41, ca: 135, pa: 181, wk: true, val: M(18), wage: K(20), exp: '2029-06-30', h: 180, w: 71, t: { passing: 16, technique: 16, longShots: 15 }, m: { creativity: 16, determination: 17 } }),
  p({ name: 'Gonzalo García', clubId: 'real-madrid', nat: 'ESP', age: 22, pos: ['FC', 'FR'], num: 16, ca: 146, pa: 172, val: M(22), wage: K(48), exp: '2029-06-30', h: 182, w: 76, t: { finishing: 16, heading: 16, offTheBall: 16 } }),
  p({ name: 'Yarek Gasiorowski', clubId: 'valencia', nat: 'ESP', age: 21, pos: ['DC', 'DL'], foot: 'left', num: 24, ca: 146, pa: 176, wk: true, val: M(24), wage: K(32), exp: '2029-06-30', h: 192, w: 83, t: { heading: 16, tackling: 16 }, p: { jumping: 17 } }),

  // Italy
  p({ name: 'Mattia Liberali', clubId: 'ac-milan', nat: 'ITA', age: 19, pos: ['AMC', 'FR'], foot: 'left', num: 28, ca: 134, pa: 178, wk: true, val: M(16), wage: K(20), exp: '2029-06-30', h: 169, w: 63, t: { dribbling: 17, technique: 17, passing: 16 }, m: { creativity: 17, flair: 18 } }),
  p({ name: 'Luka Topalović', clubId: 'inter-milan', nat: 'SVN', age: 20, pos: ['AMC', 'MC'], num: 55, ca: 134, pa: 174, wk: true, val: M(12), wage: K(22), exp: '2029-06-30', h: 187, w: 77, t: { passing: 16, technique: 16, longShots: 15 }, m: { creativity: 16, determination: 17 } }),
  p({ name: 'Vasilije Adžić', clubId: 'juventus', nat: 'MNE', age: 20, pos: ['AMC', 'MC'], num: 17, ca: 140, pa: 177, wk: true, val: M(18), wage: K(30), exp: '2029-06-30', caps: 6, h: 185, w: 76, t: { technique: 17, longShots: 16, passing: 16 }, m: { creativity: 17 } }),
  p({ name: 'Honest Ahanor', clubId: 'genoa', nat: 'ITA', age: 18, pos: ['DL', 'DC'], foot: 'left', num: 69, ca: 136, pa: 179, wk: true, val: M(18), wage: K(18), exp: '2029-06-30', h: 184, w: 75, t: { tackling: 15, dribbling: 15 }, p: { pace: 18, acceleration: 18 } }),

  // Germany & France
  p({ name: 'Finn Jeltsch', clubId: 'vfb-stuttgart', nat: 'GER', age: 20, pos: ['DC'], num: 29, ca: 144, pa: 177, wk: true, val: M(22), wage: K(30), exp: '2030-06-30', h: 188, w: 80, t: { tackling: 16, passing: 15 }, m: { anticipation: 16 } }),
  p({ name: 'Noah Darvich', clubId: 'vfb-stuttgart', nat: 'GER', age: 19, pos: ['AMC', 'FR'], foot: 'left', num: 32, ca: 137, pa: 176, wk: true, val: M(14), wage: K(24), exp: '2029-06-30', h: 184, w: 73, t: { technique: 17, passing: 16, dribbling: 16 }, m: { creativity: 17 } }),
  p({ name: 'Ibrahim Mbaye', clubId: 'psg', nat: 'FRA', age: 18, pos: ['FR', 'FL'], num: 49, ca: 138, pa: 180, wk: true, val: M(20), wage: K(28), exp: '2029-06-30', h: 175, w: 67, t: { dribbling: 17 }, p: { pace: 18, acceleration: 19 } }),
  p({ name: 'Darryl Bakola', clubId: 'marseille', nat: 'FRA', age: 18, pos: ['MC', 'AMC'], num: 50, ca: 132, pa: 174, wk: true, val: M(12), wage: K(16), exp: '2029-06-30', h: 178, w: 70, t: { dribbling: 16, passing: 15 } }),
  p({ name: 'George Ilenikhena', clubId: 'monaco', nat: 'FRA', age: 19, pos: ['FC'], foot: 'left', num: 21, ca: 146, pa: 178, wk: true, val: M(26), wage: K(42), exp: '2029-06-30', h: 185, w: 78, t: { finishing: 16 }, p: { pace: 18, strength: 17 } }),
  p({ name: 'Rayane Messi', clubId: 'strasbourg', nat: 'FRA', age: 19, pos: ['FL', 'FR'], num: 37, ca: 133, pa: 174, wk: true, val: M(12), wage: K(16), exp: '2029-06-30', h: 178, w: 70, t: { dribbling: 16, technique: 16 }, p: { pace: 17 } }),

  // Slovenia & Balkans extra wonderkids
  p({ name: 'Tian Nai Koren', clubId: 'maribor', nat: 'SVN', age: 17, pos: ['AMC', 'MC'], num: 47, ca: 112, pa: 168, wk: true, val: M(1.4), wage: K(1.8), exp: '2029-06-30', h: 179, w: 69, t: { technique: 15, passing: 15, dribbling: 15 }, m: { creativity: 16, flair: 16 } }),
  p({ name: 'Sven Šunta', clubId: 'dinamo-zagreb', nat: 'SVN', age: 19, pos: ['AMC', 'MC'], num: 44, ca: 122, pa: 166, wk: true, val: M(2.4), wage: K(4.5), exp: '2029-06-30', h: 181, w: 72, t: { passing: 15, technique: 15, setPieces: 15 }, m: { creativity: 16 } }),
  p({ name: 'Arman Durmiši', clubId: 'juventus', nat: 'SVN', age: 18, pos: ['FC'], num: 45, ca: 120, pa: 168, wk: true, val: M(3), wage: K(8), exp: '2029-06-30', h: 190, w: 80, t: { finishing: 15, heading: 15 }, p: { pace: 16, strength: 16 } }),
  p({ name: 'Cardoso Varela', clubId: 'dinamo-zagreb', nat: 'POR', age: 17, pos: ['FL', 'FR'], num: 77, ca: 126, pa: 178, wk: true, val: M(6), wage: K(6), exp: '2029-06-30', h: 174, w: 65, t: { dribbling: 17, technique: 16 }, m: { flair: 18 }, p: { acceleration: 18, pace: 18 } }),
  p({ name: 'Zépiqueno Redmond', clubId: 'feyenoord', nat: 'NED', age: 20, pos: ['FC'], num: 49, ca: 136, pa: 172, wk: true, val: M(10), wage: K(16), exp: '2029-06-30', h: 188, w: 79, t: { finishing: 15 }, p: { pace: 17, strength: 16 } }),
  p({ name: 'João Simões', clubId: 'sporting-cp', nat: 'POR', age: 19, pos: ['MC', 'DMC'], num: 52, ca: 140, pa: 176, wk: true, val: M(18), wage: K(22), exp: '2030-06-30', h: 175, w: 68, t: { passing: 16, tackling: 15 }, m: { determination: 18, workRate: 18 } }),
  p({ name: 'Sami Bouhoudane', clubId: 'psv', nat: 'NED', age: 18, pos: ['FC'], num: 42, ca: 128, pa: 172, wk: true, val: M(8), wage: K(12), exp: '2029-06-30', h: 183, w: 75, t: { finishing: 15, offTheBall: 15 } }),
  p({ name: 'Sean Steur', clubId: 'ajax', nat: 'NED', age: 18, pos: ['MC', 'AMC'], num: 43, ca: 132, pa: 176, wk: true, val: M(12), wage: K(14), exp: '2029-06-30', h: 178, w: 69, t: { passing: 16, technique: 16 }, m: { creativity: 16 } }),
  p({ name: 'Julian Rijkhoff', clubId: 'ajax', nat: 'NED', age: 21, pos: ['FC'], num: 29, ca: 136, pa: 165, wk: true, val: M(7), wage: K(18), exp: '2028-06-30', h: 183, w: 75, t: { finishing: 15, offTheBall: 15 } }),

  // =========================================================================
  // FREE AGENTS / UNATTACHED PLAYERS (clubId: null) — 36 DAY-1 CM 01/02 BARGAINS!
  // =========================================================================
  // Goalkeepers (4)
  p({ name: 'Keylor Navas', clubId: null, nat: 'CRC', age: 39, pos: ['GK'], ca: 146, pa: 146, val: 0, wage: K(35), caps: 114, h: 185, w: 80, m: { bravery: 17, determination: 17 }, g: { handling: 15, reflexes: 17, oneOnOnes: 17, positioning: 16 } }),
  p({ name: 'Rui Patrício', clubId: null, nat: 'POR', age: 38, pos: ['GK'], foot: 'left', ca: 143, pa: 143, val: 0, wage: K(30), caps: 108, h: 190, w: 84, m: { influence: 17 }, g: { handling: 15, reflexes: 16, oneOnOnes: 16, positioning: 16 } }),
  p({ name: 'Loris Karius', clubId: null, nat: 'GER', age: 33, pos: ['GK'], ca: 138, pa: 138, val: 0, wage: K(24), h: 189, w: 87, g: { handling: 14, reflexes: 16, oneOnOnes: 15, positioning: 14 } }),
  p({ name: 'Matjaž Rozman', clubId: null, nat: 'SVN', age: 39, pos: ['GK'], ca: 114, pa: 114, val: 0, wage: K(2.5), h: 188, w: 82, m: { influence: 16 }, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 14 } }),

  // Defenders (10)
  p({ name: 'Sergio Ramos', clubId: null, nat: 'ESP', age: 40, pos: ['DC', 'DR'], ca: 149, pa: 149, val: 0, wage: K(55), caps: 180, goals: 23, h: 184, w: 82, t: { heading: 18, tackling: 16, penalties: 18 }, m: { influence: 20, bravery: 20, aggression: 19, determination: 19 } }),
  p({ name: 'Mats Hummels', clubId: null, nat: 'GER', age: 37, pos: ['DC'], ca: 150, pa: 150, val: 0, wage: K(48), caps: 78, goals: 5, h: 191, w: 94, t: { passing: 17, tackling: 17, heading: 17 }, m: { anticipation: 19, decisions: 18, influence: 18 } }),
  p({ name: 'Victor Lindelöf', clubId: null, nat: 'SWE', age: 32, pos: ['DC', 'DR'], ca: 151, pa: 151, val: 0, wage: K(58), caps: 72, goals: 3, h: 187, w: 80, t: { passing: 15, marking: 15, tackling: 15 }, m: { decisions: 16 } }),
  p({ name: 'Kurt Zouma', clubId: null, nat: 'FRA', age: 31, pos: ['DC'], ca: 147, pa: 147, val: 0, wage: K(50), caps: 11, goals: 1, h: 190, w: 95, t: { heading: 17, tackling: 15 }, p: { strength: 18, jumping: 18 } }),
  p({ name: 'Sergio Reguilón', clubId: null, nat: 'ESP', age: 29, pos: ['DL', 'ML'], foot: 'left', ca: 148, pa: 150, val: 0, wage: K(48), caps: 6, h: 178, w: 68, t: { crossing: 15, tackling: 15 }, p: { pace: 17, acceleration: 17 } }),
  p({ name: 'Takehiro Tomiyasu', clubId: null, nat: 'JPN', age: 27, pos: ['DR', 'DC', 'DL'], foot: 'both', ca: 156, pa: 162, val: 0, wage: K(75), caps: 46, goals: 1, h: 188, w: 84, t: { tackling: 17, marking: 17, heading: 16 }, m: { decisions: 17, teamwork: 17 }, p: { injuryProneness: 17 } }),
  p({ name: 'Tariq Lamptey', clubId: null, nat: 'GHA', age: 25, pos: ['DR', 'MR'], ca: 146, pa: 154, val: 0, wage: K(42), caps: 12, h: 163, w: 60, t: { dribbling: 16 }, p: { pace: 19, acceleration: 19, agility: 18, injuryProneness: 16 } }),
  p({ name: 'Miha Mevlja', clubId: null, nat: 'SVN', age: 36, pos: ['DC'], ca: 119, pa: 119, val: 0, wage: K(4), caps: 50, goals: 2, h: 190, w: 84, t: { heading: 15, marking: 14 }, m: { influence: 16 } }),
  p({ name: 'Serge Aurier', clubId: null, nat: 'CIV', age: 33, pos: ['DR', 'MR'], ca: 140, pa: 140, val: 0, wage: K(28), caps: 93, goals: 4, h: 176, w: 76, t: { tackling: 15 }, m: { aggression: 17 } }),
  p({ name: 'Layvin Kurzawa', clubId: null, nat: 'FRA', age: 33, pos: ['DL'], foot: 'left', ca: 136, pa: 136, val: 0, wage: K(22), caps: 13, goals: 1, h: 182, w: 74, t: { crossing: 15 } }),

  // Midfielders (12)
  p({ name: 'Christian Eriksen', clubId: null, nat: 'DEN', age: 34, pos: ['MC', 'AMC'], foot: 'both', ca: 152, pa: 152, val: 0, wage: K(65), caps: 144, goals: 44, h: 182, w: 76, t: { passing: 18, setPieces: 19, technique: 18, crossing: 18 }, m: { creativity: 19, decisions: 18 } }),
  p({ name: 'Marco Verratti', clubId: null, nat: 'ITA', age: 33, pos: ['MC', 'DMC'], ca: 155, pa: 155, val: 0, wage: K(78), caps: 55, goals: 3, h: 165, w: 60, t: { passing: 18, dribbling: 18, technique: 18, tackling: 16 }, m: { creativity: 18, bravery: 17 }, p: { balance: 18 } }),
  p({ name: 'Paul Pogba', clubId: null, nat: 'FRA', age: 33, pos: ['MC', 'AMC'], ca: 151, pa: 154, val: 0, wage: K(68), caps: 91, goals: 11, h: 191, w: 84, t: { passing: 18, technique: 18, longShots: 17, dribbling: 16 }, m: { flair: 18, creativity: 18 }, p: { strength: 17 } }),
  p({ name: 'Thomas Partey', clubId: null, nat: 'GHA', age: 33, pos: ['DMC', 'MC'], ca: 155, pa: 155, val: 0, wage: K(82), caps: 54, goals: 14, h: 185, w: 77, t: { passing: 16, tackling: 17, longShots: 16 }, p: { strength: 17 } }),
  p({ name: 'Miralem Pjanić', clubId: null, nat: 'BIH', age: 36, pos: ['DMC', 'MC'], ca: 141, pa: 141, val: 0, wage: K(28), caps: 115, goals: 17, h: 178, w: 72, t: { passing: 17, setPieces: 18, technique: 17 }, m: { creativity: 17 } }),
  p({ name: 'Josh Brownhill', clubId: null, nat: 'ENG', age: 30, pos: ['MC', 'AMC'], ca: 150, pa: 152, val: 0, wage: K(52), h: 180, w: 72, t: { passing: 15, longShots: 16, finishing: 15 }, m: { influence: 17, workRate: 18 }, p: { stamina: 18 } }),
  p({ name: 'Dele Alli', clubId: null, nat: 'ENG', age: 30, pos: ['AMC', 'MC'], ca: 141, pa: 146, val: 0, wage: K(32), caps: 37, goals: 3, h: 188, w: 80, t: { offTheBall: 16, technique: 16 }, m: { flair: 16 } }),
  p({ name: 'Rafinha Alcântara', clubId: null, nat: 'BRA', age: 33, pos: ['AMC', 'MC'], foot: 'left', ca: 142, pa: 142, val: 0, wage: K(28), caps: 2, goals: 1, h: 174, w: 71, t: { dribbling: 16, technique: 16, passing: 16 } }),
  p({ name: 'Alex Oxlade-Chamberlain', clubId: null, nat: 'ENG', age: 32, pos: ['MC', 'MR', 'AMC'], ca: 143, pa: 143, val: 0, wage: K(36), caps: 35, goals: 7, h: 175, w: 70, t: { longShots: 16, dribbling: 15 } }),
  p({ name: 'Rene Krhin', clubId: null, nat: 'SVN', age: 36, pos: ['DMC', 'MC'], ca: 116, pa: 116, val: 0, wage: K(3.2), caps: 48, goals: 2, h: 189, w: 80, t: { tackling: 14, passing: 14 } }),
  p({ name: 'Hakim Ziyech', clubId: null, nat: 'MAR', age: 33, pos: ['FR', 'AMC'], foot: 'left', ca: 150, pa: 150, val: 0, wage: K(55), caps: 64, goals: 25, h: 180, w: 65, t: { crossing: 18, setPieces: 18, passing: 17, technique: 18 }, m: { creativity: 18, flair: 18 } }),
  p({ name: 'Lorenzo Insigne', clubId: null, nat: 'ITA', age: 35, pos: ['FL', 'AMC'], ca: 147, pa: 147, val: 0, wage: K(45), caps: 54, goals: 10, h: 163, w: 59, t: { dribbling: 17, technique: 17, longShots: 16 }, m: { flair: 17 } }),

  // Forwards & Wingers (10)
  p({ name: 'Dominic Calvert-Lewin', clubId: null, nat: 'ENG', age: 29, pos: ['FC'], ca: 151, pa: 154, val: 0, wage: K(65), caps: 11, goals: 4, h: 187, w: 71, t: { heading: 18, finishing: 15 }, p: { jumping: 19, strength: 17 } }),
  p({ name: 'Jamie Vardy', clubId: null, nat: 'ENG', age: 39, pos: ['FC'], ca: 144, pa: 144, val: 0, wage: K(35), caps: 26, goals: 7, h: 179, w: 74, t: { finishing: 17, offTheBall: 18 }, m: { anticipation: 18, determination: 19 } }),
  p({ name: 'Luka Jović', clubId: null, nat: 'SRB', age: 28, pos: ['FC'], foot: 'both', ca: 150, pa: 154, val: 0, wage: K(55), caps: 46, goals: 11, h: 182, w: 85, t: { finishing: 16, heading: 16, technique: 16 } }),
  p({ name: 'Callum Wilson', clubId: null, nat: 'ENG', age: 34, pos: ['FC'], ca: 147, pa: 147, val: 0, wage: K(45), caps: 9, goals: 2, h: 180, w: 66, t: { finishing: 16, offTheBall: 17 }, p: { injuryProneness: 17 } }),
  p({ name: 'Wissam Ben Yedder', clubId: null, nat: 'FRA', age: 35, pos: ['FC'], foot: 'both', ca: 146, pa: 146, val: 0, wage: K(38), caps: 19, goals: 3, h: 170, w: 68, t: { finishing: 17, dribbling: 16, technique: 17 } }),
  p({ name: 'Mario Balotelli', clubId: null, nat: 'ITA', age: 35, pos: ['FC'], ca: 138, pa: 138, val: 0, wage: K(24), caps: 36, goals: 14, h: 189, w: 88, t: { penalties: 18, longShots: 17, finishing: 15 }, m: { flair: 16 } }),
  p({ name: 'Diego Costa', clubId: null, nat: 'ESP', age: 37, pos: ['FC'], ca: 135, pa: 135, val: 0, wage: K(20), caps: 24, goals: 10, h: 186, w: 86, m: { aggression: 20, bravery: 19, determination: 18 }, p: { strength: 17 } }),
  p({ name: 'Ryan Kent', clubId: null, nat: 'ENG', age: 29, pos: ['FL', 'FR'], foot: 'both', ca: 141, pa: 144, val: 0, wage: K(28), h: 172, w: 66, t: { dribbling: 16 }, p: { pace: 17, acceleration: 17 } }),
  p({ name: 'Patrick Bamford', clubId: null, nat: 'ENG', age: 32, pos: ['FC'], foot: 'left', ca: 142, pa: 142, val: 0, wage: K(32), caps: 1, h: 185, w: 71, t: { offTheBall: 16, finishing: 15 }, m: { workRate: 17 } }),
  p({ name: 'Luka Zahović', clubId: null, nat: 'SVN', age: 30, pos: ['FC', 'AMC'], ca: 127, pa: 130, val: 0, wage: K(8.5), caps: 15, h: 177, w: 70, t: { finishing: 15, offTheBall: 16, technique: 15 }, m: { anticipation: 16 } }),
];
