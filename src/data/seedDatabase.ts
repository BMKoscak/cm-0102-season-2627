import type { ClubSeed, RealPlayerSeed, SeedDatabaseModule } from '../types/contracts';
import type {
  Club,
  Footedness,
  FormationId,
  GameDatabase,
  GoalkeepingAttributes,
  League,
  LeagueId,
  MentalAttributes,
  MoraleLevel,
  PhysicalAttributes,
  Player,
  PlayerAttributes,
  PlayerHistoryEntry,
  PlayerSeasonStats,
  PositionCategory,
  PositionCode,
  SquadStatus,
  TacticalSlot,
  TacticsState,
  TechnicalAttributes,
  TrainingState,
  WibWobGrid,
} from '../types/game';
import { estimatePlayerValue, estimateWeeklyWage, getPositionCategory } from '../engine/attributes';
import { createDefaultWibWobGrid, FORMATIONS } from '../engine/tactics';
import { CLUBS_SEED } from './clubs';
import hydratedOverridesRaw from './hydrated_overrides.json';
import { LEAGUES_DATA } from './leagues';
import { REAL_PLAYERS_SEED } from './realPlayers';

/* ============================================================================
 * HYDRATED OVERRIDES TYPES
 * ============================================================================ */

export interface HydratedClubOverride {
  theSportsDbTeamId?: string;
  badgeUrl?: string;
  stadiumImageUrl?: string;
  stadiumName?: string;
  stadiumCapacity?: number;
  managerName?: string;
}

export interface HydratedPlayerOverride extends Partial<RealPlayerSeed> {
  imageUrl?: string;
}

export interface HydratedOverridesFile {
  schemaVersion: number;
  seasonLabel: string;
  generatedAt: string;
  sources: string[];
  clubs: Record<string, HydratedClubOverride>;
  players: Record<string, HydratedPlayerOverride>;
}

const HYDRATED_OVERRIDES = hydratedOverridesRaw as HydratedOverridesFile;

/* ============================================================================
 * DETERMINISTIC FAST PRNG & HASH HELPERS
 * ============================================================================ */

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function clampAttr(v: number): number {
  return clamp(Math.round(v), 1, 20);
}

