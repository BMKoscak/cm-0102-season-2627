import type { RealPlayerSeed } from '../../types/contracts';
import { K, M, p } from './helpers';

export const SLOVENIA_AND_BALKANS_ROSTERS: RealPlayerSeed[] = [
  // =========================================================================
  // SLOVENIA — PRVALIGA TELEMACH
  // =========================================================================

  // --- NK OLIMPIJA LJUBLJANA ---
  p({ name: 'Matevž Vidovšek', clubId: 'olimpija-ljubljana', nat: 'SVN', age: 26, pos: ['GK'], num: 69, ca: 132, pa: 146, val: M(2.8), wage: K(6.5), exp: '2028-06-30', caps: 6, h: 199, w: 92, m: { bravery: 15, determination: 16 }, p: { jumping: 16 }, g: { handling: 15, reflexes: 16, oneOnOnes: 16, positioning: 15 } }),
  p({ name: 'Gal Lubej Fink', clubId: 'olimpija-ljubljana', nat: 'SVN', age: 24, pos: ['GK'], num: 36, ca: 112, pa: 128, val: K(450), wage: K(2.5), exp: '2028-06-30', h: 191, w: 84, g: { handling: 12, reflexes: 13, oneOnOnes: 12, positioning: 12 } }),
  p({ name: 'Marcel Ratnik', clubId: 'olimpija-ljubljana', nat: 'SVN', age: 22, pos: ['DC', 'DR'], num: 14, ca: 131, pa: 156, val: M(3.2), wage: K(6), exp: '2029-06-30', caps: 6, h: 185, w: 78, t: { tackling: 15, passing: 15, marking: 14 }, m: { influence: 16, decisions: 15, determination: 16 }, p: { pace: 14 } }),
  p({ name: 'Ahmet Muhamedbegović', clubId: 'olimpija-ljubljana', nat: 'AUT', age: 27, pos: ['DC', 'DL'], foot: 'left', num: 16, ca: 124, pa: 128, val: M(1.2), wage: K(4.8), exp: '2028-06-30', h: 187, w: 80, t: { heading: 14, tackling: 14, marking: 14 } }),
  p({ name: 'Jorge Silva', clubId: 'olimpija-ljubljana', nat: 'POR', age: 30, pos: ['DR', 'MR'], num: 2, ca: 123, pa: 125, val: K(950), wage: K(4.5), exp: '2027-06-30', h: 179, w: 74, t: { crossing: 14, tackling: 13 }, p: { pace: 15, stamina: 15 } }),
  p({ name: 'David Sualehe', clubId: 'olimpija-ljubljana', nat: 'POR', age: 29, pos: ['DL', 'ML'], foot: 'left', num: 3, ca: 122, pa: 125, val: K(900), wage: K(4.2), exp: '2027-06-30', h: 182, w: 76, t: { crossing: 14, dribbling: 13 }, p: { pace: 15 } }),
  p({ name: 'Agustín Doffo', clubId: 'olimpija-ljubljana', nat: 'ARG', age: 31, pos: ['DMC', 'MC'], num: 34, ca: 128, pa: 128, val: M(1.4), wage: K(5.8), exp: '2028-06-30', h: 174, w: 69, t: { tackling: 15, passing: 15 }, m: { workRate: 17, determination: 17, influence: 16 }, p: { stamina: 16 } }),
  p({ name: 'Peter Agba', clubId: 'olimpija-ljubljana', nat: 'NGA', age: 23, pos: ['DMC', 'MC'], num: 6, ca: 123, pa: 142, val: M(1.5), wage: K(4.2), exp: '2028-06-30', h: 183, w: 76, t: { tackling: 14, passing: 13 }, p: { stamina: 16, strength: 15 } }),
  p({ name: 'Thalisson', shortName: 'Thalisson', clubId: 'olimpija-ljubljana', nat: 'BRA', age: 27, pos: ['MC', 'AMC'], num: 88, ca: 124, pa: 130, val: M(1.2), wage: K(4.8), exp: '2028-06-30', h: 177, w: 72, t: { dribbling: 14, passing: 14, longShots: 14 } }),
  p({ name: 'Diogo Pinto', clubId: 'olimpija-ljubljana', nat: 'POR', age: 27, pos: ['AMC', 'MC'], num: 21, ca: 125, pa: 131, val: M(1.3), wage: K(5), exp: '2028-06-30', h: 180, w: 73, t: { passing: 15, technique: 15, setPieces: 15 }, m: { creativity: 15 } }),
  p({ name: 'Marko Brest', clubId: 'olimpija-ljubljana', nat: 'SVN', age: 24, pos: ['FL', 'ML', 'AMC'], num: 19, ca: 125, pa: 140, val: M(1.6), wage: K(4.5), exp: '2028-06-30', caps: 2, h: 181, w: 74, t: { dribbling: 15, finishing: 13, crossing: 14 }, p: { pace: 16, acceleration: 16 } }),
  p({ name: 'Raul Florucz', clubId: 'olimpija-ljubljana', nat: 'AUT', age: 25, pos: ['FR', 'AMC', 'FC'], foot: 'left', num: 10, ca: 134, pa: 150, val: M(3.8), wage: K(7.5), exp: '2029-06-30', caps: 4, h: 182, w: 74, t: { dribbling: 16, finishing: 15, technique: 16, setPieces: 15 }, m: { flair: 16, creativity: 15 }, p: { acceleration: 16, agility: 16 } }),
  p({ name: 'Dino Kojić', clubId: 'olimpija-ljubljana', nat: 'SVN', age: 21, pos: ['FL', 'AMC', 'FC'], num: 23, ca: 121, pa: 162, wk: true, val: M(1.8), wage: K(3.5), exp: '2029-06-30', h: 180, w: 72, t: { dribbling: 15, technique: 15, finishing: 14 }, m: { flair: 16, determination: 16 }, p: { pace: 16, acceleration: 16 } }),
  p({ name: 'Alex Tamm', clubId: 'olimpija-ljubljana', nat: 'EST', age: 25, pos: ['FC'], num: 9, ca: 125, pa: 136, val: M(1.5), wage: K(4.8), exp: '2028-06-30', caps: 18, goals: 4, h: 190, w: 83, t: { finishing: 14, heading: 15 }, p: { strength: 15 } }),
  p({ name: 'Ivan Durdov', clubId: 'olimpija-ljubljana', nat: 'CRO', age: 26, pos: ['FC'], num: 99, ca: 122, pa: 128, val: M(1.1), wage: K(4.2), exp: '2028-06-30', h: 193, w: 86, t: { heading: 15, finishing: 14 }, p: { strength: 16 } }),

  // --- NK MARIBOR ---
  p({ name: 'Ažbe Jug', clubId: 'maribor', nat: 'SVN', age: 34, pos: ['GK'], num: 1, ca: 125, pa: 125, val: K(650), wage: K(5.2), exp: '2027-06-30', h: 192, w: 85, m: { influence: 16, bravery: 15 }, g: { handling: 14, reflexes: 15, oneOnOnes: 14, positioning: 14 } }),
  p({ name: 'Pijus Širvys', clubId: 'maribor', nat: 'LTU', age: 28, pos: ['DR', 'MR'], num: 22, ca: 124, pa: 128, val: M(1.2), wage: K(4.5), exp: '2028-06-30', caps: 26, goals: 3, h: 185, w: 78, t: { crossing: 14, tackling: 14 }, m: { workRate: 16 }, p: { stamina: 16, pace: 15 } }),
  p({ name: 'Luka Krajnc', clubId: 'maribor', nat: 'SVN', age: 31, pos: ['DC', 'DL'], foot: 'left', num: 4, ca: 124, pa: 125, val: K(850), wage: K(5), exp: '2028-06-30', caps: 4, h: 189, w: 82, t: { heading: 15, marking: 14, tackling: 14 } }),
  p({ name: 'Bradley M\'Bondo', clubId: 'maribor', nat: 'FRA', age: 24, pos: ['DC'], num: 5, ca: 122, pa: 138, val: M(1.2), wage: K(4.2), exp: '2028-06-30', h: 190, w: 84, t: { tackling: 14, heading: 14 }, p: { pace: 15, strength: 16 } }),
  p({ name: 'Omar Rekik', clubId: 'maribor', nat: 'TUN', age: 24, pos: ['DC', 'DMC'], num: 44, ca: 123, pa: 139, val: M(1.3), wage: K(4.5), exp: '2028-06-30', caps: 6, h: 186, w: 79, t: { passing: 14, tackling: 14 } }),
  p({ name: 'Jan Repas', clubId: 'maribor', nat: 'SVN', age: 29, pos: ['MC', 'AMC'], num: 15, ca: 129, pa: 132, val: M(1.8), wage: K(6), exp: '2028-06-30', caps: 4, h: 178, w: 72, t: { passing: 15, technique: 15, dribbling: 14 }, m: { workRate: 17, influence: 16, teamwork: 16 }, p: { stamina: 16 } }),
  p({ name: 'Žiga Repas', clubId: 'maribor', nat: 'SVN', age: 25, pos: ['MC', 'DMC'], num: 20, ca: 124, pa: 136, val: M(1.3), wage: K(4.4), exp: '2028-06-30', h: 177, w: 71, t: { passing: 14, tackling: 14 }, m: { workRate: 16 } }),
  p({ name: 'Bartuğ Elmaz', clubId: 'maribor', nat: 'TUR', age: 23, pos: ['DMC', 'MC'], num: 6, ca: 125, pa: 146, val: M(1.6), wage: K(5.2), exp: '2028-06-30', h: 179, w: 72, t: { passing: 15, setPieces: 15, technique: 15 } }),
  p({ name: 'Josip Iličić', clubId: 'maribor', nat: 'SVN', age: 38, pos: ['AMC', 'FR'], foot: 'left', num: 72, ca: 126, pa: 126, val: K(350), wage: K(6.5), exp: '2027-06-30', caps: 86, goals: 17, h: 190, w: 79, t: { technique: 18, passing: 17, setPieces: 17, dribbling: 16, longShots: 17 }, m: { creativity: 18, flair: 18 } }),
  p({ name: 'Hilal Soudani', clubId: 'maribor', nat: 'ALG', age: 38, pos: ['FR', 'FC', 'FL'], foot: 'left', num: 2, ca: 123, pa: 123, val: K(300), wage: K(5.8), exp: '2027-06-30', caps: 56, goals: 24, h: 177, w: 75, t: { finishing: 15, offTheBall: 16 }, m: { determination: 17 } }),
  p({ name: 'Sheyi Ojo', clubId: 'maribor', nat: 'ENG', age: 29, pos: ['FL', 'FR'], foot: 'left', num: 97, ca: 124, pa: 127, val: M(1.1), wage: K(5.5), exp: '2028-06-30', h: 178, w: 73, t: { dribbling: 15 }, p: { pace: 16, acceleration: 16 } }),
  p({ name: 'Benjamin Tetteh', clubId: 'maribor', nat: 'GHA', age: 29, pos: ['FC'], num: 30, ca: 130, pa: 133, val: M(2.2), wage: K(6.8), exp: '2028-06-30', caps: 9, h: 193, w: 86, t: { finishing: 15, heading: 16, technique: 14 }, p: { strength: 17, pace: 15 } }),
  p({ name: 'Niko Grlić', clubId: 'maribor', nat: 'SVN', age: 19, pos: ['FL', 'FR', 'AMC'], num: 41, ca: 118, pa: 164, wk: true, val: M(1.6), wage: K(2.8), exp: '2029-06-30', h: 178, w: 70, t: { dribbling: 15, technique: 15, finishing: 13 }, m: { flair: 16, determination: 16 }, p: { pace: 16, acceleration: 16 } }),
  p({ name: 'Nejc Viher', clubId: 'maribor', nat: 'SVN', age: 18, pos: ['MC', 'DMC'], num: 37, ca: 114, pa: 162, wk: true, val: M(1.2), wage: K(2.2), exp: '2029-06-30', h: 181, w: 72, t: { passing: 14, technique: 14 }, m: { decisions: 15, teamwork: 15 } }),

  // --- NK CELJE ---
  p({ name: 'Ricardo Silva', clubId: 'celje', nat: 'POR', age: 27, pos: ['GK'], num: 1, ca: 124, pa: 132, val: M(1.1), wage: K(4.5), exp: '2028-06-30', h: 189, w: 81, g: { handling: 14, reflexes: 15, oneOnOnes: 14, positioning: 14 } }),
  p({ name: 'Žan Karničnik', clubId: 'celje', nat: 'SVN', age: 31, pos: ['DR', 'DL', 'DC'], num: 23, ca: 134, pa: 136, val: M(2.4), wage: K(7.2), exp: '2028-06-30', caps: 42, goals: 2, h: 178, w: 74, t: { tackling: 15, crossing: 15, passing: 15 }, m: { influence: 17, workRate: 18, determination: 18, decisions: 16 }, p: { stamina: 17, pace: 15 } }),
  p({ name: 'Damjan Vuklišević', clubId: 'celje', nat: 'SVN', age: 31, pos: ['DC'], num: 2, ca: 122, pa: 124, val: K(800), wage: K(4.2), exp: '2027-06-30', h: 189, w: 82, t: { heading: 15, tackling: 14 } }),
  p({ name: 'Klemen Nemanič', clubId: 'celje', nat: 'SVN', age: 29, pos: ['DC'], num: 81, ca: 123, pa: 126, val: K(950), wage: K(4.4), exp: '2028-06-30', h: 192, w: 85, t: { heading: 15, marking: 14 }, p: { strength: 16 } }),
  p({ name: 'Juanjo Nieto', clubId: 'celje', nat: 'ESP', age: 31, pos: ['DR', 'MR'], num: 4, ca: 124, pa: 125, val: K(900), wage: K(4.8), exp: '2028-06-30', h: 178, w: 72, t: { crossing: 15, passing: 14 }, m: { workRate: 16 } }),
  p({ name: 'Mark Zabukovnik', clubId: 'celje', nat: 'SVN', age: 25, pos: ['DMC', 'MC'], num: 19, ca: 129, pa: 144, val: M(2.2), wage: K(5.5), exp: '2028-06-30', caps: 4, h: 185, w: 78, t: { passing: 15, tackling: 15 }, m: { decisions: 16, teamwork: 16, workRate: 17 } }),
  p({ name: 'Tamar Svetlin', clubId: 'celje', nat: 'SVN', age: 25, pos: ['MC', 'AMC'], num: 88, ca: 128, pa: 143, val: M(2.1), wage: K(5.2), exp: '2028-06-30', caps: 4, h: 180, w: 73, t: { passing: 15, technique: 15, dribbling: 15 }, m: { creativity: 15, workRate: 16 } }),
  p({ name: 'Svit Sešlar', clubId: 'celje', nat: 'SVN', age: 24, pos: ['AMC', 'FR', 'MC'], foot: 'left', num: 11, ca: 134, pa: 154, val: M(3.6), wage: K(7), exp: '2029-06-30', caps: 6, h: 187, w: 75, t: { passing: 16, technique: 16, setPieces: 16, dribbling: 15 }, m: { creativity: 17, flair: 16, decisions: 15 } }),
  p({ name: 'Mario Kvesić', clubId: 'celje', nat: 'BIH', age: 34, pos: ['AMC', 'MC'], num: 10, ca: 125, pa: 125, val: K(600), wage: K(5.2), exp: '2027-06-30', h: 178, w: 72, t: { passing: 15, setPieces: 16, longShots: 15 }, m: { creativity: 16 } }),
  p({ name: 'Aljoša Matko', clubId: 'celje', nat: 'SVN', age: 26, pos: ['FR', 'FC', 'FL'], num: 7, ca: 128, pa: 138, val: M(2), wage: K(5.5), exp: '2028-06-30', caps: 2, h: 177, w: 72, t: { finishing: 15, dribbling: 15 }, p: { pace: 17, acceleration: 17 } }),
  p({ name: 'Armandas Kučys', clubId: 'celje', nat: 'LTU', age: 23, pos: ['FC'], num: 9, ca: 127, pa: 146, val: M(2.2), wage: K(5), exp: '2029-06-30', caps: 18, goals: 5, h: 194, w: 85, t: { finishing: 15, heading: 16 }, p: { strength: 16, pace: 15 } }),
  p({ name: 'Logan Delaurier-Chaubet', clubId: 'celje', nat: 'FRA', age: 24, pos: ['FR', 'AMC'], foot: 'left', num: 17, ca: 123, pa: 138, val: M(1.3), wage: K(4.5), exp: '2028-06-30', h: 178, w: 70, t: { dribbling: 15, setPieces: 15 } }),
  p({ name: 'Nikita Iosifov', clubId: 'celje', nat: 'RUS', age: 25, pos: ['FL', 'FR'], num: 20, ca: 122, pa: 135, val: M(1.1), wage: K(4.2), exp: '2028-06-30', h: 175, w: 68, t: { dribbling: 15 }, p: { pace: 16 } }),

  // --- FC KOPER ---
  p({ name: 'Metod Jurhar', clubId: 'koper', nat: 'SVN', age: 28, pos: ['GK'], num: 1, ca: 118, pa: 123, val: K(600), wage: K(3.2), exp: '2028-06-30', h: 190, w: 83, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 13 } }),
  p({ name: 'Maj Mittendorfer', clubId: 'koper', nat: 'SVN', age: 26, pos: ['DC'], num: 4, ca: 120, pa: 130, val: K(800), wage: K(3.4), exp: '2028-06-30', h: 188, w: 82, t: { heading: 14, tackling: 14 } }),
  p({ name: 'Ahmed Sidibé', clubId: 'koper', nat: 'FRA', age: 24, pos: ['DC', 'DR'], num: 21, ca: 121, pa: 136, val: M(1), wage: K(3.5), exp: '2028-06-30', h: 188, w: 80, t: { tackling: 14 }, p: { pace: 15, strength: 15 } }),
  p({ name: 'Nik Omladič', clubId: 'koper', nat: 'SVN', age: 36, pos: ['AMC', 'MR'], foot: 'left', num: 10, ca: 116, pa: 116, val: K(200), wage: K(3.2), exp: '2027-06-30', caps: 6, h: 178, w: 72, t: { setPieces: 15, passing: 14 } }),
  p({ name: 'Omar El Manssouri', clubId: 'koper', nat: 'FRA', age: 25, pos: ['MC', 'AMC'], num: 8, ca: 119, pa: 130, val: K(750), wage: K(3.2), exp: '2028-06-30', h: 178, w: 71, t: { dribbling: 14, passing: 14 } }),
  p({ name: 'Isaac Matondo', clubId: 'koper', nat: 'FRA', age: 27, pos: ['FL', 'FR'], num: 7, ca: 121, pa: 128, val: K(900), wage: K(3.6), exp: '2028-06-30', h: 174, w: 68, t: { dribbling: 15 }, p: { pace: 16, acceleration: 16 } }),
  p({ name: 'Deni Jurić', clubId: 'koper', nat: 'AUS', age: 28, pos: ['FC'], num: 9, ca: 123, pa: 128, val: M(1.1), wage: K(4), exp: '2028-06-30', h: 188, w: 82, t: { finishing: 15, heading: 14 } }),
  p({ name: 'Tomi Jurić', clubId: 'koper', nat: 'AUS', age: 35, pos: ['FC'], num: 19, ca: 118, pa: 118, val: K(300), wage: K(3.8), exp: '2027-06-30', caps: 41, goals: 8, h: 190, w: 86, t: { heading: 15, finishing: 14 } }),

  // --- NK BRAVO ---
  p({ name: 'Matija Orbanić', clubId: 'bravo', nat: 'CRO', age: 26, pos: ['GK'], num: 31, ca: 119, pa: 128, val: K(700), wage: K(2.8), exp: '2028-06-30', h: 189, w: 82, g: { handling: 13, reflexes: 15, oneOnOnes: 14, positioning: 13 } }),
  p({ name: 'Nemanja Jakšić', clubId: 'bravo', nat: 'SRB', age: 31, pos: ['DC', 'DR'], num: 14, ca: 117, pa: 118, val: K(500), wage: K(2.8), exp: '2027-06-30', h: 184, w: 78, t: { tackling: 14 } }),
  p({ name: 'Gašper Jovan', clubId: 'bravo', nat: 'SVN', age: 25, pos: ['DL', 'ML'], foot: 'left', num: 17, ca: 118, pa: 130, val: K(700), wage: K(2.8), exp: '2028-06-30', h: 181, w: 74, t: { crossing: 14 } }),
  p({ name: 'Beno Selan', clubId: 'bravo', nat: 'SVN', age: 21, pos: ['DMC', 'MC'], num: 8, ca: 118, pa: 144, val: K(900), wage: K(2.4), exp: '2028-06-30', h: 183, w: 74, t: { passing: 14, tackling: 14 }, m: { workRate: 16 } }),
  p({ name: 'Martin Pečar', clubId: 'bravo', nat: 'SVN', age: 24, pos: ['FL', 'FR', 'AMC'], num: 10, ca: 122, pa: 138, val: M(1.2), wage: K(3.2), exp: '2028-06-30', h: 176, w: 69, t: { dribbling: 15, technique: 15, finishing: 13 }, p: { pace: 16 } }),
  p({ name: 'Matej Poplatnik', clubId: 'bravo', nat: 'SVN', age: 34, pos: ['FC'], num: 9, ca: 120, pa: 120, val: K(350), wage: K(3.2), exp: '2027-06-30', h: 183, w: 78, t: { finishing: 15, offTheBall: 15 } }),
  p({ name: 'Venuste Baboula', clubId: 'bravo', nat: 'FRA', age: 27, pos: ['FR', 'FL'], num: 11, ca: 118, pa: 124, val: K(650), wage: K(2.8), exp: '2028-06-30', h: 177, w: 71, p: { pace: 16 } }),

  // --- NŠ MURA ---
  p({ name: 'Florijan Raduha', clubId: 'mura', nat: 'SVN', age: 29, pos: ['GK'], num: 1, ca: 116, pa: 120, val: K(450), wage: K(2.6), exp: '2028-06-30', h: 190, w: 83, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 13 } }),
  p({ name: 'Kai Cipot', clubId: 'mura', nat: 'SVN', age: 25, pos: ['DC', 'DR'], num: 2, ca: 121, pa: 134, val: M(1), wage: K(3.4), exp: '2028-06-30', h: 187, w: 81, t: { heading: 14, tackling: 14 }, m: { influence: 15 } }),
  p({ name: 'Almin Kurtović', clubId: 'mura', nat: 'SVN', age: 26, pos: ['MC', 'DMC'], num: 8, ca: 118, pa: 126, val: K(650), wage: K(3), exp: '2028-06-30', h: 180, w: 74, t: { passing: 14, tackling: 14 } }),
  p({ name: 'Luka Bobičanec', clubId: 'mura', nat: 'CRO', age: 33, pos: ['AMC', 'MC'], num: 10, ca: 122, pa: 122, val: K(500), wage: K(4), exp: '2027-06-30', h: 178, w: 72, t: { longShots: 15, setPieces: 15, passing: 14 } }),
  p({ name: 'Dario Vizinger', clubId: 'mura', nat: 'CRO', age: 28, pos: ['FC'], num: 9, ca: 123, pa: 128, val: M(1.1), wage: K(3.8), exp: '2028-06-30', h: 181, w: 76, t: { finishing: 15, offTheBall: 15 } }),
  p({ name: 'Amadej Maroša', clubId: 'mura', nat: 'SVN', age: 32, pos: ['FC'], num: 17, ca: 118, pa: 118, val: K(450), wage: K(3.4), exp: '2027-06-30', h: 180, w: 75, t: { finishing: 14, offTheBall: 15 } }),

  // --- NK DOMŽALE, NK RADOMLJE, ND PRIMORJE, NK ALUMINIJ ---
  p({ name: 'Ajdin Mulalić', clubId: 'domzale', nat: 'SVN', age: 31, pos: ['GK'], num: 1, ca: 115, pa: 116, val: K(350), wage: K(2.5), exp: '2027-06-30', h: 188, w: 82, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 13 } }),
  p({ name: 'Rene Rantuša Lampreht', clubId: 'domzale', nat: 'SVN', age: 24, pos: ['DC'], num: 4, ca: 116, pa: 132, val: K(550), wage: K(2.4), exp: '2028-06-30', h: 188, w: 80 }),
  p({ name: 'Haris Vučkić', clubId: 'domzale', nat: 'SVN', age: 33, pos: ['AMC', 'FC'], foot: 'left', num: 10, ca: 119, pa: 119, val: K(350), wage: K(3.6), exp: '2027-06-30', caps: 12, goals: 5, h: 186, w: 80, t: { technique: 15, finishing: 14, passing: 14 } }),
  p({ name: 'Danijel Šturm', clubId: 'domzale', nat: 'SVN', age: 27, pos: ['FL', 'FR'], num: 7, ca: 120, pa: 127, val: K(800), wage: K(3), exp: '2028-06-30', h: 178, w: 72, t: { dribbling: 15, finishing: 14 }, p: { pace: 16 } }),
  p({ name: 'Luka Mlakar', clubId: 'domzale', nat: 'SVN', age: 20, pos: ['FC'], num: 9, ca: 114, pa: 154, wk: true, val: K(700), wage: K(1.8), exp: '2029-06-30', h: 184, w: 76, t: { finishing: 14, offTheBall: 14 } }),

  p({ name: 'Samo Pridgar', clubId: 'radomlje', nat: 'SVN', age: 23, pos: ['GK'], num: 1, ca: 114, pa: 134, val: K(450), wage: K(2), exp: '2028-06-30', h: 191, w: 82, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 13 } }),
  p({ name: 'Uroš Korun', clubId: 'radomlje', nat: 'SVN', age: 39, pos: ['DC'], num: 5, ca: 111, pa: 111, val: K(120), wage: K(2), exp: '2027-06-30', h: 185, w: 80, m: { influence: 16 } }),
  p({ name: 'Nino Kukovec', clubId: 'radomlje', nat: 'SVN', age: 25, pos: ['FC'], num: 9, ca: 116, pa: 128, val: K(550), wage: K(2.4), exp: '2028-06-30', h: 189, w: 82, t: { heading: 14, finishing: 14 } }),
  p({ name: 'Matej Malenšek', clubId: 'radomlje', nat: 'SVN', age: 21, pos: ['FR', 'FC'], num: 11, ca: 114, pa: 142, val: K(550), wage: K(2), exp: '2028-06-30', h: 179, w: 72, p: { pace: 15 } }),

  p({ name: 'Gašper Tratnik', clubId: 'primorje', nat: 'SVN', age: 26, pos: ['GK'], num: 1, ca: 114, pa: 124, val: K(400), wage: K(2), exp: '2028-06-30', h: 189, w: 82, g: { handling: 13, reflexes: 14, oneOnOnes: 13, positioning: 13 } }),
  p({ name: 'Žan Bešir', clubId: 'primorje', nat: 'SVN', age: 25, pos: ['MC', 'AMC'], num: 8, ca: 115, pa: 126, val: K(450), wage: K(2.2), exp: '2028-06-30', h: 181, w: 74 }),
  p({ name: 'Semir Smajlagić', clubId: 'primorje', nat: 'BIH', age: 27, pos: ['FC'], num: 9, ca: 116, pa: 122, val: K(500), wage: K(2.4), exp: '2028-06-30', h: 186, w: 80, t: { finishing: 14 } }),
  p({ name: 'Haris Kadrić', clubId: 'primorje', nat: 'SVN', age: 26, pos: ['FC', 'FL'], num: 11, ca: 114, pa: 122, val: K(420), wage: K(2.2), exp: '2028-06-30', h: 184, w: 77 }),

  p({ name: 'Emir Saitoski', clubId: 'aluminij', nat: 'MKD', age: 23, pos: ['FL', 'FR'], num: 7, ca: 114, pa: 132, val: K(450), wage: K(2), exp: '2028-06-30', h: 176, w: 69, t: { dribbling: 14 } }),
  p({ name: 'Bamba Susso', clubId: 'aluminij', nat: 'GAM', age: 23, pos: ['FC'], num: 9, ca: 115, pa: 134, val: K(500), wage: K(2.2), exp: '2028-06-30', h: 186, w: 78, p: { pace: 16 } }),
  p({ name: 'Tomislav Jagić', clubId: 'aluminij', nat: 'CRO', age: 25, pos: ['MC', 'DMC'], num: 8, ca: 113, pa: 122, val: K(350), wage: K(2), exp: '2028-06-30', h: 181, w: 74 }),

  // =========================================================================
  // SLOVENIA — 2. SNL KEY TALENTS & VETERANS
  // =========================================================================
  p({ name: 'Žan Mauricio', clubId: 'nafta-1903', nat: 'SVN', age: 21, pos: ['GK'], num: 1, ca: 110, pa: 136, val: K(350), wage: K(1.6), exp: '2028-06-30', h: 192, w: 83, g: { handling: 12, reflexes: 14, oneOnOnes: 13, positioning: 12 } }),
  p({ name: 'Josip Špoljarić', clubId: 'nafta-1903', nat: 'CRO', age: 29, pos: ['FC', 'AMC'], num: 10, ca: 114, pa: 118, val: K(380), wage: K(2.2), exp: '2028-06-30', h: 179, w: 74, t: { finishing: 14 } }),
  p({ name: 'Luka Marjanac', clubId: 'gorica', nat: 'BIH', age: 23, pos: ['FL', 'FC'], num: 11, ca: 112, pa: 130, val: K(380), wage: K(1.8), exp: '2028-06-30', h: 180, w: 73, p: { pace: 15 } }),
  p({ name: 'Tim Matavž', clubId: 'gorica', nat: 'SVN', age: 37, pos: ['FC'], num: 9, ca: 112, pa: 112, val: K(150), wage: K(2.2), exp: '2027-06-30', caps: 39, goals: 11, h: 188, w: 82, t: { finishing: 15, heading: 15 } }),
  p({ name: 'Lan Piskule', clubId: 'triglav-kranj', nat: 'SVN', age: 23, pos: ['FC'], num: 9, ca: 109, pa: 128, val: K(300), wage: K(1.5), exp: '2028-06-30', h: 183, w: 76, t: { finishing: 14 } }),
  p({ name: 'Jakob Cukjati', clubId: 'triglav-kranj', nat: 'SVN', age: 24, pos: ['AMC', 'MC'], num: 10, ca: 110, pa: 125, val: K(320), wage: K(1.6), exp: '2028-06-30', h: 178, w: 72 }),
  p({ name: 'Federico Rose', clubId: 'tabor-sezana', nat: 'ARG', age: 24, pos: ['FC', 'FR'], num: 9, ca: 111, pa: 128, val: K(320), wage: K(1.6), exp: '2028-06-30', h: 180, w: 74 }),
  p({ name: 'Jura Štimac', clubId: 'beltinci', nat: 'CRO', age: 25, pos: ['FC'], num: 9, ca: 108, pa: 120, val: K(260), wage: K(1.4), exp: '2028-06-30', h: 184, w: 77 }),
  p({ name: 'Aleks Zlatkov', clubId: 'brinje-grosuplje', nat: 'SVN', age: 23, pos: ['MC', 'AMC'], num: 10, ca: 109, pa: 130, val: K(300), wage: K(1.4), exp: '2028-06-30', h: 179, w: 72 }),
  p({ name: 'Jaša Martinčič', clubId: 'bistrica', nat: 'SVN', age: 24, pos: ['FC'], num: 9, ca: 108, pa: 124, val: K(260), wage: K(1.3), exp: '2028-06-30', h: 183, w: 76 }),
  p({ name: 'Luka Šušnjara', clubId: 'rudar-velenje', nat: 'SVN', age: 29, pos: ['FL', 'AMC'], num: 10, ca: 110, pa: 114, val: K(250), wage: K(1.6), exp: '2027-06-30', h: 177, w: 71 }),
  p({ name: 'Tilen Kovačič', clubId: 'krka', nat: 'SVN', age: 22, pos: ['MC', 'DMC'], num: 8, ca: 106, pa: 128, val: K(240), wage: K(1.2), exp: '2028-06-30', h: 180, w: 73 }),
  p({ name: 'Anej Kmetič', clubId: 'ilirija-1911', nat: 'SVN', age: 21, pos: ['FC', 'FL'], num: 11, ca: 105, pa: 132, val: K(220), wage: K(1.1), exp: '2028-06-30', h: 181, w: 73 }),

  // =========================================================================
  // CROATIA — SUPERSPORT HNL
  // =========================================================================

  // --- GNK DINAMO ZAGREB ---
  p({ name: 'Ivan Nevistić', clubId: 'dinamo-zagreb', nat: 'CRO', age: 28, pos: ['GK'], num: 33, ca: 141, pa: 146, val: M(4.5), wage: K(18), exp: '2028-06-30', h: 195, w: 86, g: { handling: 14, reflexes: 16, oneOnOnes: 15, positioning: 14 } }),
  p({ name: 'Raúl Torrente', clubId: 'dinamo-zagreb', nat: 'ESP', age: 24, pos: ['DC'], foot: 'left', num: 4, ca: 142, pa: 156, val: M(6.5), wage: K(18), exp: '2028-06-30', h: 193, w: 85, t: { heading: 16, tackling: 15 } }),
  p({ name: 'Samy Mmaee', clubId: 'dinamo-zagreb', nat: 'MAR', age: 29, pos: ['DC'], num: 28, ca: 139, pa: 141, val: M(3.5), wage: K(20), exp: '2028-06-30', caps: 10, h: 185, w: 82, t: { tackling: 15 } }),
  p({ name: 'Ronaël Pierre-Gabriel', clubId: 'dinamo-zagreb', nat: 'FRA', age: 28, pos: ['DR', 'DL'], num: 18, ca: 140, pa: 144, val: M(4.5), wage: K(19), exp: '2028-06-30', h: 177, w: 74, p: { pace: 16 } }),
  p({ name: 'Josip Mišić', clubId: 'dinamo-zagreb', nat: 'CRO', age: 32, pos: ['DMC', 'MC'], num: 27, ca: 143, pa: 143, val: M(3.2), wage: K(22), exp: '2028-06-30', caps: 2, h: 187, w: 80, t: { passing: 16, tackling: 15 }, m: { influence: 17, decisions: 16 } }),
  p({ name: 'Martin Baturina', clubId: 'dinamo-zagreb', nat: 'CRO', age: 23, pos: ['AMC', 'MC'], num: 10, ca: 158, pa: 180, val: M(32), wage: K(36), exp: '2029-06-30', caps: 14, goals: 2, h: 172, w: 68, t: { dribbling: 18, passing: 17, technique: 18, setPieces: 16 }, m: { creativity: 18, flair: 18, decisions: 16 }, p: { agility: 18, balance: 17 } }),
  p({ name: 'Luka Stojković', clubId: 'dinamo-zagreb', nat: 'CRO', age: 22, pos: ['AMC', 'FL', 'MC'], num: 7, ca: 143, pa: 168, val: M(9), wage: K(16), exp: '2029-06-30', h: 180, w: 72, t: { dribbling: 16, technique: 16, longShots: 15 }, m: { flair: 16 } }),
  p({ name: 'Marko Pjaca', clubId: 'dinamo-zagreb', nat: 'CRO', age: 31, pos: ['FL', 'FR'], num: 20, ca: 142, pa: 142, val: M(4), wage: K(22), exp: '2028-06-30', caps: 28, goals: 1, h: 186, w: 83, t: { dribbling: 16, technique: 16 } }),
  p({ name: 'Bruno Petković', clubId: 'dinamo-zagreb', nat: 'CRO', age: 31, pos: ['FC'], num: 9, ca: 148, pa: 148, val: M(5.5), wage: K(28), exp: '2028-06-30', caps: 42, goals: 11, h: 193, w: 88, t: { technique: 17, heading: 17, passing: 16, finishing: 15 }, m: { influence: 17, flair: 16 }, p: { strength: 18 } }),
  p({ name: 'Sandro Kulenović', clubId: 'dinamo-zagreb', nat: 'CRO', age: 26, pos: ['FC'], num: 17, ca: 141, pa: 149, val: M(5.5), wage: K(18), exp: '2028-06-30', h: 191, w: 84, t: { finishing: 15, heading: 16 } }),
  p({ name: 'Leon Jakirović', clubId: 'dinamo-zagreb', nat: 'CRO', age: 18, pos: ['DC', 'DL'], foot: 'left', num: 35, ca: 124, pa: 170, wk: true, val: M(4), wage: K(6), exp: '2029-06-30', h: 190, w: 80, t: { passing: 14, tackling: 14 }, m: { decisions: 15 } }),

  // --- HNK HAJDUK SPLIT ---
  p({ name: 'Ivan Lučić', clubId: 'hajduk-split', nat: 'AUT', age: 31, pos: ['GK'], num: 13, ca: 136, pa: 138, val: M(2.2), wage: K(12), exp: '2028-06-30', h: 193, w: 86, g: { handling: 14, reflexes: 15, oneOnOnes: 14, positioning: 14 } }),
  p({ name: 'Filip Uremović', clubId: 'hajduk-split', nat: 'CRO', age: 29, pos: ['DC'], num: 25, ca: 141, pa: 143, val: M(3.8), wage: K(18), exp: '2028-06-30', caps: 6, h: 184, w: 78, t: { tackling: 15, heading: 15 }, m: { bravery: 17, aggression: 16 } }),
  p({ name: 'Dominik Prpić', clubId: 'hajduk-split', nat: 'CRO', age: 22, pos: ['DC'], foot: 'left', num: 3, ca: 138, pa: 164, val: M(6.5), wage: K(10), exp: '2029-06-30', h: 188, w: 80, t: { passing: 15, tackling: 15 }, m: { decisions: 15 } }),
  p({ name: 'Niko Sigur', clubId: 'hajduk-split', nat: 'CAN', age: 22, pos: ['DMC', 'DR', 'MC'], num: 5, ca: 140, pa: 164, val: M(7), wage: K(12), exp: '2029-06-30', caps: 10, h: 178, w: 73, t: { passing: 15, tackling: 15 }, m: { workRate: 17 } }),
  p({ name: 'Rokas Pukštas', clubId: 'hajduk-split', nat: 'USA', age: 21, pos: ['MC', 'AMC'], num: 21, ca: 141, pa: 168, wk: true, val: M(9.5), wage: K(12), exp: '2029-06-30', caps: 4, h: 180, w: 73, t: { heading: 16, offTheBall: 15 }, m: { workRate: 18, determination: 18 }, p: { jumping: 17, stamina: 18 } }),
  p({ name: 'Filip Krovinović', clubId: 'hajduk-split', nat: 'CRO', age: 30, pos: ['MC', 'AMC'], num: 23, ca: 137, pa: 138, val: M(2.6), wage: K(16), exp: '2028-06-30', h: 175, w: 68, t: { passing: 15, technique: 15 } }),
  p({ name: 'Marko Livaja', clubId: 'hajduk-split', nat: 'CRO', age: 32, pos: ['FC', 'AMC'], num: 10, ca: 148, pa: 148, val: M(5), wage: K(28), exp: '2028-06-30', caps: 21, goals: 4, h: 182, w: 81, t: { finishing: 17, technique: 17, penalties: 18, passing: 16 }, m: { influence: 19, flair: 17, determination: 17 } }),
  p({ name: 'Bruno Durdov', clubId: 'hajduk-split', nat: 'CRO', age: 18, pos: ['FR', 'FL'], foot: 'left', num: 34, ca: 131, pa: 174, wk: true, val: M(8), wage: K(6.5), exp: '2029-06-30', h: 181, w: 72, t: { dribbling: 16, finishing: 15, longShots: 15 }, m: { flair: 16, determination: 16 }, p: { pace: 17, acceleration: 17 } }),

  // --- HNK RIJEKA & NK OSIJEK & HNL GEMS ---
  p({ name: 'Martin Zlomislić', clubId: 'rijeka', nat: 'BIH', age: 27, pos: ['GK'], num: 13, ca: 135, pa: 142, val: M(2.4), wage: K(10), exp: '2028-06-30', caps: 4, h: 192, w: 84, g: { handling: 14, reflexes: 15, oneOnOnes: 14, positioning: 14 } }),
  p({ name: 'Stjepan Radeljić', clubId: 'rijeka', nat: 'BIH', age: 28, pos: ['DC'], foot: 'left', num: 6, ca: 138, pa: 142, val: M(3.5), wage: K(12), exp: '2028-06-30', caps: 8, h: 201, w: 92, t: { heading: 17, tackling: 15 }, p: { strength: 17 } }),
  p({ name: 'Lindon Selahi', clubId: 'rijeka', nat: 'ALB', age: 27, pos: ['DMC', 'MC'], num: 18, ca: 139, pa: 144, val: M(3.5), wage: K(12), exp: '2028-06-30', caps: 6, h: 180, w: 74, t: { tackling: 16 }, m: { workRate: 18 } }),
  p({ name: 'Toni Fruk', clubId: 'rijeka', nat: 'CRO', age: 25, pos: ['AMC', 'MC'], num: 10, ca: 147, pa: 162, val: M(11), wage: K(16), exp: '2029-06-30', caps: 4, h: 179, w: 72, t: { passing: 16, technique: 17, finishing: 15, setPieces: 16 }, m: { creativity: 17, flair: 16 } }),
  p({ name: 'Niko Janković', clubId: 'rijeka', nat: 'CRO', age: 24, pos: ['AMC', 'FL', 'MC'], num: 4, ca: 142, pa: 156, val: M(6.5), wage: K(14), exp: '2028-06-30', h: 186, w: 78, t: { longShots: 16, dribbling: 15, finishing: 15 } }),
  p({ name: 'Dejan Petrovič', clubId: 'rijeka', nat: 'SVN', age: 28, pos: ['DMC', 'MC'], num: 8, ca: 135, pa: 139, val: M(2.4), wage: K(11), exp: '2028-06-30', caps: 10, h: 182, w: 76, t: { passing: 15, tackling: 15 }, m: { workRate: 17 } }),

  p({ name: 'Marko Malenica', clubId: 'osijek', nat: 'CRO', age: 32, pos: ['GK'], num: 31, ca: 132, pa: 132, val: M(1.2), wage: K(10), exp: '2028-06-30', h: 192, w: 86, g: { handling: 14, reflexes: 15, oneOnOnes: 14, positioning: 14 } }),
  p({ name: 'Tiago Dantas', clubId: 'osijek', nat: 'POR', age: 25, pos: ['MC', 'DMC'], num: 10, ca: 137, pa: 148, val: M(3.4), wage: K(12), exp: '2028-06-30', h: 170, w: 62, t: { passing: 16, technique: 16 }, m: { creativity: 16 } }),
  p({ name: 'Arnel Jakupović', clubId: 'osijek', nat: 'AUT', age: 28, pos: ['FC'], num: 17, ca: 137, pa: 142, val: M(3.2), wage: K(12), exp: '2028-06-30', h: 186, w: 79, t: { finishing: 15, setPieces: 15 } }),
  p({ name: 'Anton Matković', clubId: 'osijek', nat: 'CRO', age: 20, pos: ['FC', 'FL'], num: 39, ca: 135, pa: 174, wk: true, val: M(8.5), wage: K(7.5), exp: '2029-06-30', h: 191, w: 80, t: { finishing: 15, dribbling: 15 }, p: { pace: 18, acceleration: 18 } }),
  p({ name: 'Michele Šego', clubId: 'varazdin', nat: 'CRO', age: 25, pos: ['FL', 'FC'], num: 11, ca: 132, pa: 142, val: M(2.2), wage: K(7.5), exp: '2028-06-30', h: 178, w: 72, t: { dribbling: 15, finishing: 14 } }),
  p({ name: 'Mateo Lisica', clubId: 'istra-1961', nat: 'CRO', age: 23, pos: ['FR', 'MR'], num: 7, ca: 131, pa: 146, val: M(2.2), wage: K(6.5), exp: '2028-06-30', h: 180, w: 73, p: { pace: 17 } }),
  p({ name: 'Robert Mudražija', clubId: 'lokomotiva-zagreb', nat: 'CRO', age: 29, pos: ['AMC', 'MC'], num: 10, ca: 134, pa: 136, val: M(2), wage: K(8.5), exp: '2028-06-30', h: 176, w: 72, t: { finishing: 14, passing: 14 } }),
];