function slugify(text: string): string {
  // Fast ASCII path avoids expensive ICU NFD normalization for ~7,000 players
  const normalized = /[^\x00-\x7F]/.test(text)
    ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : text;
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.trim();
  const first = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${first[0]}. ${rest}`;
}

function deriveDateOfBirth(age: number, rng: () => number): string {
  const birthYear = 2026 - age;
  const month = Math.floor(rng() * 12) + 1;
  const day = Math.floor(rng() * 28) + 1;
  // Ensure age as of August 2026 is consistent
  const adjustedYear = month > 8 ? birthYear - 1 : birthYear;
  return `${adjustedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function emptySeasonStats(): PlayerSeasonStats {
  return {
    appearances: 0,
    subAppearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    manOfTheMatch: 0,
    averageRating: 0,
    ratingSum: 0,
    ratingCount: 0,
    yellowCards: 0,
    redCards: 0,
    minutesPlayed: 0,
  };
}

function createDefaultTraining(): TrainingState {
  return {
    overallIntensity: 'Medium',
    groups: {
      Goalkeepers: { group: 'Goalkeepers', focus: 'Goalkeeping', intensity: 'Medium' },
      Defenders: { group: 'Defenders', focus: 'Tactics', intensity: 'Medium' },
      Midfielders: { group: 'Midfielders', focus: 'Skills', intensity: 'Medium' },
      Forwards: { group: 'Forwards', focus: 'Shooting', intensity: 'Medium' },
    },
    playerFocusOverrides: {},
    recentImprovements: [],
  };
}

/* ============================================================================
 * 29-COUNTRY AUTHENTIC NAME POOLS FOR DETERMINISTIC SQUAD GENERATION
 * ============================================================================ */

interface NamePool {
  country: string;
  code: string;
  first: string[];
  last: string[];
}

const NAME_POOLS: Record<string, NamePool> = {
  ENG: {
    country: 'England',
    code: 'ENG',
    first: [
      'Jack', 'Harry', 'Oliver', 'George', 'Charlie', 'Callum', 'Ben', 'Sam', 'Tom', 'Luke',
      'Josh', 'Liam', 'Ryan', 'Lewis', 'Alex', 'Owen', 'Mason', 'Harvey', 'Alfie', 'Max',
      'Kieran', 'Reece', 'Ethan', 'Jamie', 'Marcus', 'Tyler', 'Morgan', 'Connor', 'Nathan', 'Elliot',
    ],
    last: [
      'Taylor', 'Wright', 'Walker', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall',
      'Wood', 'Harris', 'Clarke', 'Cooper', 'Ward', 'Turner', 'Carter', 'Phillips', 'Mitchell', 'Parker',
      'Bennett', 'Brooks', 'Palmer', 'Harrison', 'Foster', 'Barnes', 'Fletcher', 'Barker', 'Houghton', 'Sutton',
    ],
  },
  ESP: {
    country: 'Spain',
    code: 'ESP',
    first: [
      'Alejandro', 'Carlos', 'Daniel', 'David', 'Diego', 'Hugo', 'Iker', 'Ivan', 'Javier', 'Jorge',
      'Lucas', 'Marc', 'Mario', 'Martin', 'Miguel', 'Pablo', 'Pau', 'Raul', 'Ruben', 'Sergio',
      'Unai', 'Alvaro', 'Adrian', 'Aitor', 'Mikel', 'Gorka', 'Fran', 'Nico', 'Gonzalo', 'Joel',
    ],
    last: [
      'Garcia', 'Martinez', 'Lopez', 'Sanchez', 'Gonzalez', 'Rodriguez', 'Fernandez', 'Perez', 'Gomez', 'Ruiz',
      'Diaz', 'Moreno', 'Alvarez', 'Munoz', 'Romero', 'Alonso', 'Gutierrez', 'Navarro', 'Torres', 'Dominguez',
      'Vazquez', 'Ramos', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Castro', 'Ortega', 'Delgado', 'Herrera',
    ],
  },
  ITA: {
    country: 'Italy',
    code: 'ITA',
    first: [
      'Alessandro', 'Andrea', 'Davide', 'Edoardo', 'Emanuele', 'Federico', 'Filippo', 'Francesco', 'Gabriele', 'Giacomo',
      'Gianluca', 'Giorgio', 'Giovanni', 'Leonardo', 'Lorenzo', 'Luca', 'Marco', 'Matteo', 'Mattia', 'Michele',
      'Nicolo', 'Pietro', 'Riccardo', 'Samuele', 'Simone', 'Stefano', 'Tommaso', 'Valerio', 'Christian', 'Daniele',
    ],
    last: [
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
      'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti',
      'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Pellegrini',
    ],
  },
  GER: {
    country: 'Germany',
    code: 'GER',
    first: [
      'Alexander', 'Anton', 'Ben', 'David', 'Elias', 'Emil', 'Fabian', 'Felix', 'Finn', 'Florian',
      'Jakob', 'Jan', 'Jonas', 'Julian', 'Kevin', 'Lukas', 'Leon', 'Linus', 'Marcel', 'Maximilian',
      'Moritz', 'Nico', 'Niklas', 'Noah', 'Paul', 'Philipp', 'Robin', 'Sebastian', 'Tim', 'Tobias',
    ],
    last: [
      'Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
      'Schafer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroder', 'Neumann', 'Schwarz', 'Zimmermann',
      'Braun', 'Kruger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Krause', 'Meier', 'Lehmann',
    ],
  },
  FRA: {
    country: 'France',
    code: 'FRA',
    first: [
      'Adrien', 'Alexandre', 'Antoine', 'Arthur', 'Baptiste', 'Bastien', 'Clement', 'Corentin', 'Dylan', 'Enzo',
      'Florian', 'Gabriel', 'Hugo', 'Julien', 'Kevin', 'Killian', 'Leo', 'Louis', 'Lucas', 'Mathieu',
      'Maxime', 'Moussa', 'Nathan', 'Nicolas', 'Paul', 'Quentin', 'Romain', 'Theo', 'Thomas', 'Valentin',
    ],
    last: [
      'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
      'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard',
      'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Diallo', 'Traore', 'Camara', 'Mercier',
    ],
  },
  SVN: {
    country: 'Slovenia',
    code: 'SVN',
    first: [
      'Aljaz', 'Anze', 'Blaz', 'David', 'Dejan', 'Domen', 'Gal', 'Gregor', 'Jakob', 'Jan',
      'Jaka', 'Klemen', 'Luka', 'Mark', 'Marko', 'Matej', 'Matija', 'Matic', 'Miha', 'Mitja',
      'Nejc', 'Nik', 'Nino', 'Rok', 'Sven', 'Tilen', 'Tim', 'Urban', 'Vid', 'Zan', 'Ziga',
    ],
    last: [
      'Novak', 'Horvat', 'Kovac', 'Kovacic', 'Krajnc', 'Zupancic', 'Potocnik', 'Mlakar', 'Vidmar', 'Kos',
      'Golob', 'Kralj', 'Bozic', 'Koren', 'Zajc', 'Bizjak', 'Kolar', 'Oblak', 'Rozman', 'Hribar',
      'Kotnik', 'Kavcic', 'Kastelic', 'Petek', 'Kosec', 'Jelen', 'Pirc', 'Hocevar', 'Cerar', 'Turk',
    ],
  },
  NED: {
    country: 'Netherlands',
    code: 'NED',
    first: [
      'Bram', 'Daan', 'Dani', 'Finn', 'Gijs', 'Jelle', 'Jesse', 'Joep', 'Jorn', 'Julian',
      'Koen', 'Lars', 'Levi', 'Luuk', 'Mats', 'Mees', 'Milan', 'Niels', 'Noah', 'Pim',
      'Rick', 'Ruben', 'Sam', 'Sem', 'Sven', 'Thijs', 'Thomas', 'Tijn', 'Tim', 'Wouter',
    ],
    last: [
      'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit', 'Meijer',
      'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer',
      'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer', 'Koster', 'Vermeer', 'Kuijpers', 'Schouten', 'Kramer',
    ],
  },
  POR: {
    country: 'Portugal',
    code: 'POR',
    first: [
      'Afonso', 'Andre', 'Bernardo', 'Bruno', 'Carlos', 'Daniel', 'David', 'Diogo', 'Duarte', 'Eduardo',
      'Fabio', 'Filipe', 'Francisco', 'Goncalo', 'Guilherme', 'Henrique', 'Hugo', 'Joao', 'Jose', 'Luis',
      'Martim', 'Miguel', 'Nuno', 'Pedro', 'Rafael', 'Ricardo', 'Rodrigo', 'Rui', 'Tiago', 'Tomas',
    ],
    last: [
      'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa',
      'Fernandes', 'Goncalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Almeida', 'Ribeiro', 'Pinto', 'Carvalho',
      'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha',
    ],
  },
  SCO: {
    country: 'Scotland',
    code: 'SCO',
    first: [
      'Aidan', 'Alistair', 'Andrew', 'Blair', 'Calum', 'Cameron', 'Craig', 'Declan', 'Ewan', 'Finlay',
      'Fraser', 'Gavin', 'Graeme', 'Greg', 'Ian', 'Jack', 'Jamie', 'Kieran', 'Kyle', 'Lewis',
      'Liam', 'Logan', 'Murray', 'Neil', 'Ross', 'Rory', 'Scott', 'Sean', 'Shaun', 'Stuart',
    ],
    last: [
      'Smith', 'Brown', 'Wilson', 'Campbell', 'Stewart', 'Thomson', 'Robertson', 'Anderson', 'MacDonald', 'Scott',
      'Reid', 'Murray', 'Taylor', 'Clark', 'Ross', 'Watson', 'Morrison', 'Paterson', 'Young', 'Mitchell',
      'Fraser', 'Henderson', 'MacLeod', 'Ferguson', 'McAllister', 'Johnston', 'Graham', 'Kerr', 'Hamilton', 'Wallace',
    ],
  },
  BEL: {
    country: 'Belgium',
    code: 'BEL',
    first: [
      'Arne', 'Arthur', 'Bram', 'Brecht', 'Cisse', 'Daan', 'Dries', 'Elias', 'Emile', 'Gilles',
      'Jelle', 'Jens', 'Joris', 'Kobe', 'Lander', 'Lars', 'Loic', 'Louis', 'Lucas', 'Mathias',
      'Maxim', 'Milan', 'Nathan', 'Niels', 'Noah', 'Robbe', 'Sander', 'Seppe', 'Thibault', 'Wout',
    ],
    last: [
      'Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet',
      'Vermeulen', 'Pauwels', 'Dubois', 'Hermans', 'Aerts', 'Michiels', 'Lambert', 'Martens', 'De Vos', 'Bogaert',
      'Hendrickx', 'Van Damme', 'De Vries', 'Desmet', 'Dupont', 'Leclercq', 'Renard', 'Laurent', 'Verschueren', 'De Cock',
    ],
  },
  CRO: {
    country: 'Croatia',
    code: 'CRO',
    first: [
      'Ante', 'Antonio', 'Borna', 'Bruno', 'Dario', 'David', 'Domagoj', 'Dominik', 'Filip', 'Fran',
      'Hrvoje', 'Ivan', 'Ivica', 'Jakov', 'Josip', 'Karlo', 'Kristijan', 'Leon', 'Lovro', 'Luka',
      'Marin', 'Mario', 'Marko', 'Matej', 'Mateo', 'Matija', 'Nikola', 'Niko', 'Petar', 'Stipe', 'Toni',
    ],
    last: [
      'Horvat', 'Kovacevic', 'Babic', 'Maric', 'Juric', 'Novak', 'Kovacic', 'Knezevic', 'Vukovic', 'Matic',
      'Markovic', 'Petrovic', 'Tomic', 'Kovac', 'Pavlovic', 'Bozic', 'Blazevic', 'Grgic', 'Peric', 'Filipovic',
      'Saric', 'Lovric', 'Vidovic', 'Radic', 'Barisic', 'Kralj', 'Loncar', 'Jukic', 'Cindric', 'Majer',
    ],
  },
  AUT: {
    country: 'Austria',
    code: 'AUT',
    first: [
      'Alexander', 'Christoph', 'Daniel', 'David', 'Dominik', 'Elias', 'Fabian', 'Felix', 'Florian', 'Jakob',
      'Jonas', 'Julian', 'Kevin', 'Lukas', 'Manuel', 'Marco', 'Markus', 'Martin', 'Mathias', 'Maximilian',
      'Michael', 'Moritz', 'Nico', 'Nikolas', 'Patrick', 'Paul', 'Philipp', 'Sebastian', 'Stefan', 'Tobias',
    ],
    last: [
      'Gruber', 'Huber', 'Bauer', 'Wagner', 'Muller', 'Pichler', 'Steiner', 'Moser', 'Mayer', 'Hofer',
      'Leitner', 'Berger', 'Fuchs', 'Eder', 'Fischer', 'Schmid', 'Winkler', 'Weber', 'Schwarz', 'Maier',
      'Schneider', 'Reiter', 'Mayr', 'Schmidt', 'Wimmer', 'Egger', 'Brunner', 'Lang', 'Baumgartner', 'Auer',
    ],
  },
  TUR: {
    country: 'Turkey',
    code: 'TUR',
    first: [
      'Ahmet', 'Ali', 'Alper', 'Arda', 'Baris', 'Batuhan', 'Berat', 'Berkay', 'Burak', 'Can',
      'Cem', 'Deniz', 'Dogukan', 'Efe', 'Emir', 'Emre', 'Enes', 'Eren', 'Furkan', 'Gokhan',
      'Hakan', 'Halil', 'Ibrahim', 'Ismail', 'Kaan', 'Kerem', 'Mehmet', 'Mert', 'Mustafa', 'Oguz', 'Yusuf',
    ],
    last: [
      'Yilmaz', 'Kaya', 'Demir', 'Celik', 'Sahin', 'Yildiz', 'Yildirim', 'Ozturk', 'Aydin', 'Ozdemir',
      'Arslan', 'Dogan', 'Kilic', 'Aslan', 'Cetin', 'Kara', 'Koc', 'Kurt', 'Ozkan', 'Simsek',
      'Polat', 'Korkmaz', 'Ozcan', 'Cakir', 'Erdogan', 'Yavuz', 'Can', 'Acar', 'Sen', 'Aksoy',
    ],
  },
  BRA: {
    country: 'Brazil',
    code: 'BRA',
    first: [
      'Andre', 'Bruno', 'Caio', 'Carlos', 'Danilo', 'Diego', 'Eduardo', 'Felipe', 'Gabriel', 'Guilherme',
      'Gustavo', 'Henrique', 'Igor', 'Joao', 'Kaio', 'Luan', 'Lucas', 'Matheus', 'Murilo', 'Pedro',
      'Rafael', 'Renan', 'Rodrigo', 'Samuel', 'Thiago', 'Victor', 'Vinicius', 'Vitor', 'Wesley', 'Yuri',
    ],
    last: [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
      'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa',
      'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Teixeira',
    ],
  },
  ARG: {
    country: 'Argentina',
    code: 'ARG',
    first: [
      'Agustin', 'Alan', 'Alejo', 'Bautista', 'Bruno', 'Cristian', 'Diego', 'Emanuel', 'Emiliano', 'Enzo',
      'Ezequiel', 'Facundo', 'Federico', 'Franco', 'Gabriel', 'Gaston', 'Gonzalo', 'Ignacio', 'Joaquin', 'Julian',
      'Lautaro', 'Leandro', 'Lucas', 'Luciano', 'Matias', 'Nahuel', 'Nicolas', 'Ramiro', 'Santiago', 'Tomas',
    ],
    last: [
      'Gonzalez', 'Rodriguez', 'Gomez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Romero', 'Sanchez',
      'Sosa', 'Torres', 'Alvarez', 'Ruiz', 'Ramirez', 'Flores', 'Benitez', 'Acosta', 'Medina', 'Herrera',
      'Suarez', 'Aguirre', 'Gimenez', 'Gutierrez', 'Pereyra', 'Rojas', 'Molina', 'Castro', 'Ortiz', 'Silva',
    ],
  },
  SRB: {
    country: 'Serbia',
    code: 'SRB',
    first: [
      'Aleksa', 'Aleksandar', 'Andrija', 'Bogdan', 'Bojan', 'Dusan', 'Filip', 'Igor', 'Ivan', 'Jovan',
      'Lazar', 'Luka', 'Marko', 'Matija', 'Milan', 'Milos', 'Nemanja', 'Nikola', 'Ognjen', 'Petar',
      'Stefan', 'Strahinja', 'Uros', 'Veljko', 'Viktor', 'Vladimir', 'Vuk', 'Zoran',
    ],
    last: [
      'Jovanovic', 'Petrovic', 'Nikolic', 'Markovic', 'Djordjevic', 'Stojanovic', 'Ilic', 'Stankovic', 'Pavlovic', 'Milosevic',
      'Radovic', 'Todorovic', 'Popovic', 'Kostic', 'Mitrovic', 'Lukic', 'Ristic', 'Jankovic', 'Lazic', 'Savic',
      'Simic', 'Stevanovic', 'Vukovic', 'Zivkovic', 'Kovacevic', 'Mladenovic', 'Bogdanovic', 'Novakovic',
    ],
  },
  BIH: {
    country: 'Bosnia & Herzegovina',
    code: 'BIH',
    first: [
      'Adnan', 'Adis', 'Ajdin', 'Alen', 'Amar', 'Amer', 'Anel', 'Armin', 'Benjamin', 'Damir',
      'Denis', 'Dino', 'Edin', 'Eldar', 'Elvir', 'Emir', 'Enes', 'Faris', 'Haris', 'Jasmin',
      'Kenan', 'Mirza', 'Nermin', 'Sanel', 'Semir', 'Tarik', 'Vedad', 'Zlatan',
    ],
    last: [
      'Hodzic', 'Hadzic', 'Kovacevic', 'Markovic', 'Babic', 'Delic', 'Begic', 'Basic', 'Alic', 'Halilovic',
      'Muratovic', 'Kadic', 'Mujic', 'Spahic', 'Besic', 'Civic', 'Sabic', 'Omerovic', 'Mehmedovic', 'Sehic',
      'Ibrahimovic', 'Salihovic', 'Avdic', 'Pjanic', 'Vranjes', 'Tahirbegovic', 'Kolasinac', 'Mesanovic',
    ],
  },
  NGA: {
    country: 'Nigeria',
    code: 'NGA',
    first: [
      'Ahmed', 'Chidera', 'Chinedu', 'Chukwudi', 'Daniel', 'David', 'Emmanuel', 'Francis', 'Frank', 'Gideon',
      'Godwin', 'Ibrahim', 'Isaac', 'John', 'Joseph', 'Joshua', 'Kenneth', 'Kingsley', 'Michael', 'Musa',
      'Peter', 'Raphael', 'Sadiq', 'Samuel', 'Solomon', 'Stanley', 'Sunday', 'Tunde', 'Uche', 'Victor',
    ],
    last: [
      'Okafor', 'Adeyemi', 'Balogun', 'Chukwu', 'Eze', 'Ibe', 'Iheanacho', 'Iwobi', 'Lawal', 'Madu',
      'Musa', 'Ndidi', 'Nwosu', 'Obi', 'Odegbami', 'Ogunleye', 'Okonkwo', 'Okoye', 'Oladipo', 'Onuachu',
      'Onyeka', 'Osho', 'Osimhen', 'Sani', 'Suleiman', 'Umar', 'Uzoho', 'Yusuf',
    ],
  },
  CIV: {
    country: 'Ivory Coast',
    code: 'CIV',
    first: [
      'Aboubacar', 'Adama', 'Amadou', 'Arouna', 'Cheick', 'Christian', 'Didier', 'Eric', 'Franck', 'Gervais',
      'Habib', 'Ibrahim', 'Ismael', 'Jean', 'Karim', 'Koffi', 'Konan', 'Lamine', 'Mamadou', 'Max',
      'Mohamed', 'Moussa', 'Oumar', 'Ousmane', 'Salomon', 'Seko', 'Serge', 'Souleymane', 'Wilfried', 'Yaya',
    ],
    last: [
      'Kone', 'Kouassi', 'Coulibaly', 'Diallo', 'Traore', 'Bamba', 'Toure', 'Yao', 'N\'Guessan', 'Ouattara',
      'Sangare', 'Cisse', 'Fofana', 'Kessie', 'Aka', 'Drogba', 'Gbohouo', 'Kouyate', 'Meite', 'Serey',
      'Zaha', 'Diomande', 'Kossounou', 'Singo', 'Kouame', 'Diakite', 'Gnahore', 'Adingra',
    ],
  },
  MAR: {
    country: 'Morocco',
    code: 'MAR',
    first: [
      'Abdel', 'Achraf', 'Adam', 'Amine', 'Anass', 'Ayoub', 'Bilal', 'Brahim', 'Chadi', 'Eliesse',
      'Hamza', 'Ilias', 'Ismail', 'Karim', 'Mehdi', 'Mohamed', 'Munir', 'Nabil', 'Nayef', 'Noussair',
      'Oussama', 'Rachid', 'Reda', 'Romain', 'Sofyan', 'Soufiane', 'Tarik', 'Walid', 'Yassine', 'Youssef',
    ],
    last: [
      'Benali', 'Berrada', 'Boufal', 'Bounou', 'Chair', 'Dari', 'El Haddadi', 'El Kaabi', 'El Khannouss', 'En-Nesyri',
      'Fajr', 'Hakimi', 'Harit', 'Idrissi', 'Louza', 'Masina', 'Mazraoui', 'Munir', 'Ounahi', 'Rahimi',
      'Sabiri', 'Saiss', 'Tissoudali', 'Ziyech', 'Amrabat', 'Aguerd', 'Aboukhlal', 'Ben Seghir',
    ],
  },
  JPN: {
    country: 'Japan',
    code: 'JPN',
    first: [
      'Ayase', 'Daichi', 'Daiki', 'Daizen', 'Gaku', 'Haruya', 'Hiroki', 'Hidemasa', 'Junya', 'Kaoru',
      'Keito', 'Ken', 'Kento', 'Ko', 'Koki', 'Kosei', 'Kota', 'Mao', 'Reo', 'Ritsu',
      'Ryoya', 'Shogo', 'Shuichi', 'Shuto', 'Sota', 'Takefusa', 'Takuma', 'Takumi', 'Wataru', 'Yuki', 'Yuto',
    ],
    last: [
      'Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato',
      'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki',
      'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa', 'Ogawa', 'Fujita', 'Okada', 'Hasegawa', 'Murakami',
    ],
  },
  NOR: {
    country: 'Norway',
    code: 'NOR',
    first: [
      'Alexander', 'Anders', 'Andreas', 'Aron', 'Birk', 'Christian', 'Daniel', 'Eirik', 'Emil', 'Erik',
      'Fredrik', 'Hakon', 'Henrik', 'Isak', 'Jakob', 'Jens', 'Joachim', 'Jonas', 'Jorgen', 'Kasper',
      'Kristian', 'Kristoffer', 'Lasse', 'Magnus', 'Marius', 'Martin', 'Mathias', 'Morten', 'Ola', 'Oscar', 'Sander', 'Tobias',
    ],
    last: [
      'Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen', 'Nilsen', 'Kristiansen', 'Jensen', 'Karlsen',
      'Johnsen', 'Pettersen', 'Eriksen', 'Berg', 'Haugen', 'Hagen', 'Johannessen', 'Andreassen', 'Jacobsen', 'Dahl',
      'Jorgensen', 'Halvorsen', 'Lund', 'Solberg', 'Moen', 'Strand', 'Bakke', 'Holm', 'Berge', 'Nygard',
    ],
  },
  DEN: {
    country: 'Denmark',
    code: 'DEN',
    first: [
      'Albert', 'Alexander', 'Anders', 'Andreas', 'Anton', 'August', 'Casper', 'Christian', 'Daniel', 'Emil',
      'Filip', 'Frederik', 'Gustav', 'Jacob', 'Jeppe', 'Joachim', 'Jonas', 'Kasper', 'Kristian', 'Lasse',
      'Lucas', 'Mads', 'Magnus', 'Marcus', 'Mathias', 'Mikkel', 'Morten', 'Nicolai', 'Niklas', 'Oliver', 'Rasmus', 'Victor',
    ],
    last: [
      'Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sorensen', 'Rasmussen', 'Jorgensen',
      'Petersen', 'Madsen', 'Kristensen', 'Olsen', 'Thomsen', 'Christiansen', 'Poulsen', 'Johansen', 'Moller', 'Mortensen',
      'Knudsen', 'Jakobsen', 'Krogh', 'Lind', 'Holm', 'Bjerregaard', 'Vestergaard', 'Damsgaard', 'Norgaard', 'Kjaer',
    ],
  },
  SWE: {
    country: 'Sweden',
    code: 'SWE',
    first: [
      'Adam', 'Albin', 'Alexander', 'Anton', 'Arvid', 'Axel', 'Benjamin', 'Carl', 'Daniel', 'Elias',
      'Emil', 'Erik', 'Filip', 'Gustav', 'Hampus', 'Henrik', 'Hugo', 'Isak', 'Jacob', 'Jesper',
      'Joel', 'Johan', 'Jonas', 'Jonathan', 'Karl', 'Linus', 'Lucas', 'Ludvig', 'Marcus', 'Mattias', 'Oliver', 'Oscar', 'Viktor',
    ],
    last: [
      'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson',
      'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson', 'Jonsson', 'Lindberg', 'Jakobsson', 'Magnusson', 'Lindstrom',
      'Lindqvist', 'Lindgren', 'Axelsson', 'Berg', 'Bergstrom', 'Lundberg', 'Lind', 'Lundgren', 'Mattsson', 'Berglund',
    ],
  },
  POL: {
    country: 'Poland',
    code: 'POL',
    first: [
      'Adam', 'Adrian', 'Aleksander', 'Arkadiusz', 'Artur', 'Bartlomiej', 'Bartosz', 'Damian', 'Daniel', 'Dawid',
      'Dominik', 'Filip', 'Grzegorz', 'Hubert', 'Igor', 'Jakub', 'Jan', 'Kacper', 'Kamil', 'Karol',
      'Konrad', 'Krzysztof', 'Lukasz', 'Maciej', 'Maksymilian', 'Marcin', 'Marek', 'Mateusz', 'Michal', 'Mikolaj', 'Pawel', 'Piotr', 'Szymon', 'Tomasz',
    ],
    last: [
      'Nowak', 'Kowalski', 'Wisniewski', 'Wojcik', 'Kowalczyk', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Wozniak',
      'Dabrowski', 'Kozlowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawlowski',
      'Michalski', 'Nowicki', 'Adamczyk', 'Dudek', 'Zajac', 'Wieczorek', 'Jablonski', 'Krol', 'Majewski', 'Olszewski',
    ],
  },
  CZE: {
    country: 'Czechia',
    code: 'CZE',
    first: [
      'Adam', 'Ales', 'Daniel', 'David', 'Dominik', 'Filip', 'Frantisek', 'Jakub', 'Jan', 'Jaroslav',
      'Jiri', 'Josef', 'Karel', 'Ladislav', 'Lukas', 'Marek', 'Martin', 'Matej', 'Michal', 'Milan',
      'Ondrej', 'Patrik', 'Pavel', 'Petr', 'Radek', 'Roman', 'Stanislav', 'Tomas', 'Vaclav', 'Vojtech',
    ],
    last: [
      'Novak', 'Svoboda', 'Novotny', 'Dvorak', 'Cerny', 'Prochazka', 'Kucera', 'Vesely', 'Horak', 'Nemec',
      'Marek', 'Pospisil', 'Pokorny', 'Hajek', 'Kral', 'Jelinek', 'Ruzicka', 'Benes', 'Fiala', 'Sedlacek',
      'Dolezal', 'Zeman', 'Kolar', 'Navratil', 'Cermak', 'Vanek', 'Urban', 'Blaha', 'Kriz', 'Kopecky',
    ],
  },
  SUI: {
    country: 'Switzerland',
    code: 'SUI',
    first: [
      'Adrian', 'Alessandro', 'Bastian', 'Cedric', 'Christian', 'Dario', 'David', 'Denis', 'Dominik', 'Fabian',
      'Fabio', 'Filip', 'Flavio', 'Jan', 'Joel', 'Jonas', 'Julian', 'Kevin', 'Léo', 'Loris',
      'Lukas', 'Marco', 'Matteo', 'Michael', 'Michel', 'Nicolas', 'Noah', 'Pascal', 'Remo', 'Robin', 'Silvan', 'Simon', 'Yann',
    ],
    last: [
      'Muller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider', 'Meyer', 'Steiner', 'Fischer',
      'Gerber', 'Brunner', 'Baumann', 'Frei', 'Zimmermann', 'Moser', 'Widmer', 'Wyss', 'Graf', 'Roth',
      'Suter', 'Bucher', 'Bachmann', 'Kaufmann', 'Studer', 'Bieri', 'Hofer', 'Gasser', 'Favre', 'Rochat',
    ],
  },
  COL: {
    country: 'Colombia',
    code: 'COL',
    first: [
      'Andres', 'Camilo', 'Carlos', 'Cristian', 'Daniel', 'David', 'Diego', 'Duvan', 'Edwin', 'Esteban',
      'Felipe', 'Gustavo', 'Ivan', 'James', 'Jefferson', 'Jhon', 'Johan', 'Jorge', 'Jose', 'Juan',
      'Kevin', 'Luis', 'Mateo', 'Miguel', 'Nelson', 'Oscar', 'Rafael', 'Santiago', 'Sebastian', 'Yerry',
    ],
    last: [
      'Rodriguez', 'Gomez', 'Gonzalez', 'Martinez', 'Garcia', 'Lopez', 'Hernandez', 'Sanchez', 'Ramirez', 'Perez',
      'Diaz', 'Torres', 'Rojas', 'Vargas', 'Moreno', 'Jimenez', 'Castro', 'Gutierrez', 'Muñoz', 'Alvarez',
      'Ruiz', 'Romero', 'Suarez', 'Ospina', 'Arias', 'Cardona', 'Mina', 'Quintero', 'Murillo', 'Cordoba',
    ],
  },
  URU: {
    country: 'Uruguay',
    code: 'URU',
    first: [
      'Agustin', 'Alfonso', 'Bruno', 'Camilo', 'Carlos', 'Christian', 'Cristian', 'Damian', 'Diego', 'Emiliano',
      'Fabian', 'Facundo', 'Federico', 'Felipe', 'Fernando', 'Franco', 'Gabriel', 'Gaston', 'Giorgian', 'Gonzalo',
      'Guillermo', 'Ignacio', 'Joaquin', 'Jose', 'Juan', 'Lucas', 'Luciano', 'Luis', 'Manuel', 'Martin', 'Mateo', 'Matias', 'Maximiliano', 'Nahitan', 'Nicolas', 'Rodrigo', 'Santiago', 'Sebastian',
    ],
    last: [
      'Rodriguez', 'Gonzalez', 'Martinez', 'Fernandez', 'Perez', 'Garcia', 'Silva', 'Lopez', 'Pereira', 'Sosa',
      'Suarez', 'Diaz', 'Gomez', 'Alvarez', 'Ramos', 'Romero', 'Hernandez', 'Acosta', 'Cabrera', 'Castro',
      'Olivera', 'Gimenez', 'Valverde', 'Bentancur', 'Araujo', 'Vina', 'Nandez', 'Torreira', 'Caceres', 'Godin',
    ],
  },
};

/**
 * Weighted foreign nationality mix per domestic league country so generated depth players
 * mirror realistic 2026/27 recruitment patterns across Europe.
 */
const COUNTRY_RECRUITMENT_MIX: Record<string, { domesticCode: string; domesticShare: number; foreign: string[] }> = {
  England: {
    domesticCode: 'ENG',
    domesticShare: 0.56,
    foreign: ['SCO', 'FRA', 'ESP', 'BRA', 'POR', 'NED', 'GER', 'NGA', 'CIV', 'NOR', 'DEN', 'BEL', 'ARG', 'JPN', 'SWE', 'POL', 'COL', 'SUI'],
  },
  Spain: {
    domesticCode: 'ESP',
    domesticShare: 0.68,
    foreign: ['ARG', 'BRA', 'URU', 'COL', 'FRA', 'POR', 'MAR', 'SRB', 'CRO', 'BEL', 'NGA', 'CIV', 'NOR', 'DEN', 'JPN'],
  },
  Italy: {
    domesticCode: 'ITA',
    domesticShare: 0.60,
    foreign: ['ARG', 'BRA', 'FRA', 'SRB', 'CRO', 'SVN', 'NED', 'POL', 'SUI', 'NGA', 'CIV', 'MAR', 'COL', 'URU', 'DEN', 'SWE', 'AUT', 'BEL'],
  },
  Germany: {
    domesticCode: 'GER',
    domesticShare: 0.62,
    foreign: ['AUT', 'SUI', 'NED', 'FRA', 'DEN', 'NOR', 'SWE', 'POL', 'CZE', 'CRO', 'SRB', 'JPN', 'BRA', 'NGA', 'CIV', 'BEL', 'TUR'],
  },
  France: {
    domesticCode: 'FRA',
    domesticShare: 0.62,
    foreign: ['CIV', 'MAR', 'NGA', 'BRA', 'ARG', 'BEL', 'POR', 'ESP', 'SUI', 'NED', 'JPN', 'COL', 'NOR', 'DEN', 'POL', 'TUR'],
  },
  Slovenia: {
    domesticCode: 'SVN',
    domesticShare: 0.66,
    foreign: ['CRO', 'SRB', 'BIH', 'AUT', 'ITA', 'NGA', 'CIV', 'BRA', 'POR', 'FRA', 'ESP', 'POL', 'CZE', 'NED'],
  },
  Netherlands: {
    domesticCode: 'NED',
    domesticShare: 0.62,
    foreign: ['BEL', 'GER', 'DEN', 'NOR', 'SWE', 'MAR', 'BRA', 'ARG', 'JPN', 'FRA', 'CRO', 'SRB', 'NGA', 'CIV', 'POL', 'CZE'],
  },
  Portugal: {
    domesticCode: 'POR',
    domesticShare: 0.56,
    foreign: ['BRA', 'ESP', 'ARG', 'COL', 'URU', 'FRA', 'NGA', 'CIV', 'MAR', 'JPN', 'DEN', 'NOR', 'SWE', 'SRB', 'CRO'],
  },
  Scotland: {
    domesticCode: 'SCO',
    domesticShare: 0.60,
    foreign: ['ENG', 'JPN', 'NOR', 'DEN', 'SWE', 'NED', 'CRO', 'POL', 'FRA', 'POR', 'NGA', 'CIV', 'BEL', 'AUT', 'GER'],
  },
  Belgium: {
    domesticCode: 'BEL',
    domesticShare: 0.54,
    foreign: ['FRA', 'NED', 'NGA', 'CIV', 'MAR', 'JPN', 'DEN', 'NOR', 'SWE', 'CRO', 'SRB', 'BRA', 'ARG', 'GER', 'COL', 'POL'],
  },
  Croatia: {
    domesticCode: 'CRO',
    domesticShare: 0.68,
    foreign: ['BIH', 'SVN', 'SRB', 'AUT', 'FRA', 'ESP', 'POR', 'BRA', 'COL', 'NGA', 'CIV', 'JPN', 'POL'],
  },
  Austria: {
    domesticCode: 'AUT',
    domesticShare: 0.62,
    foreign: ['GER', 'CRO', 'SRB', 'SVN', 'BIH', 'SUI', 'CZE', 'POL', 'DEN', 'NOR', 'CIV', 'NGA', 'BRA', 'JPN', 'FRA'],
  },
  Turkey: {
    domesticCode: 'TUR',
    domesticShare: 0.62,
    foreign: ['BRA', 'ARG', 'POR', 'NGA', 'CIV', 'MAR', 'BIH', 'SRB', 'CRO', 'POL', 'NOR', 'DEN', 'SWE', 'FRA', 'GER', 'COL', 'URU'],
  },
};

/* ============================================================================
 * 31-ATTRIBUTE CM 01/02 POSITION PROFILES & CALIBRATION ENGINE
 * ============================================================================ */

interface PositionProfileOffsets {
  technical: Partial<Record<keyof TechnicalAttributes, number>>;
  mental: Partial<Record<keyof MentalAttributes, number>>;
  physical: Partial<Record<keyof PhysicalAttributes, number>>;
  goalkeeping?: Partial<Record<keyof GoalkeepingAttributes, number>>;
}

const POSITION_PROFILES: Record<PositionCode, PositionProfileOffsets> = {
  GK: {
    technical: {
      crossing: -5.5, dribbling: -5.5, finishing: -6.5, heading: -3.0, longShots: -6.0,
      marking: -4.5, offTheBall: -5.5, passing: -1.0, penalties: -4.5, setPieces: -4.0,
      tackling: -4.5, technique: -2.0,
    },
    mental: {
      aggression: -0.8, anticipation: 1.6, bravery: 1.8, creativity: -3.0, decisions: 1.5,
      determination: 1.0, flair: -4.0, influence: 1.0, teamwork: 0.5, workRate: -1.0,
    },
    physical: {
      acceleration: -2.0, agility: 1.8, balance: 0.8, jumping: 1.8, naturalFitness: 1.0,
      pace: -2.5, stamina: -1.4, strength: 1.0,
    },
    goalkeeping: { handling: 2.3, reflexes: 2.5, oneOnOnes: 1.9, positioning: 2.1 },
  },
  DC: {
    technical: {
      crossing: -3.2, dribbling: -2.8, finishing: -4.2, heading: 2.4, longShots: -3.0,
      marking: 2.5, offTheBall: -2.4, passing: 0.2, penalties: -2.0, setPieces: -2.2,
      tackling: 2.5, technique: -0.6,
    },
    mental: {
      aggression: 1.5, anticipation: 1.7, bravery: 2.0, creativity: -2.4, decisions: 1.6,
      determination: 1.2, flair: -3.0, influence: 1.2, teamwork: 1.0, workRate: 0.6,
    },
    physical: {
      acceleration: -0.2, agility: -0.5, balance: 1.0, jumping: 2.3, naturalFitness: 0.8,
      pace: 0.1, stamina: 0.8, strength: 2.3,
    },
  },
  DL: {
    technical: {
      crossing: 1.8, dribbling: 0.8, finishing: -2.4, heading: -0.6, longShots: -1.6,
      marking: 1.5, offTheBall: 0.5, passing: 0.9, penalties: -1.8, setPieces: -0.6,
      tackling: 1.7, technique: 0.6,
    },
    mental: {
      aggression: 0.6, anticipation: 1.2, bravery: 0.8, creativity: -0.4, decisions: 1.0,
      determination: 1.0, flair: -0.5, influence: -0.2, teamwork: 1.4, workRate: 1.8,
    },
    physical: {
      acceleration: 1.8, agility: 1.1, balance: 0.8, jumping: -0.2, naturalFitness: 1.0,
      pace: 1.9, stamina: 2.0, strength: 0.3,
    },
  },
  DR: {
    technical: {
      crossing: 1.8, dribbling: 0.8, finishing: -2.4, heading: -0.6, longShots: -1.6,
      marking: 1.5, offTheBall: 0.5, passing: 0.9, penalties: -1.8, setPieces: -0.6,
      tackling: 1.7, technique: 0.6,
    },
    mental: {
      aggression: 0.6, anticipation: 1.2, bravery: 0.8, creativity: -0.4, decisions: 1.0,
      determination: 1.0, flair: -0.5, influence: -0.2, teamwork: 1.4, workRate: 1.8,
    },
    physical: {
      acceleration: 1.8, agility: 1.1, balance: 0.8, jumping: -0.2, naturalFitness: 1.0,
      pace: 1.9, stamina: 2.0, strength: 0.3,
    },
  },
  DMC: {
    technical: {
      crossing: -1.6, dribbling: -0.5, finishing: -2.0, heading: 0.3, longShots: 0.4,
      marking: 1.6, offTheBall: -0.3, passing: 1.7, penalties: -1.0, setPieces: -0.6,
      tackling: 2.1, technique: 0.9,
    },
    mental: {
      aggression: 1.4, anticipation: 1.8, bravery: 1.4, creativity: 0.4, decisions: 1.8,
      determination: 1.4, flair: -1.5, influence: 1.0, teamwork: 1.8, workRate: 1.8,
    },
    physical: {
      acceleration: -0.1, agility: 0.1, balance: 1.0, jumping: 0.4, naturalFitness: 1.2,
      pace: -0.1, stamina: 1.9, strength: 1.6,
    },
  },
  MC: {
    technical: {
      crossing: -0.1, dribbling: 0.8, finishing: -0.4, heading: -0.9, longShots: 0.9,
      marking: 0.1, offTheBall: 1.1, passing: 2.2, penalties: 0.2, setPieces: 0.5,
      tackling: 0.7, technique: 1.6,
    },
    mental: {
      aggression: 0.3, anticipation: 1.3, bravery: 0.5, creativity: 1.9, decisions: 1.9,
      determination: 1.2, flair: 0.5, influence: 0.8, teamwork: 1.8, workRate: 1.7,
    },
    physical: {
      acceleration: 0.3, agility: 0.7, balance: 1.0, jumping: -0.4, naturalFitness: 1.0,
      pace: 0.3, stamina: 1.9, strength: 0.5,
    },
  },
  ML: {
    technical: {
      crossing: 2.1, dribbling: 1.9, finishing: 0.2, heading: -1.8, longShots: 0.3,
      marking: -1.2, offTheBall: 1.3, passing: 1.3, penalties: -0.5, setPieces: 0.7,
      tackling: -1.0, technique: 1.5,
    },
    mental: {
      aggression: -0.7, anticipation: 0.9, bravery: -0.4, creativity: 1.3, decisions: 0.9,
      determination: 0.8, flair: 1.6, influence: -0.4, teamwork: 1.0, workRate: 1.5,
    },
    physical: {
      acceleration: 2.0, agility: 1.6, balance: 1.0, jumping: -1.2, naturalFitness: 0.8,
      pace: 2.1, stamina: 1.7, strength: -0.9,
    },
  },
  MR: {
    technical: {
      crossing: 2.1, dribbling: 1.9, finishing: 0.2, heading: -1.8, longShots: 0.3,
      marking: -1.2, offTheBall: 1.3, passing: 1.3, penalties: -0.5, setPieces: 0.7,
      tackling: -1.0, technique: 1.5,
    },
    mental: {
      aggression: -0.7, anticipation: 0.9, bravery: -0.4, creativity: 1.3, decisions: 0.9,
      determination: 0.8, flair: 1.6, influence: -0.4, teamwork: 1.0, workRate: 1.5,
    },
    physical: {
      acceleration: 2.0, agility: 1.6, balance: 1.0, jumping: -1.2, naturalFitness: 0.8,
      pace: 2.1, stamina: 1.7, strength: -0.9,
    },
  },
  AMC: {
    technical: {
      crossing: 0.5, dribbling: 1.9, finishing: 1.2, heading: -2.0, longShots: 1.5,
      marking: -2.8, offTheBall: 1.7, passing: 2.1, penalties: 0.9, setPieces: 1.3,
      tackling: -2.4, technique: 2.1,
    },
    mental: {
      aggression: -1.0, anticipation: 1.5, bravery: -0.7, creativity: 2.4, decisions: 1.7,
      determination: 0.9, flair: 2.2, influence: 0.5, teamwork: 1.0, workRate: 0.3,
    },
    physical: {
      acceleration: 1.4, agility: 1.7, balance: 1.4, jumping: -1.4, naturalFitness: 0.6,
      pace: 0.9, stamina: 0.7, strength: -0.7,
    },
  },
  FL: {
    technical: {
      crossing: 1.5, dribbling: 2.3, finishing: 1.7, heading: -1.5, longShots: 0.7,
      marking: -3.2, offTheBall: 1.9, passing: 0.9, penalties: 0.5, setPieces: 0.3,
      tackling: -3.0, technique: 1.7,
    },
    mental: {
      aggression: -0.7, anticipation: 1.5, bravery: -0.5, creativity: 1.3, decisions: 1.1,
      determination: 1.0, flair: 2.1, influence: -0.3, teamwork: 0.5, workRate: 0.5,
    },
    physical: {
      acceleration: 2.4, agility: 1.9, balance: 1.2, jumping: -0.9, naturalFitness: 0.8,
      pace: 2.5, stamina: 0.9, strength: -0.7,
    },
  },
  FR: {
    technical: {
      crossing: 1.5, dribbling: 2.3, finishing: 1.7, heading: -1.5, longShots: 0.7,
      marking: -3.2, offTheBall: 1.9, passing: 0.9, penalties: 0.5, setPieces: 0.3,
      tackling: -3.0, technique: 1.7,
    },
    mental: {
      aggression: -0.7, anticipation: 1.5, bravery: -0.5, creativity: 1.3, decisions: 1.1,
      determination: 1.0, flair: 2.1, influence: -0.3, teamwork: 0.5, workRate: 0.5,
    },
    physical: {
      acceleration: 2.4, agility: 1.9, balance: 1.2, jumping: -0.9, naturalFitness: 0.8,
      pace: 2.5, stamina: 0.9, strength: -0.7,
    },
  },
  FC: {
    technical: {
      crossing: -1.2, dribbling: 1.3, finishing: 2.6, heading: 1.5, longShots: 0.8,
      marking: -3.8, offTheBall: 2.3, passing: 0.1, penalties: 1.3, setPieces: -1.0,
      tackling: -3.6, technique: 1.3,
    },
    mental: {
      aggression: 0.3, anticipation: 2.0, bravery: 1.0, creativity: 0.3, decisions: 1.5,
      determination: 1.4, flair: 1.1, influence: 0.3, teamwork: 0.5, workRate: 0.5,
    },
    physical: {
      acceleration: 1.5, agility: 1.1, balance: 1.1, jumping: 1.3, naturalFitness: 0.8,
      pace: 1.5, stamina: 0.7, strength: 1.5,
    },
  },
};

export function generatePlayerAttributes(
  currentAbility: number,
  positions: PositionCode[],
  age: number,
  rng: () => number,
  overrides?: RealPlayerSeed['attributeOverrides']
): PlayerAttributes {
  const primary: PositionCode = positions[0] ?? 'MC';
  const secondary: PositionCode | undefined = positions[1];
  const p1 = POSITION_PROFILES[primary];
  const p2 = secondary ? POSITION_PROFILES[secondary] : undefined;

  // Base 1..20 scale smoothly anchored to CM 01/02 CA (1..200)
  const base = 3.2 + (clamp(currentAbility, 35, 200) / 200) * 13.8;

  // Age curve adjustments
  const youthPaceBonus = age <= 22 ? 0.9 : age <= 26 ? 0.3 : age >= 32 ? -1.4 : age >= 30 ? -0.6 : 0;
  const expMentalBonus = age >= 30 ? 1.2 : age >= 27 ? 0.5 : age <= 19 ? -1.2 : age <= 21 ? -0.5 : 0;
  const vetStaminaMod = age >= 33 ? -1.5 : age >= 30 ? -0.6 : age <= 24 ? 0.4 : 0;
  const penAge = age >= 27 ? 0.6 : 0;
  const setAge = age >= 27 ? 0.5 : 0;

  const t1 = p1.technical;
  const m1 = p1.mental;
  const f1 = p1.physical;
  const t2 = p2?.technical;
  const m2 = p2?.mental;
  const f2 = p2?.physical;

  const technical: TechnicalAttributes = t2
    ? {
        crossing: clampAttr(base + (t1.crossing ?? 0) * 0.75 + (t2.crossing ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        dribbling: clampAttr(base + (t1.dribbling ?? 0) * 0.75 + (t2.dribbling ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        finishing: clampAttr(base + (t1.finishing ?? 0) * 0.75 + (t2.finishing ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        heading: clampAttr(base + (t1.heading ?? 0) * 0.75 + (t2.heading ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        longShots: clampAttr(base + (t1.longShots ?? 0) * 0.75 + (t2.longShots ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        marking: clampAttr(base + (t1.marking ?? 0) * 0.75 + (t2.marking ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        offTheBall: clampAttr(base + (t1.offTheBall ?? 0) * 0.75 + (t2.offTheBall ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        passing: clampAttr(base + (t1.passing ?? 0) * 0.75 + (t2.passing ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        penalties: clampAttr(base + (t1.penalties ?? 0) * 0.75 + (t2.penalties ?? 0) * 0.25 + penAge + (rng() - 0.5) * 3.2),
        setPieces: clampAttr(base + (t1.setPieces ?? 0) * 0.75 + (t2.setPieces ?? 0) * 0.25 + setAge + (rng() - 0.5) * 3.2),
        tackling: clampAttr(base + (t1.tackling ?? 0) * 0.75 + (t2.tackling ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        technique: clampAttr(base + (t1.technique ?? 0) * 0.75 + (t2.technique ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
      }
    : {
        crossing: clampAttr(base + (t1.crossing ?? 0) + (rng() - 0.5) * 3.2),
        dribbling: clampAttr(base + (t1.dribbling ?? 0) + (rng() - 0.5) * 3.2),
        finishing: clampAttr(base + (t1.finishing ?? 0) + (rng() - 0.5) * 3.2),
        heading: clampAttr(base + (t1.heading ?? 0) + (rng() - 0.5) * 3.2),
        longShots: clampAttr(base + (t1.longShots ?? 0) + (rng() - 0.5) * 3.2),
        marking: clampAttr(base + (t1.marking ?? 0) + (rng() - 0.5) * 3.2),
        offTheBall: clampAttr(base + (t1.offTheBall ?? 0) + (rng() - 0.5) * 3.2),
        passing: clampAttr(base + (t1.passing ?? 0) + (rng() - 0.5) * 3.2),
        penalties: clampAttr(base + (t1.penalties ?? 0) + penAge + (rng() - 0.5) * 3.2),
        setPieces: clampAttr(base + (t1.setPieces ?? 0) + setAge + (rng() - 0.5) * 3.2),
        tackling: clampAttr(base + (t1.tackling ?? 0) + (rng() - 0.5) * 3.2),
        technique: clampAttr(base + (t1.technique ?? 0) + (rng() - 0.5) * 3.2),
      };

  const mental: MentalAttributes = m2
    ? {
        aggression: clampAttr(9.5 + (m1.aggression ?? 0) * 0.75 + (m2.aggression ?? 0) * 0.25 + (rng() - 0.5) * 6.5),
        anticipation: clampAttr(base + (m1.anticipation ?? 0) * 0.75 + (m2.anticipation ?? 0) * 0.25 + expMentalBonus + (rng() - 0.5) * 3.2),
        bravery: clampAttr(base + (m1.bravery ?? 0) * 0.75 + (m2.bravery ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        creativity: clampAttr(base + (m1.creativity ?? 0) * 0.75 + (m2.creativity ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        decisions: clampAttr(base + (m1.decisions ?? 0) * 0.75 + (m2.decisions ?? 0) * 0.25 + expMentalBonus + (rng() - 0.5) * 3.2),
        determination: clampAttr(base + (m1.determination ?? 0) * 0.75 + (m2.determination ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        flair: clampAttr(base + (m1.flair ?? 0) * 0.75 + (m2.flair ?? 0) * 0.25 + (rng() - 0.5) * 4.0),
        influence: clampAttr(base - 0.5 + (m1.influence ?? 0) * 0.75 + (m2.influence ?? 0) * 0.25 + expMentalBonus * 1.4 + (rng() - 0.5) * 3.2),
        teamwork: clampAttr(base + (m1.teamwork ?? 0) * 0.75 + (m2.teamwork ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        workRate: clampAttr(base + (m1.workRate ?? 0) * 0.75 + (m2.workRate ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
      }
    : {
        aggression: clampAttr(9.5 + (m1.aggression ?? 0) + (rng() - 0.5) * 6.5),
        anticipation: clampAttr(base + (m1.anticipation ?? 0) + expMentalBonus + (rng() - 0.5) * 3.2),
        bravery: clampAttr(base + (m1.bravery ?? 0) + (rng() - 0.5) * 3.2),
        creativity: clampAttr(base + (m1.creativity ?? 0) + (rng() - 0.5) * 3.2),
        decisions: clampAttr(base + (m1.decisions ?? 0) + expMentalBonus + (rng() - 0.5) * 3.2),
        determination: clampAttr(base + (m1.determination ?? 0) + (rng() - 0.5) * 3.2),
        flair: clampAttr(base + (m1.flair ?? 0) + (rng() - 0.5) * 4.0),
        influence: clampAttr(base - 0.5 + (m1.influence ?? 0) + expMentalBonus * 1.4 + (rng() - 0.5) * 3.2),
        teamwork: clampAttr(base + (m1.teamwork ?? 0) + (rng() - 0.5) * 3.2),
        workRate: clampAttr(base + (m1.workRate ?? 0) + (rng() - 0.5) * 3.2),
      };

  const nfOff = f2 ? (f1.naturalFitness ?? 0) * 0.75 + (f2.naturalFitness ?? 0) * 0.25 : (f1.naturalFitness ?? 0);
  const naturalFitness = clampAttr(11.5 + nfOff + (rng() - 0.5) * 5.0);
  const injuryProneness = clampAttr(
    8.5 + (age >= 32 ? 2.2 : age <= 21 ? -1.0 : 0) - (naturalFitness - 12) * 0.35 + (rng() - 0.5) * 6.5
  );
  const strAge = age <= 19 ? -1.0 : 0.2;

  const physical: PhysicalAttributes = f2
    ? {
        acceleration: clampAttr(base + (f1.acceleration ?? 0) * 0.75 + (f2.acceleration ?? 0) * 0.25 + youthPaceBonus + (rng() - 0.5) * 3.2),
        agility: clampAttr(base + (f1.agility ?? 0) * 0.75 + (f2.agility ?? 0) * 0.25 + youthPaceBonus * 0.6 + (rng() - 0.5) * 3.2),
        balance: clampAttr(base + (f1.balance ?? 0) * 0.75 + (f2.balance ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        injuryProneness,
        jumping: clampAttr(base + (f1.jumping ?? 0) * 0.75 + (f2.jumping ?? 0) * 0.25 + (rng() - 0.5) * 3.2),
        naturalFitness,
        pace: clampAttr(base + (f1.pace ?? 0) * 0.75 + (f2.pace ?? 0) * 0.25 + youthPaceBonus + (rng() - 0.5) * 3.2),
        stamina: clampAttr(base + (f1.stamina ?? 0) * 0.75 + (f2.stamina ?? 0) * 0.25 + vetStaminaMod + (rng() - 0.5) * 3.2),
        strength: clampAttr(base + (f1.strength ?? 0) * 0.75 + (f2.strength ?? 0) * 0.25 + strAge + (rng() - 0.5) * 3.2),
      }
    : {
        acceleration: clampAttr(base + (f1.acceleration ?? 0) + youthPaceBonus + (rng() - 0.5) * 3.2),
        agility: clampAttr(base + (f1.agility ?? 0) + youthPaceBonus * 0.6 + (rng() - 0.5) * 3.2),
        balance: clampAttr(base + (f1.balance ?? 0) + (rng() - 0.5) * 3.2),
        injuryProneness,
        jumping: clampAttr(base + (f1.jumping ?? 0) + (rng() - 0.5) * 3.2),
        naturalFitness,
        pace: clampAttr(base + (f1.pace ?? 0) + youthPaceBonus + (rng() - 0.5) * 3.2),
        stamina: clampAttr(base + (f1.stamina ?? 0) + vetStaminaMod + (rng() - 0.5) * 3.2),
        strength: clampAttr(base + (f1.strength ?? 0) + strAge + (rng() - 0.5) * 3.2),
      };

  let goalkeeping: GoalkeepingAttributes | undefined;
  if (primary === 'GK' || secondary === 'GK') {
    const gkOff = POSITION_PROFILES.GK.goalkeeping!;
    goalkeeping = {
      handling: clampAttr(base + (gkOff.handling ?? 2.0) + (rng() - 0.5) * 3.2),
      reflexes: clampAttr(base + (gkOff.reflexes ?? 2.2) + (rng() - 0.5) * 3.2),
      oneOnOnes: clampAttr(base + (gkOff.oneOnOnes ?? 1.8) + (rng() - 0.5) * 3.2),
      positioning: clampAttr(base + (gkOff.positioning ?? 2.0) + expMentalBonus * 0.7 + (rng() - 0.5) * 3.2),
    };
  }

  // Honor explicit signature attributeOverrides from REAL_PLAYERS_SEED / hydrated overrides
  if (overrides?.technical) {
    for (const [k, v] of Object.entries(overrides.technical) as Array<[keyof TechnicalAttributes, number | undefined]>) {
      if (typeof v === 'number') technical[k] = clampAttr(v);
    }
  }
  if (overrides?.mental) {
    for (const [k, v] of Object.entries(overrides.mental) as Array<[keyof MentalAttributes, number | undefined]>) {
      if (typeof v === 'number') mental[k] = clampAttr(v);
    }
  }
  if (overrides?.physical) {
    for (const [k, v] of Object.entries(overrides.physical) as Array<[keyof PhysicalAttributes, number | undefined]>) {
      if (typeof v === 'number') physical[k] = clampAttr(v);
    }
  }
  if (overrides?.goalkeeping) {
    goalkeeping = {
      handling: clampAttr(overrides.goalkeeping.handling ?? goalkeeping?.handling ?? 10),
      reflexes: clampAttr(overrides.goalkeeping.reflexes ?? goalkeeping?.reflexes ?? 10),
      oneOnOnes: clampAttr(overrides.goalkeeping.oneOnOnes ?? goalkeeping?.oneOnOnes ?? 10),
      positioning: clampAttr(overrides.goalkeeping.positioning ?? goalkeeping?.positioning ?? 10),
    };
  }

  return goalkeeping ? { technical, mental, physical, goalkeeping } : { technical, mental, physical };
}

/* ============================================================================
 * PLAYER BUILDER (REAL SEEDS & DETERMINISTIC SQUAD FILLERS)
 * ============================================================================ */

function derivePhysicalBio(
  primary: PositionCode,
  rng: () => number
): { heightCm: number; weightKg: number; preferredFoot: Footedness } {
  let heightCm: number;
  switch (primary) {
    case 'GK':
      heightCm = Math.round(186 + rng() * 11);
      break;
    case 'DC':
      heightCm = Math.round(183 + rng() * 11);
      break;
    case 'FC':
      heightCm = Math.round(176 + rng() * 16);
      break;
    case 'DMC':
      heightCm = Math.round(177 + rng() * 12);
      break;
    default:
      heightCm = Math.round(171 + rng() * 14);
      break;
  }
  const weightKg = Math.round((heightCm - 105) + (rng() - 0.4) * 8);

  let preferredFoot: Footedness;
  if (primary === 'DL' || primary === 'ML') {
    preferredFoot = rng() < 0.78 ? 'left' : rng() < 0.92 ? 'both' : 'right';
  } else if (primary === 'DR' || primary === 'MR') {
    preferredFoot = rng() < 0.84 ? 'right' : rng() < 0.94 ? 'both' : 'left';
  } else {
    const r = rng();
    preferredFoot = r < 0.68 ? 'right' : r < 0.90 ? 'left' : 'both';
  }

  return { heightCm, weightKg, preferredFoot };
}

function generateCareerHistory(
  clubName: string,
  age: number,
  primary: PositionCode,
  ca: number,
  rng: () => number
): PlayerHistoryEntry[] {
  const seasons = ['2023/24', '2024/25', '2025/26'];
  const history: PlayerHistoryEntry[] = [];
  const cat = getPositionCategory(primary);

  for (let i = 0; i < seasons.length; i++) {
    const ageAtSeason = age - (3 - i);
    if (ageAtSeason < 17) continue;
    const apps = Math.round(clamp(10 + rng() * 26 + (ageAtSeason >= 21 ? 4 : -4), 4, 38));
    let goals = 0;
    let assists = 0;
    if (cat === 'FWD') {
      goals = Math.max(0, Math.round(apps * (0.18 + (ca / 200) * 0.25 + (rng() - 0.4) * 0.18)));
      assists = Math.max(0, Math.round(apps * (0.08 + rng() * 0.14)));
    } else if (cat === 'MID') {
      goals = Math.max(0, Math.round(apps * (0.05 + (ca / 200) * 0.12 + rng() * 0.08)));
      assists = Math.max(0, Math.round(apps * (0.08 + (ca / 200) * 0.16 + rng() * 0.1)));
    } else if (cat === 'DEF') {
      goals = Math.max(0, Math.round(apps * (0.02 + rng() * 0.06)));
      assists = Math.max(0, Math.round(apps * (0.03 + rng() * 0.09)));
    }
    const avgRating = Math.round((6.45 + (ca / 200) * 0.65 + (rng() - 0.5) * 0.45) * 100) / 100;
    history.push({
      season: seasons[i],
      clubName,
      apps,
      goals,
      assists,
      avgRating: clamp(avgRating, 6.1, 7.95),
    });
  }
  return history;
}

function buildPlayerFromSeed(
  seed: RealPlayerSeed & { imageUrl?: string },
  leagueReputation: number,
  clubName: string,
  usedIds: Set<string>,
  preSluggedId?: string
): Player {
  const baseId = preSluggedId ?? (seed.id ? slugify(seed.id) : slugify(`${seed.name}-${seed.clubId ?? 'fa'}`));
  let id = baseId || 'player';
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix++}`;
  }
  usedIds.add(id);

  const rng = createRng(fnv1a(`${id}|${seed.name}|${seed.age}`));
  const primary: PositionCode = seed.positions[0] ?? 'MC';
  const bio = derivePhysicalBio(primary, rng);
  const ca = clamp(Math.round(seed.currentAbility), 40, 200);
  const pa = clamp(
    Math.round(seed.potentialAbility ?? Math.max(ca, seed.age <= 22 ? ca + 14 : ca + 2)),
    ca,
    200
  );
  const reputation = clamp(
    Math.round(seed.reputation ?? clamp(ca * 47 + (leagueReputation - 10) * 90, 900, 9850)),
    500,
    10000
  );
  const attributes = generatePlayerAttributes(ca, seed.positions, seed.age, rng, seed.attributeOverrides);

  const contractYear = seed.clubId
    ? 2027 + Math.floor(rng() * 4)
    : 0;
  const contractExpires =
    seed.contractExpires !== undefined
      ? seed.contractExpires
      : seed.clubId
        ? `${contractYear}-06-30`
        : '';

  const moraleOptions: MoraleLevel[] = ['Good', 'Very Good', 'Good', 'Very Good', 'Superb', 'Okay'];
  const morale: MoraleLevel = moraleOptions[Math.floor(rng() * moraleOptions.length)];

  const careerHistory = generateCareerHistory(clubName, seed.age, primary, ca, rng);
  const histApps = careerHistory.reduce((acc, h) => acc + h.apps, 0);
  const histGoals = careerHistory.reduce((acc, h) => acc + h.goals, 0);
  const yearsPro = Math.max(0, seed.age - 18);

  const player: Player = {
    id,
    name: seed.name,
    shortName: seed.shortName ?? deriveShortName(seed.name),
    clubId: seed.clubId,
    nationality: seed.nationality,
    nationalityCode: seed.nationalityCode,
    age: seed.age,
    dateOfBirth: seed.dateOfBirth ?? deriveDateOfBirth(seed.age, rng),
    positions: seed.positions.length > 0 ? seed.positions : ['MC'],
    preferredFoot: seed.preferredFoot ?? bio.preferredFoot,
    heightCm: seed.heightCm ?? bio.heightCm,
    weightKg: seed.weightKg ?? bio.weightKg,
    squadNumber: seed.squadNumber,
    attributes,
    currentAbility: ca,
    potentialAbility: pa,
    isWonderkid: seed.isWonderkid ?? (seed.age <= 21 && pa >= 162),
    reputation,
    value: seed.value ?? 0,
    wage: seed.wage ?? 0,
    contractExpires,
    squadStatus: 'Squad Rotation',
    transferListed: false,
    loanListed: false,
    condition: Math.round(92 + rng() * 8),
    morale,
    injury: null,
    suspendedMatches: 0,
    careerApps: seed.careerApps ?? Math.max(histApps, yearsPro * 24 + Math.floor(rng() * 20)),
    careerGoals: seed.careerGoals ?? Math.max(histGoals, Math.floor(histGoals * Math.max(1, yearsPro / 3))),
    internationalCaps: seed.internationalCaps ?? (ca >= 145 && seed.age >= 21 ? Math.floor((ca - 135) * 0.7 + rng() * 14) : 0),
    internationalGoals: seed.internationalGoals ?? 0,
    seasonStats: emptySeasonStats(),
    careerHistory,
    form: [],
    wikiQuery: seed.wikiQuery ?? `${seed.name} footballer`,
    imageUrl: seed.imageUrl,
  };

  if (!player.value || player.value <= 0) {
    player.value = seed.clubId ? estimatePlayerValue(player, leagueReputation) : 0;
  }
  if (!player.wage || player.wage <= 0) {
    player.wage = seed.clubId ? estimateWeeklyWage(player) : 0;
  }

  return player;
}

/* ============================================================================
 * BALANCED 22-24 PLAYER SQUAD FILLER FOR ALL 310 CLUBS
 * ============================================================================ */

interface SquadTargetSlot {
  positions: PositionCode[];
  cat: PositionCategory;
  ageMin: number;
  ageMax: number;
  caOffset: number;
}

const IDEAL_SQUAD_BLUEPRINT: SquadTargetSlot[] = [
  // 3 Goalkeepers
  { positions: ['GK'], cat: 'GK', ageMin: 24, ageMax: 33, caOffset: 3 },
  { positions: ['GK'], cat: 'GK', ageMin: 21, ageMax: 31, caOffset: -4 },
  { positions: ['GK'], cat: 'GK', ageMin: 18, ageMax: 22, caOffset: -11 },
  // 8 Defenders (2 DL, 4 DC, 2 DR)
  { positions: ['DL', 'ML'], cat: 'DEF', ageMin: 22, ageMax: 30, caOffset: 2 },
  { positions: ['DL'], cat: 'DEF', ageMin: 19, ageMax: 26, caOffset: -5 },
  { positions: ['DC'], cat: 'DEF', ageMin: 24, ageMax: 32, caOffset: 4 },
  { positions: ['DC'], cat: 'DEF', ageMin: 22, ageMax: 30, caOffset: 2 },
  { positions: ['DC', 'DMC'], cat: 'DEF', ageMin: 20, ageMax: 28, caOffset: -3 },
  { positions: ['DC'], cat: 'DEF', ageMin: 18, ageMax: 24, caOffset: -8 },
  { positions: ['DR', 'MR'], cat: 'DEF', ageMin: 22, ageMax: 30, caOffset: 2 },
  { positions: ['DR'], cat: 'DEF', ageMin: 19, ageMax: 26, caOffset: -5 },
  // 7 Midfielders (2 DMC, 2 MC, 1 ML, 1 MR, 1 AMC)
  { positions: ['DMC', 'MC'], cat: 'MID', ageMin: 23, ageMax: 31, caOffset: 3 },
  { positions: ['DMC'], cat: 'MID', ageMin: 19, ageMax: 26, caOffset: -4 },
  { positions: ['MC'], cat: 'MID', ageMin: 22, ageMax: 30, caOffset: 4 },
  { positions: ['MC', 'AMC'], cat: 'MID', ageMin: 20, ageMax: 27, caOffset: -2 },
  { positions: ['ML', 'FL'], cat: 'MID', ageMin: 21, ageMax: 29, caOffset: 1 },
  { positions: ['MR', 'FR'], cat: 'MID', ageMin: 21, ageMax: 29, caOffset: 1 },
  { positions: ['AMC', 'MC'], cat: 'MID', ageMin: 19, ageMax: 28, caOffset: 2 },
  // 5 Forwards (2 FC, 1 FL, 1 FR, 1 young FC)
  { positions: ['FC'], cat: 'FWD', ageMin: 23, ageMax: 31, caOffset: 5 },
  { positions: ['FC'], cat: 'FWD', ageMin: 21, ageMax: 29, caOffset: 0 },
  { positions: ['FL', 'ML'], cat: 'FWD', ageMin: 20, ageMax: 28, caOffset: 2 },
  { positions: ['FR', 'MR'], cat: 'FWD', ageMin: 20, ageMax: 28, caOffset: 2 },
  { positions: ['FC', 'FL'], cat: 'FWD', ageMin: 18, ageMax: 22, caOffset: -7 },
];

function pickNationalityPool(country: string, rng: () => number): NamePool {
  const mix = COUNTRY_RECRUITMENT_MIX[country] ?? COUNTRY_RECRUITMENT_MIX.England;
  if (rng() < mix.domesticShare) {
    return NAME_POOLS[mix.domesticCode] ?? NAME_POOLS.ENG;
  }
  const foreignCode = mix.foreign[Math.floor(rng() * mix.foreign.length)];
  return NAME_POOLS[foreignCode] ?? NAME_POOLS.ENG;
}

function generateClubFillerPlayers(
  clubSeed: ClubSeed,
  league: League,
  existingSquad: Player[],
  usedIds: Set<string>
): Player[] {
  const rng = createRng(fnv1a(`filler|${clubSeed.id}|2026-27`));
  const generated: Player[] = [];
  const existingNames = new Set(existingSquad.map((p) => p.name.toLowerCase()));

  // Track current coverage by category & specific position
  const catCounts: Record<PositionCategory, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const posCounts: Partial<Record<PositionCode, number>> = {};
  for (const p of existingSquad) {
    const primary = p.positions[0] ?? 'MC';
    catCounts[getPositionCategory(primary)]++;
    posCounts[primary] = (posCounts[primary] ?? 0) + 1;
  }

  // Calibrate club filler mean CA cleanly from club reputation
  const clubMeanCa = clamp(Math.round(32 + (clubSeed.reputation / 10000) * 120), 60, 152);
  const targetSize = Math.max(23, existingSquad.length);

  // Determine missing positional needs first (guarantees 3 GK, 8 DEF, 7 MID, 5 FWD balance)
  const neededSlots: SquadTargetSlot[] = [];
  const tempCatCounts = { ...catCounts };
  const tempPosCounts = { ...posCounts };

  for (const slot of IDEAL_SQUAD_BLUEPRINT) {
    const primary = slot.positions[0];
    const desiredCatTotal =
      slot.cat === 'GK' ? 3 : slot.cat === 'DEF' ? 8 : slot.cat === 'MID' ? 7 : 5;

    if (tempCatCounts[slot.cat] < desiredCatTotal) {
      // Ensure essential wide/central balance (DL, DR, DC, DMC, MC, FC, FL, FR)
      const currentPosCount = tempPosCounts[primary] ?? 0;
      const neededForPos =
        primary === 'DC' ? 4 : primary === 'GK' ? 3 : primary === 'FC' ? 3 : primary === 'MC' ? 2 : 1;
      if (currentPosCount < neededForPos || tempCatCounts[slot.cat] < desiredCatTotal - 1) {
        neededSlots.push(slot);
        tempCatCounts[slot.cat]++;
        tempPosCounts[primary] = currentPosCount + 1;
      }
    }
  }

  // Ensure minimum hard positional guarantees (at least 2 GK, 7 DEF, 7 MID, 4 FWD) and total 22..24
  const extraCycle: SquadTargetSlot[] = [
    { positions: ['GK'], cat: 'GK', ageMin: 19, ageMax: 29, caOffset: -5 },
    { positions: ['DC'], cat: 'DEF', ageMin: 20, ageMax: 29, caOffset: -2 },
    { positions: ['DL', 'DR'], cat: 'DEF', ageMin: 20, ageMax: 28, caOffset: -3 },
    { positions: ['MC', 'DMC'], cat: 'MID', ageMin: 20, ageMax: 28, caOffset: -1 },
    { positions: ['AMC', 'MC'], cat: 'MID', ageMin: 19, ageMax: 27, caOffset: -2 },
    { positions: ['FC', 'FR'], cat: 'FWD', ageMin: 19, ageMax: 28, caOffset: -2 },
  ];

  let cycleIdx = 0;
  while (existingSquad.length + neededSlots.length < targetSize) {
    const candidate = extraCycle[cycleIdx % extraCycle.length];
    cycleIdx++;
    if (candidate.cat === 'GK' && tempCatCounts.GK >= 3) continue;
    neededSlots.push(candidate);
    tempCatCounts[candidate.cat]++;
  }

  for (let i = 0; i < neededSlots.length; i++) {
    const slot = neededSlots[i];
    const pool = pickNationalityPool(clubSeed.country, rng);

    let fullName = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      const f = pool.first[Math.floor(rng() * pool.first.length)];
      const l = pool.last[Math.floor(rng() * pool.last.length)];
      const candidateName = `${f} ${l}`;
      if (!existingNames.has(candidateName.toLowerCase())) {
        fullName = candidateName;
        existingNames.add(candidateName.toLowerCase());
        break;
      }
    }
    if (!fullName) {
      fullName = `${pool.first[i % pool.first.length]} ${pool.last[(i * 7 + 3) % pool.last.length]}`;
    }

    const age = slot.ageMin + Math.floor(rng() * (slot.ageMax - slot.ageMin + 1));
    const spread = Math.round((rng() - 0.5) * 14);
    const ca = clamp(clubMeanCa + slot.caOffset + spread, 52, 162);
    const upside = age <= 20 ? 16 + Math.floor(rng() * 24) : age <= 23 ? 6 + Math.floor(rng() * 14) : Math.floor(rng() * 5);
    const pa = clamp(ca + upside, ca, 182);

    const preId = `${clubSeed.id}-${slugify(fullName)}`;
    const seed: RealPlayerSeed = {
      id: preId,
      name: fullName,
      clubId: clubSeed.id,
      nationality: pool.country,
      nationalityCode: pool.code,
      age,
      positions: slot.positions,
      currentAbility: ca,
      potentialAbility: pa,
      isWonderkid: age <= 20 && pa >= 165,
    };

    generated.push(buildPlayerFromSeed(seed, league.reputation, clubSeed.name, usedIds, preId));
  }

  return generated;
}

/* ============================================================================
 * SQUAD NUMBERING, SQUAD STATUS & WAGE NORMALIZATION
 * ============================================================================ */

const PREFERRED_NUMBERS_BY_POS: Record<PositionCategory, number[]> = {
  GK: [1, 13, 23, 25, 30, 31, 33, 40],
  DEF: [2, 3, 4, 5, 6, 12, 14, 15, 16, 22, 24, 26, 28, 29, 32, 34, 35],
  MID: [4, 6, 7, 8, 10, 11, 14, 16, 17, 18, 19, 20, 21, 22, 24, 27, 28, 36, 37],
  FWD: [9, 7, 10, 11, 17, 18, 19, 20, 21, 27, 29, 38, 39, 45, 77, 99],
};

function finalizeClubSquad(clubSeed: ClubSeed, squad: Player[]): number {
  // Sort by CA descending to assign squad statuses & primary kit numbers cleanly
  const ranked = [...squad].sort((a, b) => b.currentAbility - a.currentAbility);
  const usedNumbers = new Set<number>();

  // Reserve explicitly seeded squad numbers first (resolving rare collisions)
  for (const p of ranked) {
    if (p.squadNumber && p.squadNumber >= 1 && p.squadNumber <= 99 && !usedNumbers.has(p.squadNumber)) {
      usedNumbers.add(p.squadNumber);
    } else {
      p.squadNumber = undefined;
    }
  }

  // Assign status & missing squad numbers
  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i];
    if (i < 3) {
      p.squadStatus = 'Indispensable';
    } else if (i < 11) {
      p.squadStatus = 'Important First Team';
    } else if (i < 17) {
      p.squadStatus = 'Squad Rotation';
    } else if (p.age <= 20) {
      p.squadStatus = 'Hot Prospect';
    } else {
      p.squadStatus = 'Backup';
    }

    if (!p.squadNumber) {
      const cat = getPositionCategory(p.positions[0] ?? 'MC');
      const prefs = PREFERRED_NUMBERS_BY_POS[cat];
      let assigned = 0;
      for (const n of prefs) {
        if (!usedNumbers.has(n)) {
          assigned = n;
          break;
        }
      }
      if (!assigned) {
        for (let n = 1; n <= 99; n++) {
          if (!usedNumbers.has(n)) {
            assigned = n;
            break;
          }
        }
      }
      p.squadNumber = assigned || i + 1;
      usedNumbers.add(p.squadNumber);
    }
  }

  // Compute total weekly wages; gently scale filler wages if squad exceeds 94% of club budget
  let totalWages = squad.reduce((sum, p) => sum + p.wage, 0);
  const softCap = clubSeed.wageBudgetWeekly * 0.92;
  if (totalWages > softCap && totalWages > 0) {
    const scale = softCap / totalWages;
    totalWages = 0;
    for (const p of squad) {
      p.wage = Math.max(250, Math.round((p.wage * scale) / 50) * 50);
      totalWages += p.wage;
    }
  }

  return totalWages;
}

/* ============================================================================
 * CLUB BUILDER
 * ============================================================================ */

function deriveTicketPrice(league: League, reputation: number): number {
  const baseByCountry: Record<string, number> = {
    England: league.tier === 1 ? 64 : 36,
    Spain: league.tier === 1 ? 46 : 24,
    Italy: league.tier === 1 ? 40 : 20,
    Germany: league.tier === 1 ? 38 : 24,
    France: 36,
    Netherlands: 32,
    Portugal: 26,
    Scotland: 32,
    Belgium: 28,
    Austria: 26,
    Turkey: 24,
    Croatia: 14,
    Slovenia: league.tier === 1 ? 12 : 7,
  };
  const base = baseByCountry[league.country] ?? 22;
  const repBoost = Math.round(((reputation - 5000) / 5000) * 10);
  return clamp(base + repBoost, 5, 95);
}

const CACHED_FORMATION_GRIDS: Partial<Record<FormationId, WibWobGrid>> = {};

function getFormationWibWobGrid(formation: FormationId, slots: TacticalSlot[]): WibWobGrid {
  let cached = CACHED_FORMATION_GRIDS[formation];
  if (!cached) {
    cached = createDefaultWibWobGrid(slots);
    CACHED_FORMATION_GRIDS[formation] = cached;
  }
  return {
    withBall: { ...cached.withBall },
    withoutBall: { ...cached.withoutBall },
  };
}

function fastInitialTactics(formation: FormationId, squad: Player[]): TacticsState {
  const template = FORMATIONS[formation] ?? FORMATIONS['4-4-2'];
  const slots: TacticalSlot[] = template.slots.map((slot, idx) => ({
    slotIndex: idx,
    playerId: null,
    roleLabel: slot.roleLabel,
    baseX: slot.baseX,
    baseY: slot.baseY,
    runArrow: slot.defaultArrow,
  }));

  const wibWobGrid = getFormationWibWobGrid(formation, slots);

  if (squad.length === 0) {
    return {
      formation,
      startingXI: slots,
      bench: [],
      wibWobGrid,
      instructions: {
        mentality: 'Normal',
        passing: 'Mixed',
        tackling: 'Normal',
        pressing: false,
        offsideTrap: false,
        counterAttack: false,
        menBehindBall: false,
      },
      captainId: null,
      penaltyTakerId: null,
      setPieceTakerId: null,
    };
  }

  // Ultra-fast O(11 * N) natural-position-first starter selection for ~310 clubs
  const used = new Set<string>();
  const starters: Player[] = [];
  for (let i = 0; i < slots.length; i++) {
    const role = slots[i].roleLabel;
    const roleCat = getPositionCategory(role);
    let best: Player | null = null;
    let bestScore = -1e9;

    for (let j = 0; j < squad.length; j++) {
      const p = squad[j];
      if (used.has(p.id)) continue;
      const primary = p.positions[0];
      let fit = 0;
      if (primary === role) fit = 44;
      else if (p.positions.includes(role)) fit = 36;
      else if (role === 'GK' || primary === 'GK') fit = -80;
      else if (getPositionCategory(primary) === roleCat) fit = 20;
      else fit = 4;

      const score = fit + p.currentAbility * 0.48 + p.condition * 0.08 - (p.injury ? 50 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (best) {
      slots[i].playerId = best.id;
      used.add(best.id);
      starters.push(best);
    }
  }

  // Balanced 7-man bench: 1 GK, 2 DEF, 2 MID, 2 FWD
  const remaining = squad
    .filter((p) => !used.has(p.id))
    .sort((a, b) => b.currentAbility - a.currentAbility);
  const bench: string[] = [];
  const benchUsed = new Set<string>();
  const quotas: Array<[PositionCategory, number]> = [
    ['GK', 1],
    ['DEF', 2],
    ['MID', 2],
    ['FWD', 2],
  ];
  for (const [cat, quota] of quotas) {
    let picked = 0;
    for (let j = 0; j < remaining.length && picked < quota && bench.length < 7; j++) {
      const p = remaining[j];
      if (benchUsed.has(p.id)) continue;
      if (getPositionCategory(p.positions[0] ?? 'MC') === cat) {
        bench.push(p.id);
        benchUsed.add(p.id);
        picked++;
      }
    }
  }
  for (let j = 0; j < remaining.length && bench.length < 7; j++) {
    const p = remaining[j];
    if (!benchUsed.has(p.id)) {
      bench.push(p.id);
      benchUsed.add(p.id);
    }
  }

  // Specialists
  let captainId: string | null = starters[0]?.id ?? null;
  let captainScore = -1;
  let penaltyTakerId: string | null = starters[0]?.id ?? null;
  let penScore = -1;
  let setPieceTakerId: string | null = starters[0]?.id ?? null;
  let setScore = -1;
  for (const p of starters) {
    const cScore = p.attributes.mental.influence * 2.4 + p.attributes.mental.determination * 1.4 + Math.min(p.age, 33) * 0.3;
    if (cScore > captainScore) {
      captainScore = cScore;
      captainId = p.id;
    }
    if (p.positions[0] === 'GK') continue;
    const pScore = p.attributes.technical.penalties * 2.8 + p.attributes.technical.finishing;
    if (pScore > penScore) {
      penScore = pScore;
      penaltyTakerId = p.id;
    }
    const sScore = p.attributes.technical.setPieces * 2.8 + p.attributes.technical.crossing;
    if (sScore > setScore) {
      setScore = sScore;
      setPieceTakerId = p.id;
    }
  }

  return {
    formation,
    startingXI: slots,
    bench,
    wibWobGrid,
    instructions: {
      mentality: 'Normal',
      passing: 'Mixed',
      tackling: 'Normal',
      pressing: false,
      offsideTrap: false,
      counterAttack: false,
      menBehindBall: false,
    },
    captainId,
    penaltyTakerId,
    setPieceTakerId,
  };
}

function buildClubObject(
  seed: ClubSeed,
  league: League,
  squad: Player[],
  currentWeeklyWages: number,
  override?: HydratedClubOverride
): Club {
  const stadiumName = override?.stadiumName ?? seed.stadiumName;
  const stadiumCapacity = override?.stadiumCapacity ?? seed.stadiumCapacity;
  const managerName = override?.managerName ?? seed.managerName;
  const ticketPriceAvg = deriveTicketPrice(league, seed.reputation);

  const sponsorIncomeAnnual = Math.round(
    Math.max(120_000, seed.balance * 0.28 + (seed.reputation / 10000) * 18_000_000 * (league.reputation / 20))
  );
  const tvRevenueAnnual = Math.round(
    Math.max(80_000, Math.pow(league.reputation / 20, 3.2) * 95_000_000 * (0.65 + (seed.reputation / 10000) * 0.55))
  );

  const pitchCondition: Club['stadium']['pitchCondition'] =
    seed.reputation >= 7500 ? 'Perfect' : seed.reputation >= 5500 ? 'Good' : 'Average';

  const tactics = fastInitialTactics(seed.defaultFormation, squad);

  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    threeLetterCode: seed.threeLetterCode,
    leagueId: seed.leagueId,
    country: seed.country,
    city: seed.city,
    founded: seed.founded,
    reputation: seed.reputation,
    colors: { ...seed.colors },
    stadium: {
      name: stadiumName,
      city: seed.city,
      country: seed.country,
      capacity: stadiumCapacity,
      pitchCondition,
      wikiQuery: seed.stadiumWikiQuery ?? `${stadiumName} stadium`,
      imageUrl: override?.stadiumImageUrl,
    },
    finances: {
      balance: seed.balance,
      transferBudget: seed.transferBudget,
      wageBudgetWeekly: seed.wageBudgetWeekly,
      currentWeeklyWages,
      ticketPriceAvg,
      sponsorIncomeAnnual,
      tvRevenueAnnual,
      monthlyTransactions: [
        {
          id: `tx-init-sponsor-${seed.id}`,
          date: '2026-08-01',
          category: 'Sponsorship',
          description: 'Pre-season shirt & stadium sponsorship installment',
          amount: Math.round(sponsorIncomeAnnual / 4),
        },
      ],
    },
    boardExpectation: seed.boardExpectation,
    boardConfidence: 72,
    fanConfidence: 74,
    managerName,
    defaultFormation: seed.defaultFormation,
    tactics,
    training: createDefaultTraining(),
    rivals: seed.rivals ? [...seed.rivals] : [],
    wikiQuery: seed.wikiQuery,
    theSportsDbTeamId: override?.theSportsDbTeamId ?? seed.theSportsDbTeamId,
    badgeUrl: override?.badgeUrl,
  };
}

/* ============================================================================
 * PUBLIC MODULE EXPORTS (Matches SeedDatabaseModule contract)
 * ============================================================================ */

export const LEAGUES_META: League[] = LEAGUES_DATA.map((l) => ({
  ...l,
  clubIds: [...l.clubIds],
}));

const LEAGUES_BY_ID: Record<LeagueId, League> = Object.fromEntries(
  LEAGUES_DATA.map((l) => [l.id, l])
);

const CLUB_SEEDS_BY_ID: Record<string, ClubSeed> = Object.fromEntries(
  CLUBS_SEED.map((c) => [c.id, c])
);

/**
 * Lightweight pre-built club metadata array for club pickers / menus.
 * Full squad-populated clubs with picked starting XIs are returned by `createInitialDatabase()`.
 */
export const CLUBS_DATA: Club[] = CLUBS_SEED.map((seed) => {
  const league = LEAGUES_BY_ID[seed.leagueId] ?? LEAGUES_DATA[0];
  const override = HYDRATED_OVERRIDES.clubs?.[seed.id];
  return buildClubObject(seed, league, [], Math.round(seed.wageBudgetWeekly * 0.72), override);
});

/**
 * Assembles the complete 2026/27 GameDatabase across all 18 leagues, 310 clubs,
 * curated real players + wonderkids + free agents, hydrated overrides, and
 * nationality-authentic 23-man balanced squads for every club.
 */
export function createInitialDatabase(): GameDatabase {
  const leagues: Record<LeagueId, League> = {};
  for (const league of LEAGUES_DATA) {
    leagues[league.id] = {
      ...league,
      clubIds: [],
    };
  }

  const players: Record<string, Player> = {};
  const playersByClub: Record<string, Player[]> = {};
  for (const seed of CLUBS_SEED) {
    playersByClub[seed.id] = [];
    if (leagues[seed.leagueId]) {
      leagues[seed.leagueId].clubIds.push(seed.id);
    }
  }

  const usedPlayerIds = new Set<string>();
  const hydratedPlayersMap = HYDRATED_OVERRIDES.players ?? {};
  const consumedHydratedKeys = new Set<string>();

  // 1. Hydrate all curated real players & free agents from REAL_PLAYERS_SEED
  for (const rawSeed of REAL_PLAYERS_SEED) {
    const clubSeed = rawSeed.clubId ? CLUB_SEEDS_BY_ID[rawSeed.clubId] : undefined;
    // Safeguard: drop orphan invalid clubId cleanly to Free Agent instead of crashing
    const validClubId = clubSeed ? clubSeed.id : null;
    const league = clubSeed ? LEAGUES_BY_ID[clubSeed.leagueId] : undefined;
    const leagueRep = league?.reputation ?? 14;
    const clubName = clubSeed?.name ?? 'Free Agent';

    const lookupSlug = rawSeed.id
      ? slugify(rawSeed.id)
      : slugify(`${rawSeed.name}-${validClubId ?? 'fa'}`);
    const nameKey = slugify(rawSeed.name);
    const hydratedPatch = hydratedPlayersMap[lookupSlug] ?? hydratedPlayersMap[nameKey];
    if (hydratedPlayersMap[lookupSlug]) consumedHydratedKeys.add(lookupSlug);
    if (hydratedPlayersMap[nameKey]) consumedHydratedKeys.add(nameKey);

    const mergedSeed: RealPlayerSeed & { imageUrl?: string } = {
      ...rawSeed,
      ...(hydratedPatch ?? {}),
      clubId: validClubId,
      positions: hydratedPatch?.positions ?? rawSeed.positions,
      attributeOverrides: {
        technical: {
          ...rawSeed.attributeOverrides?.technical,
          ...hydratedPatch?.attributeOverrides?.technical,
        },
        mental: {
          ...rawSeed.attributeOverrides?.mental,
          ...hydratedPatch?.attributeOverrides?.mental,
        },
        physical: {
          ...rawSeed.attributeOverrides?.physical,
          ...hydratedPatch?.attributeOverrides?.physical,
        },
        goalkeeping:
          rawSeed.attributeOverrides?.goalkeeping || hydratedPatch?.attributeOverrides?.goalkeeping
            ? {
                ...rawSeed.attributeOverrides?.goalkeeping,
                ...hydratedPatch?.attributeOverrides?.goalkeeping,
              }
            : undefined,
      },
    };

    const player = buildPlayerFromSeed(mergedSeed, leagueRep, clubName, usedPlayerIds);
    players[player.id] = player;
    if (player.clubId && playersByClub[player.clubId]) {
      playersByClub[player.clubId].push(player);
    }
  }

  // 2. Add any additional players introduced purely via scripts/hydrate_db.js overrides
  for (const [overrideKey, hPlayer] of Object.entries(hydratedPlayersMap)) {
    if (consumedHydratedKeys.has(overrideKey)) continue;
    if (!hPlayer.name || !hPlayer.positions || hPlayer.positions.length === 0) continue;

    const clubSeed = hPlayer.clubId ? CLUB_SEEDS_BY_ID[hPlayer.clubId] : undefined;
    const validClubId = clubSeed ? clubSeed.id : null;
    const league = clubSeed ? LEAGUES_BY_ID[clubSeed.leagueId] : undefined;

    // Skip if same player name already exists at that club
    if (
      validClubId &&
      playersByClub[validClubId].some((p) => p.name.toLowerCase() === hPlayer.name!.toLowerCase())
    ) {
      continue;
    }

    const fullSeed: RealPlayerSeed & { imageUrl?: string } = {
      id: hPlayer.id ?? overrideKey,
      name: hPlayer.name,
      shortName: hPlayer.shortName,
      clubId: validClubId,
      nationality: hPlayer.nationality ?? clubSeed?.country ?? 'England',
      nationalityCode: hPlayer.nationalityCode ?? league?.countryCode ?? 'ENG',
      age: hPlayer.age ?? 23,
      dateOfBirth: hPlayer.dateOfBirth,
      positions: hPlayer.positions,
      preferredFoot: hPlayer.preferredFoot,
      heightCm: hPlayer.heightCm,
      weightKg: hPlayer.weightKg,
      squadNumber: hPlayer.squadNumber,
      currentAbility: hPlayer.currentAbility ?? 115,
      potentialAbility: hPlayer.potentialAbility,
      isWonderkid: hPlayer.isWonderkid,
      reputation: hPlayer.reputation,
      value: hPlayer.value,
      wage: hPlayer.wage,
      contractExpires: hPlayer.contractExpires,
      wikiQuery: hPlayer.wikiQuery,
      attributeOverrides: hPlayer.attributeOverrides,
      imageUrl: hPlayer.imageUrl,
    };

    const player = buildPlayerFromSeed(
      fullSeed,
      league?.reputation ?? 14,
      clubSeed?.name ?? 'Free Agent',
      usedPlayerIds
    );
    players[player.id] = player;
    if (player.clubId && playersByClub[player.clubId]) {
      playersByClub[player.clubId].push(player);
    }
  }

  // 3. Fill remaining squad slots deterministically for all 310 clubs & build Club objects
  const clubs: Record<string, Club> = {};
  for (const clubSeed of CLUBS_SEED) {
    const league = leagues[clubSeed.leagueId] ?? LEAGUES_DATA[0];
    const squad = playersByClub[clubSeed.id];

    const fillers = generateClubFillerPlayers(clubSeed, league, squad, usedPlayerIds);
    for (const f of fillers) {
      players[f.id] = f;
      squad.push(f);
    }

    const weeklyWages = finalizeClubSquad(clubSeed, squad);
    const clubOverride = HYDRATED_OVERRIDES.clubs?.[clubSeed.id];
    clubs[clubSeed.id] = buildClubObject(clubSeed, league, squad, weeklyWages, clubOverride);
  }

  return {
    seasonLabel: '2026/27',
    leagues,
    clubs,
    players,
  };
}

// Compile-time contract verification
export const _seedDatabaseContract: SeedDatabaseModule = {
  LEAGUES_META,
  CLUBS_DATA,
  createInitialDatabase,
};
