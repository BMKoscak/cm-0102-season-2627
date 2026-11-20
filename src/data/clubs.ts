import type { ClubSeed } from '../types/contracts';
import type { FormationId, LeagueId } from '../types/game';

/**
 * Compact tuple input for defining all 310 real 2026/27 clubs cleanly and deterministically.
 */
type ClubRow = [
  id: string,
  name: string,
  shortName: string,
  code: string,
  city: string,
  founded: number,
  reputation: number,
  primary: string,
  secondary: string,
  text: string,
  stadiumName: string,
  stadiumCapacity: number,
  stadiumWikiQuery: string,
  balanceM: number, // EUR millions
  transferM: number, // EUR millions
  wageWeeklyK: number, // EUR thousands per week
  boardExpectation: string,
  managerName: string,
  formation: FormationId,
  rivals?: string[],
  wikiQuery?: string,
];

function buildLeagueClubs(leagueId: LeagueId, country: string, rows: ClubRow[]): ClubSeed[] {
  return rows.map(
    ([
      id,
      name,
      shortName,
      threeLetterCode,
      city,
      founded,
      reputation,
      primary,
      secondary,
      text,
      stadiumName,
      stadiumCapacity,
      stadiumWikiQuery,
      balanceM,
      transferM,
      wageWeeklyK,
      boardExpectation,
      managerName,
      defaultFormation,
      rivals,
      wikiQuery,
    ]) => ({
      id,
      name,
      shortName,
      threeLetterCode,
      leagueId,
      country,
      city,
      founded,
      reputation,
      colors: { primary, secondary, text },
      stadiumName,
      stadiumCapacity,
      stadiumWikiQuery,
      balance: Math.round(balanceM * 1_000_000),
      transferBudget: Math.round(transferM * 1_000_000),
      wageBudgetWeekly: Math.round(wageWeeklyK * 1_000),
      boardExpectation,
      managerName,
      defaultFormation,
      rivals: rivals ?? [],
      wikiQuery: wikiQuery ?? `${name} F.C.`,
    })
  );
}

// ============================================================================
// 1. ENGLAND — PREMIER LEAGUE (20 clubs)
// ============================================================================
const PREMIER_LEAGUE_CLUBS = buildLeagueClubs('premier-league', 'England', [
  ['arsenal', 'Arsenal', 'Arsenal', 'ARS', 'London', 1886, 9450, '#EF0107', '#FFFFFF', '#FFFFFF', 'Emirates Stadium', 60704, 'Emirates Stadium', 240, 125, 3800, 'Win the Premier League title', 'Mikel Arteta', '4-3-3', ['tottenham', 'chelsea', 'manchester-city'], 'Arsenal F.C.'],
  ['manchester-city', 'Manchester City', 'Man City', 'MCI', 'Manchester', 1880, 9600, '#6CABDD', '#FFFFFF', '#0D1B2A', 'Etihad Stadium', 53400, 'City of Manchester Stadium', 310, 155, 4400, 'Win the Premier League title', 'Pep Guardiola', '4-2-3-1', ['manchester-united', 'liverpool', 'arsenal'], 'Manchester City F.C.'],
  ['liverpool', 'Liverpool', 'Liverpool', 'LIV', 'Liverpool', 1892, 9500, '#C8102E', '#FFFFFF', '#FFFFFF', 'Anfield', 61276, 'Anfield', 265, 130, 3950, 'Win the Premier League title', 'Arne Slot', '4-2-3-1', ['everton', 'manchester-united', 'manchester-city'], 'Liverpool F.C.'],
  ['chelsea', 'Chelsea', 'Chelsea', 'CHE', 'London', 1905, 8950, '#034694', '#FFFFFF', '#FFFFFF', 'Stamford Bridge', 40341, 'Stamford Bridge (stadium)', 210, 115, 3600, 'Qualify for Champions League', 'Enzo Maresca', '4-2-3-1', ['arsenal', 'tottenham', 'fulham'], 'Chelsea F.C.'],
  ['manchester-united', 'Manchester United', 'Man Utd', 'MUN', 'Manchester', 1878, 9100, '#DA291C', '#FFFFFF', '#FFFFFF', 'Old Trafford', 74310, 'Old Trafford', 225, 110, 3850, 'Qualify for Champions League', 'Ruben Amorim', '3-5-2', ['manchester-city', 'liverpool', 'leeds-united'], 'Manchester United F.C.'],
  ['tottenham', 'Tottenham Hotspur', 'Tottenham', 'TOT', 'London', 1882, 8700, '#132257', '#FFFFFF', '#FFFFFF', 'Tottenham Hotspur Stadium', 62850, 'Tottenham Hotspur Stadium', 200, 95, 2900, 'Qualify for Champions League', 'Thomas Frank', '4-2-3-1', ['arsenal', 'chelsea', 'west-ham'], 'Tottenham Hotspur F.C.'],
  ['newcastle-united', 'Newcastle United', 'Newcastle', 'NEW', 'Newcastle upon Tyne', 1892, 8600, '#241F20', '#FFFFFF', '#FFFFFF', "St James' Park", 52305, "St James' Park", 215, 105, 2750, 'Qualify for Champions League', 'Eddie Howe', '4-3-3', ['sunderland', 'middlesbrough'], 'Newcastle United F.C.'],
  ['aston-villa', 'Aston Villa', 'Aston Villa', 'AVL', 'Birmingham', 1874, 8550, '#670E36', '#95BFE5', '#FFFFFF', 'Villa Park', 42657, 'Villa Park', 170, 85, 2600, 'Qualify for European football', 'Unai Emery', '4-2-3-1', ['birmingham-city', 'wolves', 'west-brom'], 'Aston Villa F.C.'],
  ['brighton', 'Brighton & Hove Albion', 'Brighton', 'BHA', 'Brighton', 1901, 8050, '#0057B8', '#FFFFFF', '#FFFFFF', 'Amex Stadium', 31876, 'Falmer Stadium', 145, 65, 1850, 'Finish in the top half', 'Fabian Hurzeler', '4-2-3-1', ['crystal-palace'], 'Brighton & Hove Albion F.C.'],
  ['west-ham', 'West Ham United', 'West Ham', 'WHU', 'London', 1895, 7950, '#7A263A', '#1BB1E7', '#FFFFFF', 'London Stadium', 62500, 'London Stadium', 135, 60, 2100, 'Finish in the top half', 'Graham Potter', '4-2-3-1', ['millwall', 'tottenham', 'chelsea'], 'West Ham United F.C.'],
  ['crystal-palace', 'Crystal Palace', 'C. Palace', 'CRY', 'London', 1905, 7850, '#1B458F', '#C4122E', '#FFFFFF', 'Selhurst Park', 25486, 'Selhurst Park', 115, 55, 1750, 'Finish comfortably in mid-table', 'Oliver Glasner', '3-5-2', ['brighton', 'millwall', 'charlton-athletic'], 'Crystal Palace F.C.'],
  ['nottingham-forest', 'Nottingham Forest', 'Nottm Forest', 'NFO', 'Nottingham', 1865, 8150, '#DD0000', '#FFFFFF', '#FFFFFF', 'City Ground', 30404, 'City Ground', 140, 68, 1950, 'Challenge for European places', 'Nuno Espirito Santo', '4-2-3-1', ['derby-county', 'leicester-city'], 'Nottingham Forest F.C.'],
  ['bournemouth', 'AFC Bournemouth', 'Bournemouth', 'BOU', 'Bournemouth', 1899, 7850, '#DA291C', '#000000', '#FFFFFF', 'Vitality Stadium', 11307, 'Dean Court', 110, 52, 1650, 'Finish in the top half', 'Andoni Iraola', '4-2-3-1', ['southampton', 'portsmouth'], 'AFC Bournemouth'],
  ['fulham', 'Fulham', 'Fulham', 'FUL', 'London', 1879, 7800, '#FFFFFF', '#000000', '#111111', 'Craven Cottage', 24500, 'Craven Cottage', 120, 55, 1800, 'Finish in the top half', 'Marco Silva', '4-2-3-1', ['chelsea', 'brentford', 'qpr'], 'Fulham F.C.'],
  ['brentford', 'Brentford', 'Brentford', 'BRE', 'London', 1889, 7700, '#E30613', '#FFFFFF', '#FFFFFF', 'Gtech Community Stadium', 17250, 'Brentford Community Stadium', 108, 48, 1500, 'Achieve a mid-table finish', 'Keith Andrews', '4-3-3', ['fulham', 'qpr'], 'Brentford F.C.'],
  ['everton', 'Everton', 'Everton', 'EVE', 'Liverpool', 1878, 7750, '#003399', '#FFFFFF', '#FFFFFF', 'Hill Dickinson Stadium', 52888, 'Everton Stadium', 125, 55, 1900, 'Achieve a mid-table finish', 'David Moyes', '4-2-3-1', ['liverpool'], 'Everton F.C.'],
  ['wolves', 'Wolverhampton Wanderers', 'Wolves', 'WOL', 'Wolverhampton', 1877, 7600, '#FDB913', '#231F20', '#111111', 'Molineux Stadium', 31750, 'Molineux Stadium', 105, 48, 1650, 'Avoid relegation comfortably', 'Vitor Pereira', '3-5-2', ['west-brom', 'aston-villa', 'birmingham-city'], 'Wolverhampton Wanderers F.C.'],
  ['leeds-united', 'Leeds United', 'Leeds Utd', 'LEE', 'Leeds', 1919, 7550, '#FFFFFF', '#1D428A', '#1D428A', 'Elland Road', 37608, 'Elland Road', 100, 50, 1450, 'Avoid relegation', 'Daniel Farke', '4-2-3-1', ['manchester-united', 'sheffield-united', 'sheffield-wednesday'], 'Leeds United F.C.'],
  ['burnley', 'Burnley', 'Burnley', 'BUR', 'Burnley', 1882, 7250, '#6C1D45', '#99D6EA', '#FFFFFF', 'Turf Moor', 21944, 'Turf Moor', 85, 38, 1200, 'Avoid relegation', 'Scott Parker', '4-2-3-1', ['blackburn-rovers', 'preston-north-end'], 'Burnley F.C.'],
  ['sunderland', 'Sunderland', 'Sunderland', 'SUN', 'Sunderland', 1879, 7300, '#EB172B', '#FFFFFF', '#FFFFFF', 'Stadium of Light', 49000, 'Stadium of Light', 90, 42, 1250, 'Avoid relegation', 'Regis Le Bris', '4-3-3', ['newcastle-united', 'middlesbrough'], 'Sunderland A.F.C.'],
]);

// ============================================================================
// 2. ENGLAND — EFL CHAMPIONSHIP (24 clubs)
// ============================================================================
const EFL_CHAMPIONSHIP_CLUBS = buildLeagueClubs('efl-championship', 'England', [
  ['leicester-city', 'Leicester City', 'Leicester', 'LEI', 'Leicester', 1884, 7100, '#003090', '#FDBE11', '#FFFFFF', 'King Power Stadium', 32262, 'King Power Stadium', 55, 22, 950, 'Win automatic promotion', 'Ruud van Nistelrooy', '4-2-3-1', ['nottingham-forest', 'coventry-city', 'derby-county'], 'Leicester City F.C.'],
  ['ipswich-town', 'Ipswich Town', 'Ipswich', 'IPS', 'Ipswich', 1878, 7000, '#0044A9', '#FFFFFF', '#FFFFFF', 'Portman Road', 30017, 'Portman Road', 52, 24, 880, 'Win automatic promotion', 'Kieran McKenna', '4-2-3-1', ['norwich-city'], 'Ipswich Town F.C.'],
  ['southampton', 'Southampton', 'Southampton', 'SOU', 'Southampton', 1885, 6950, '#D71920', '#FFFFFF', '#FFFFFF', "St Mary's Stadium", 32384, "St Mary's Stadium", 50, 20, 900, 'Win automatic promotion', 'Will Still', '4-2-3-1', ['portsmouth', 'bournemouth'], 'Southampton F.C.'],
  ['sheffield-united', 'Sheffield United', 'Sheff Utd', 'SHU', 'Sheffield', 1889, 6900, '#EE2737', '#FFFFFF', '#FFFFFF', 'Bramall Lane', 32050, 'Bramall Lane', 42, 16, 780, 'Push for automatic promotion', 'Chris Wilder', '4-2-3-1', ['sheffield-wednesday', 'leeds-united'], 'Sheffield United F.C.'],
  ['coventry-city', 'Coventry City', 'Coventry', 'COV', 'Coventry', 1883, 6650, '#58B9E6', '#FFFFFF', '#0D1B2A', 'Coventry Building Society Arena', 32609, 'Coventry Building Society Arena', 32, 12, 580, 'Reach the promotion playoffs', 'Frank Lampard', '4-2-3-1', ['leicester-city', 'aston-villa', 'birmingham-city'], 'Coventry City F.C.'],
  ['middlesbrough', 'Middlesbrough', 'Middlesbro', 'MID', 'Middlesbrough', 1876, 6600, '#E11B22', '#FFFFFF', '#FFFFFF', 'Riverside Stadium', 34742, 'Riverside Stadium', 30, 12, 600, 'Reach the promotion playoffs', 'Michael Carrick', '4-2-3-1', ['sunderland', 'newcastle-united'], 'Middlesbrough F.C.'],
  ['west-brom', 'West Bromwich Albion', 'West Brom', 'WBA', 'West Bromwich', 1878, 6550, '#122F67', '#FFFFFF', '#FFFFFF', 'The Hawthorns', 26850, 'The Hawthorns', 28, 10, 620, 'Reach the promotion playoffs', 'Ryan Mason', '4-2-3-1', ['wolves', 'aston-villa', 'birmingham-city'], 'West Bromwich Albion F.C.'],
  ['norwich-city', 'Norwich City', 'Norwich', 'NOR', 'Norwich', 1902, 6500, '#FFF200', '#00A650', '#00572A', 'Carrow Road', 27359, 'Carrow Road', 29, 11, 590, 'Reach the promotion playoffs', 'Liam Manning', '4-3-3', ['ipswich-town'], 'Norwich City F.C.'],
  ['bristol-city', 'Bristol City', 'Bristol C', 'BRC', 'Bristol', 1894, 6350, '#E21A23', '#FFFFFF', '#FFFFFF', 'Ashton Gate', 27000, 'Ashton Gate Stadium', 24, 9, 490, 'Challenge for the playoffs', 'Gerhard Struber', '4-2-3-1', ['swansea-city'], 'Bristol City F.C.'],
  ['blackburn-rovers', 'Blackburn Rovers', 'Blackburn', 'BLB', 'Blackburn', 1875, 6300, '#009EE0', '#FFFFFF', '#FFFFFF', 'Ewood Park', 31367, 'Ewood Park', 22, 8, 470, 'Finish in the top half', 'Valerien Ismael', '4-2-3-1', ['burnley', 'preston-north-end'], 'Blackburn Rovers F.C.'],
  ['millwall', 'Millwall', 'Millwall', 'MIL', 'London', 1885, 6200, '#00194A', '#FFFFFF', '#FFFFFF', 'The Den', 20146, 'The Den', 20, 7, 440, 'Finish in the top half', 'Alex Neil', '4-4-2', ['west-ham', 'crystal-palace', 'charlton-athletic'], 'Millwall F.C.'],
  ['watford', 'Watford', 'Watford', 'WAT', 'Watford', 1881, 6350, '#FBEE23', '#ED2127', '#111111', 'Vicarage Road', 22200, 'Vicarage Road', 26, 9, 540, 'Challenge for the playoffs', 'Paulo Pezzolano', '4-2-3-1', ['qpr'], 'Watford F.C.'],
  ['sheffield-wednesday', 'Sheffield Wednesday', 'Sheff Wed', 'SHW', 'Sheffield', 1867, 6250, '#0066B3', '#FFFFFF', '#FFFFFF', 'Hillsborough Stadium', 39732, 'Hillsborough Stadium', 22, 7, 480, 'Finish in the top half', 'Danny Rohl', '4-2-3-1', ['sheffield-united', 'leeds-united'], 'Sheffield Wednesday F.C.'],
  ['qpr', 'Queens Park Rangers', 'QPR', 'QPR', 'London', 1882, 6150, '#1D5BA4', '#FFFFFF', '#FFFFFF', 'Loftus Road', 18439, 'Loftus Road', 19, 6, 450, 'Consolidate mid-table status', 'Marti Cifuentes', '4-2-3-1', ['fulham', 'brentford', 'chelsea'], 'Queens Park Rangers F.C.'],
  ['swansea-city', 'Swansea City', 'Swansea', 'SWA', 'Swansea', 1912, 6150, '#FFFFFF', '#121212', '#121212', 'Swansea.com Stadium', 21088, 'Swansea.com Stadium', 20, 7, 460, 'Consolidate mid-table status', 'Alan Sheehan', '4-3-3', ['bristol-city', 'wrexham'], 'Swansea City A.F.C.'],
  ['stoke-city', 'Stoke City', 'Stoke', 'STK', 'Stoke-on-Trent', 1863, 6200, '#E03A3E', '#FFFFFF', '#FFFFFF', 'bet365 Stadium', 30089, 'Bet365 Stadium', 24, 9, 520, 'Finish in the top half', 'Mark Robins', '4-2-3-1', ['west-brom', 'derby-county'], 'Stoke City F.C.'],
  ['preston-north-end', 'Preston North End', 'Preston', 'PNE', 'Preston', 1880, 6050, '#FFFFFF', '#00285E', '#00285E', 'Deepdale', 23404, 'Deepdale', 17, 5, 410, 'Consolidate mid-table status', 'Paul Heckingbottom', '3-5-2', ['blackburn-rovers', 'burnley'], 'Preston North End F.C.'],
  ['hull-city', 'Hull City', 'Hull City', 'HUL', 'Kingston upon Hull', 1904, 6100, '#F5A12D', '#000000', '#111111', 'MKM Stadium', 25586, 'MKM Stadium', 21, 8, 460, 'Consolidate mid-table status', 'Sergej Jakirovic', '4-2-3-1', ['leeds-united', 'sheffield-wednesday'], 'Hull City A.F.C.'],
  ['derby-county', 'Derby County', 'Derby', 'DER', 'Derby', 1884, 6100, '#FFFFFF', '#111111', '#111111', 'Pride Park Stadium', 33597, 'Pride Park Stadium', 19, 6, 430, 'Consolidate mid-table status', 'John Eustace', '4-2-3-1', ['nottingham-forest', 'leicester-city'], 'Derby County F.C.'],
  ['portsmouth', 'Portsmouth', 'Portsmouth', 'POR', 'Portsmouth', 1898, 6000, '#001489', '#FFFFFF', '#FFFFFF', 'Fratton Park', 20899, 'Fratton Park', 18, 6, 400, 'Avoid relegation comfortably', 'John Mousinho', '4-2-3-1', ['southampton', 'bournemouth'], 'Portsmouth F.C.'],
  ['birmingham-city', 'Birmingham City', 'Birmingham', 'BIR', 'Birmingham', 1875, 6400, '#0000FF', '#FFFFFF', '#FFFFFF', "St Andrew's", 29409, "St Andrew's (stadium)", 38, 16, 620, 'Challenge for the playoffs', 'Chris Davies', '4-2-3-1', ['aston-villa', 'west-brom', 'coventry-city'], 'Birmingham City F.C.'],
  ['wrexham', 'Wrexham', 'Wrexham', 'WRX', 'Wrexham', 1864, 6150, '#E4002B', '#FFFFFF', '#FFFFFF', 'Racecourse Ground', 13341, 'Racecourse Ground', 34, 14, 520, 'Finish in the top half', 'Phil Parkinson', '3-5-2', ['swansea-city'], 'Wrexham A.F.C.'],
  ['charlton-athletic', 'Charlton Athletic', 'Charlton', 'CHA', 'London', 1905, 5850, '#D4021D', '#FFFFFF', '#FFFFFF', 'The Valley', 27111, 'The Valley (London)', 16, 5, 360, 'Avoid relegation', 'Nathan Jones', '3-5-2', ['millwall', 'crystal-palace'], 'Charlton Athletic F.C.'],
  ['oxford-united', 'Oxford United', 'Oxford Utd', 'OXF', 'Oxford', 1893, 5800, '#F5D000', '#002B5C', '#002B5C', 'Kassam Stadium', 12500, 'Kassam Stadium', 15, 4.5, 340, 'Avoid relegation', 'Gary Rowett', '4-2-3-1', ['swansea-city'], 'Oxford United F.C.'],
]);

// ============================================================================
// 3. SPAIN — LA LIGA (20 clubs)
// ============================================================================
const LA_LIGA_CLUBS = buildLeagueClubs('la-liga', 'Spain', [
  ['real-madrid', 'Real Madrid', 'Real Madrid', 'RMA', 'Madrid', 1902, 9850, '#FFFFFF', '#FEBE10', '#0F172A', 'Santiago Bernabeu', 81044, 'Santiago Bernabéu Stadium', 340, 160, 4800, 'Win La Liga and compete for everything', 'Xabi Alonso', '4-3-3', ['barcelona', 'atletico-madrid'], 'Real Madrid CF'],
  ['barcelona', 'FC Barcelona', 'Barcelona', 'BAR', 'Barcelona', 1899, 9650, '#A50044', '#004D98', '#FFFFFF', 'Spotify Camp Nou', 105000, 'Camp Nou', 235, 110, 4200, 'Win La Liga', 'Hansi Flick', '4-2-3-1', ['real-madrid', 'espanyol'], 'FC Barcelona'],
  ['atletico-madrid', 'Atletico Madrid', 'Atletico', 'ATM', 'Madrid', 1903, 9050, '#CB3524', '#FFFFFF', '#FFFFFF', 'Metropolitano Stadium', 70460, 'Metropolitano Stadium', 200, 95, 3100, 'Challenge for the La Liga title', 'Diego Simeone', '3-5-2', ['real-madrid'], 'Atlético Madrid'],
  ['athletic-club', 'Athletic Club', 'Athletic', 'ATH', 'Bilbao', 1898, 8450, '#EE2523', '#FFFFFF', '#FFFFFF', 'San Mames', 53289, 'San Mamés Stadium (2013)', 125, 52, 1650, 'Qualify for Champions League', 'Ernesto Valverde', '4-2-3-1', ['real-sociedad', 'alaves', 'osasuna'], 'Athletic Bilbao'],
  ['real-sociedad', 'Real Sociedad', 'Real Soc', 'RSO', 'San Sebastian', 1909, 8250, '#0067B1', '#FFFFFF', '#FFFFFF', 'Anoeta Stadium', 39313, 'Anoeta Stadium', 110, 48, 1500, 'Qualify for European football', 'Sergio Francisco', '4-3-3', ['athletic-club', 'osasuna'], 'Real Sociedad'],
  ['villarreal', 'Villarreal', 'Villarreal', 'VIL', 'Villarreal', 1923, 8350, '#FFE667', '#005187', '#003A63', 'Estadio de la Ceramica', 23008, 'Estadio de la Cerámica', 115, 50, 1550, 'Qualify for Champions League', 'Marcelino', '4-4-2', ['valencia', 'levante'], 'Villarreal CF'],
  ['real-betis', 'Real Betis', 'Real Betis', 'BET', 'Seville', 1907, 8200, '#00954C', '#FFFFFF', '#FFFFFF', 'Estadio Benito Villamarin', 60721, 'Estadio Benito Villamarín', 105, 45, 1480, 'Qualify for European football', 'Manuel Pellegrini', '4-2-3-1', ['sevilla'], 'Real Betis'],
  ['sevilla', 'Sevilla', 'Sevilla', 'SEV', 'Seville', 1890, 7950, '#FFFFFF', '#D4192C', '#B81020', 'Estadio Ramon Sanchez-Pizjuan', 43883, 'Ramón Sánchez-Pizjuán Stadium', 85, 35, 1450, 'Return to European football', 'Matias Almeyda', '4-2-3-1', ['real-betis'], 'Sevilla FC'],
  ['girona', 'Girona', 'Girona', 'GIR', 'Girona', 1930, 7850, '#CD2534', '#FFFFFF', '#FFFFFF', 'Estadi Montilivi', 14624, 'Estadi Montilivi', 82, 36, 1150, 'Finish in the top half', 'Michel', '4-3-3', ['barcelona', 'espanyol'], 'Girona FC'],
  ['valencia', 'Valencia', 'Valencia', 'VAL', 'Valencia', 1919, 7800, '#FFFFFF', '#FF7F00', '#111111', 'Mestalla', 49430, 'Mestalla Stadium', 78, 30, 1250, 'Finish in the top half', 'Carlos Corberan', '4-2-3-1', ['villarreal', 'levante'], 'Valencia CF'],
  ['celta-vigo', 'Celta Vigo', 'Celta', 'CEL', 'Vigo', 1923, 7650, '#8AC3EE', '#FFFFFF', '#0D2C54', 'Balaidos', 24870, 'Balaídos', 72, 28, 1080, 'Finish in the top half', 'Claudio Giraldez', '3-5-2', ['deportivo-la-coruna'], 'RC Celta de Vigo'],
  ['osasuna', 'Osasuna', 'Osasuna', 'OSA', 'Pamplona', 1920, 7550, '#D91A21', '#0A346F', '#FFFFFF', 'El Sadar', 23576, 'El Sadar Stadium', 64, 24, 950, 'Achieve a mid-table finish', 'Alessio Lisci', '4-2-3-1', ['athletic-club', 'real-sociedad', 'real-zaragoza'], 'CA Osasuna'],
  ['mallorca', 'RCD Mallorca', 'Mallorca', 'MLL', 'Palma', 1916, 7500, '#E20613', '#000000', '#FFFFFF', 'Estadi Mallorca Son Moix', 26020, 'Estadi Mallorca Son Moix', 60, 22, 920, 'Achieve a mid-table finish', 'Jagoba Arrasate', '4-4-2', ['valencia'], 'RCD Mallorca'],
  ['rayo-vallecano', 'Rayo Vallecano', 'Rayo', 'RAY', 'Madrid', 1924, 7450, '#FFFFFF', '#E53027', '#C81E17', 'Estadio de Vallecas', 14708, 'Campo de Fútbol de Vallecas', 55, 20, 880, 'Achieve a mid-table finish', 'Inigo Perez', '4-2-3-1', ['getafe', 'leganes'], 'Rayo Vallecano'],
  ['getafe', 'Getafe', 'Getafe', 'GET', 'Getafe', 1983, 7350, '#005999', '#FFFFFF', '#FFFFFF', 'Estadio Coliseum', 16500, 'Coliseum (stadium)', 52, 19, 860, 'Avoid relegation comfortably', 'Jose Bordalas', '4-4-2', ['leganes', 'rayo-vallecano'], 'Getafe CF'],
  ['alaves', 'Deportivo Alaves', 'Alaves', 'ALA', 'Vitoria-Gasteiz', 1921, 7200, '#0057B7', '#FFFFFF', '#FFFFFF', 'Mendizorrotza', 19840, 'Mendizorrotza Stadium', 46, 16, 780, 'Avoid relegation', 'Eduardo Coudet', '4-4-2', ['athletic-club', 'real-sociedad'], 'Deportivo Alavés'],
  ['espanyol', 'RCD Espanyol', 'Espanyol', 'ESP', 'Barcelona', 1900, 7250, '#007FC8', '#FFFFFF', '#FFFFFF', 'RCDE Stadium', 40000, 'RCDE Stadium', 50, 18, 820, 'Avoid relegation', 'Manolo Gonzalez', '4-4-2', ['barcelona', 'girona'], 'RCD Espanyol'],
  ['las-palmas', 'UD Las Palmas', 'Las Palmas', 'LPA', 'Las Palmas', 1949, 7100, '#FFE400', '#0055A4', '#003870', 'Estadio Gran Canaria', 32392, 'Estadio Gran Canaria', 42, 15, 740, 'Avoid relegation', 'Luis Garcia', '4-3-3', ['tenerife'], 'UD Las Palmas'],
  ['levante', 'Levante UD', 'Levante', 'LEV', 'Valencia', 1909, 6950, '#004D98', '#A50044', '#FFFFFF', 'Estadi Ciutat de Valencia', 26354, 'Estadi Ciutat de València', 38, 13, 680, 'Avoid relegation', 'Julian Calero', '4-4-2', ['valencia', 'villarreal'], 'Levante UD'],
  ['elche', 'Elche CF', 'Elche', 'ELC', 'Elche', 1923, 6900, '#FFFFFF', '#008A45', '#006B35', 'Estadio Martinez Valero', 31388, 'Estadio Martínez Valero', 36, 12, 650, 'Avoid relegation', 'Eder Sarabia', '4-3-3', ['levante'], 'Elche CF'],
]);

// ============================================================================
// 4. SPAIN — SEGUNDA DIVISION (22 clubs)
// ============================================================================
const SEGUNDA_CLUBS = buildLeagueClubs('segunda-division', 'Spain', [
  ['real-valladolid', 'Real Valladolid', 'Valladolid', 'VLL', 'Valladolid', 1928, 6400, '#5A2D82', '#FFFFFF', '#FFFFFF', 'Estadio Jose Zorrilla', 27618, 'Estadio José Zorrilla', 22, 8, 420, 'Win automatic promotion', 'Guillermo Almada', '4-3-3', ['burgos', 'mirandes'], 'Real Valladolid'],
  ['leganes', 'CD Leganes', 'Leganes', 'LEG', 'Leganes', 1928, 6350, '#00529F', '#FFFFFF', '#FFFFFF', 'Estadio Municipal de Butarque', 12454, 'Estadio Municipal de Butarque', 20, 7.5, 400, 'Win automatic promotion', 'Paco Lopez', '4-4-2', ['getafe', 'rayo-vallecano'], 'CD Leganés'],
  ['real-oviedo', 'Real Oviedo', 'Oviedo', 'OVI', 'Oviedo', 1926, 6300, '#0057B7', '#FFFFFF', '#FFFFFF', 'Estadio Carlos Tartiere', 30500, 'Estadio Carlos Tartiere', 19, 7, 380, 'Push for automatic promotion', 'Veljko Paunovic', '4-2-3-1', ['sporting-gijon'], 'Real Oviedo'],
  ['racing-santander', 'Racing de Santander', 'Racing', 'RAC', 'Santander', 1913, 6250, '#009A44', '#FFFFFF', '#FFFFFF', 'Campos de Sport de El Sardinero', 22222, 'Campos de Sport de El Sardinero', 18, 6.5, 360, 'Reach the promotion playoffs', 'Jose Alberto', '4-2-3-1', ['sporting-gijon', 'real-oviedo'], 'Racing de Santander'],
  ['almeria', 'UD Almeria', 'Almeria', 'ALM', 'Almeria', 1989, 6400, '#EE1C25', '#FFFFFF', '#FFFFFF', 'UD Almeria Stadium', 18331, 'Power Horse Stadium', 28, 11, 450, 'Win automatic promotion', 'Rubi', '4-2-3-1', ['granada', 'malaga'], 'UD Almería'],
  ['granada', 'Granada CF', 'Granada', 'GRA', 'Granada', 1931, 6300, '#C8102E', '#FFFFFF', '#FFFFFF', 'Estadio Nuevo Los Carmenes', 19336, 'Nuevo Estadio de Los Cármenes', 21, 8, 410, 'Reach the promotion playoffs', 'Pacheta', '4-4-2', ['malaga', 'almeria'], 'Granada CF'],
  ['sporting-gijon', 'Sporting de Gijon', 'Sporting', 'SPG', 'Gijon', 1905, 6200, '#D61C24', '#FFFFFF', '#FFFFFF', 'El Molinon', 29371, 'El Molinón', 18, 6, 360, 'Reach the promotion playoffs', 'Asier Garitano', '4-4-2', ['real-oviedo'], 'Sporting de Gijón'],
  ['real-zaragoza', 'Real Zaragoza', 'Zaragoza', 'ZAR', 'Zaragoza', 1932, 6200, '#FFFFFF', '#0057B7', '#004494', 'La Romareda', 33608, 'La Romareda', 19, 6.5, 370, 'Challenge for the playoffs', 'Gabi Fernandez', '4-4-2', ['huesca', 'osasuna'], 'Real Zaragoza'],
  ['deportivo-la-coruna', 'Deportivo La Coruna', 'Deportivo', 'DEP', 'A Coruna', 1906, 6150, '#0057B7', '#FFFFFF', '#FFFFFF', 'Estadio Riazor', 32660, 'Estadio Riazor', 18, 6.5, 350, 'Finish in the top half', 'Antonio Hidalgo', '4-2-3-1', ['celta-vigo', 'racing-ferrol'], 'Deportivo de La Coruña'],
  ['malaga', 'Malaga CF', 'Malaga', 'MAL', 'Malaga', 1904, 6050, '#009FE3', '#FFFFFF', '#FFFFFF', 'La Rosaleda', 30044, 'La Rosaleda Stadium', 16, 5.5, 320, 'Finish in the top half', 'Sergio Pellicer', '4-2-3-1', ['granada', 'cordoba'], 'Málaga CF'],
  ['cadiz', 'Cadiz CF', 'Cadiz', 'CAD', 'Cadiz', 1910, 6100, '#FFE400', '#0055A4', '#003870', 'Estadio Nuevo Mirandilla', 20724, 'Estadio Nuevo Mirandilla', 18, 6, 360, 'Challenge for the playoffs', 'Gaizka Garitano', '4-4-2', ['malaga', 'sevilla'], 'Cádiz CF'],
  ['eibar', 'SD Eibar', 'Eibar', 'EIB', 'Eibar', 1940, 6050, '#004D98', '#A50044', '#FFFFFF', 'Ipurua', 8164, 'Ipurua Municipal Stadium', 16, 5, 330, 'Finish in the top half', 'Benat San Jose', '4-2-3-1', ['alaves', 'real-sociedad'], 'SD Eibar'],
  ['huesca', 'SD Huesca', 'Huesca', 'HUE', 'Huesca', 1960, 5950, '#003A70', '#A6192E', '#FFFFFF', 'Estadio El Alcoraz', 9100, 'Estadio El Alcoraz', 14, 4.5, 290, 'Consolidate mid-table status', 'Sergi Guilló', '3-5-2', ['real-zaragoza'], 'SD Huesca'],
  ['mirandes', 'CD Mirandes', 'Mirandes', 'MIR', 'Miranda de Ebro', 1927, 5900, '#D91920', '#000000', '#FFFFFF', 'Estadio Municipal de Anduva', 5759, 'Estadio Municipal de Anduva', 13, 4, 270, 'Consolidate mid-table status', 'Fran Justo', '3-5-2', ['burgos'], 'CD Mirandés'],
  ['burgos', 'Burgos CF', 'Burgos', 'BUR', 'Burgos', 1985, 5850, '#FFFFFF', '#111111', '#111111', 'Estadio El Plantio', 12194, 'Estadio El Plantío', 13, 4, 280, 'Consolidate mid-table status', 'Luis Miguel Ramis', '4-4-2', ['mirandes', 'real-valladolid'], 'Burgos CF'],
  ['cordoba', 'Cordoba CF', 'Cordoba', 'COR', 'Cordoba', 1954, 5800, '#008A45', '#FFFFFF', '#FFFFFF', 'Estadio Nuevo Arcangel', 21822, 'Estadio Nuevo Arcángel', 12, 3.8, 260, 'Consolidate mid-table status', 'Ivan Ania', '4-3-3', ['malaga', 'granada'], 'Córdoba CF'],
  ['albacete', 'Albacete Balompie', 'Albacete', 'ALB', 'Albacete', 1940, 5800, '#FFFFFF', '#B22222', '#111111', 'Estadio Carlos Belmonte', 17524, 'Estadio Carlos Belmonte', 12, 3.8, 265, 'Consolidate mid-table status', 'Alberto Gonzalez', '4-4-2', ['cartagena'], 'Albacete Balompié'],
  ['castellon', 'CD Castellon', 'Castellon', 'CAS', 'Castellon', 1922, 5800, '#FFFFFF', '#111111', '#111111', 'Nou Estadi Castalia', 15500, 'Nou Estadi Castàlia', 13, 4.2, 275, 'Consolidate mid-table status', 'Johan Plat', '3-5-2', ['villarreal', 'levante'], 'CD Castellón'],
  ['tenerife', 'CD Tenerife', 'Tenerife', 'TEN', 'Santa Cruz de Tenerife', 1922, 5850, '#FFFFFF', '#0055A4', '#003870', 'Estadio Heliodoro Rodriguez Lopez', 22824, 'Estadio Heliodoro Rodríguez López', 14, 4.5, 290, 'Avoid relegation comfortably', 'Alvaro Cervera', '4-4-2', ['las-palmas'], 'CD Tenerife'],
  ['cartagena', 'FC Cartagena', 'Cartagena', 'CAR', 'Cartagena', 1995, 5600, '#FFFFFF', '#111111', '#111111', 'Estadio Cartagonova', 15105, 'Estadio Cartagonova', 10, 3, 230, 'Avoid relegation', 'Javi Rey', '4-2-3-1', ['albacete'], 'FC Cartagena'],
  ['eldense', 'CD Eldense', 'Eldense', 'ELD', 'Elda', 1921, 5550, '#004D98', '#C8102E', '#FFFFFF', 'Estadio Nuevo Pepico Amat', 5776, 'Estadio Municipal Nuevo Pepico Amat', 9.5, 2.8, 220, 'Avoid relegation', 'Jose Luis Oltra', '4-4-2', ['elche'], 'CD Eldense'],
  ['racing-ferrol', 'Racing de Ferrol', 'Ferrol', 'RFE', 'Ferrol', 1919, 5550, '#008A45', '#FFFFFF', '#FFFFFF', 'Estadio Municipal da Malata', 11922, 'Estadio Municipal da Malata', 9.5, 2.8, 220, 'Avoid relegation', 'Pablo Lopez', '4-2-3-1', ['deportivo-la-coruna'], 'Racing de Ferrol'],
]);

// ============================================================================
// 5. ITALY — SERIE A (20 clubs)
// ============================================================================
const SERIE_A_CLUBS = buildLeagueClubs('serie-a', 'Italy', [
  ['inter-milan', 'Inter Milan', 'Inter', 'INT', 'Milan', 1908, 9350, '#0068A8', '#000000', '#FFFFFF', 'San Siro', 75817, 'San Siro', 195, 85, 3100, 'Win the Scudetto', 'Cristian Chivu', '3-5-2', ['ac-milan', 'juventus'], 'Inter Milan'],
  ['ac-milan', 'AC Milan', 'AC Milan', 'ACM', 'Milan', 1899, 8950, '#FB090B', '#000000', '#FFFFFF', 'San Siro', 75817, 'San Siro', 175, 80, 2750, 'Challenge for the Scudetto', 'Massimiliano Allegri', '4-3-3', ['inter-milan', 'juventus'], 'AC Milan'],
  ['juventus', 'Juventus', 'Juventus', 'JUV', 'Turin', 1897, 9050, '#FFFFFF', '#000000', '#111111', 'Allianz Stadium', 41507, 'Juventus Stadium', 185, 85, 2950, 'Challenge for the Scudetto', 'Igor Tudor', '3-5-2', ['inter-milan', 'torino', 'ac-milan'], 'Juventus FC'],
  ['napoli', 'SSC Napoli', 'Napoli', 'NAP', 'Naples', 1926, 9100, '#0088CE', '#FFFFFF', '#FFFFFF', 'Stadio Diego Armando Maradona', 54726, 'Stadio Diego Armando Maradona', 180, 90, 2650, 'Win the Scudetto', 'Antonio Conte', '4-3-3', ['as-roma', 'juventus'], 'SSC Napoli'],
  ['atalanta', 'Atalanta', 'Atalanta', 'ATA', 'Bergamo', 1907, 8650, '#1E71B8', '#000000', '#FFFFFF', 'Gewiss Stadium', 24950, 'Stadio Atleti Azzurri d\'Italia', 150, 72, 1850, 'Qualify for Champions League', 'Ivan Juric', '3-5-2', ['brescia', 'inter-milan'], 'Atalanta BC'],
  ['as-roma', 'AS Roma', 'AS Roma', 'ROM', 'Rome', 1927, 8500, '#8E1F2F', '#F0BC42', '#FFFFFF', 'Stadio Olimpico', 70634, 'Stadio Olimpico', 135, 62, 2250, 'Qualify for Champions League', 'Gian Piero Gasperini', '3-5-2', ['lazio', 'napoli'], 'AS Roma'],
  ['lazio', 'SS Lazio', 'Lazio', 'LAZ', 'Rome', 1900, 8350, '#87D8F7', '#FFFFFF', '#0D2C54', 'Stadio Olimpico', 70634, 'Stadio Olimpico', 118, 48, 1850, 'Qualify for European football', 'Maurizio Sarri', '4-3-3', ['as-roma'], 'SS Lazio'],
  ['fiorentina', 'ACF Fiorentina', 'Fiorentina', 'FIO', 'Florence', 1926, 8200, '#4E2A84', '#FFFFFF', '#FFFFFF', 'Stadio Artemio Franchi', 43147, 'Stadio Artemio Franchi', 112, 46, 1650, 'Qualify for European football', 'Stefano Pioli', '3-5-2', ['juventus', 'bologna', 'empoli'], 'ACF Fiorentina'],
  ['bologna', 'Bologna FC', 'Bologna', 'BOL', 'Bologna', 1909, 8150, '#1A2F48', '#A21C26', '#FFFFFF', "Stadio Renato Dall'Ara", 36462, "Stadio Renato Dall'Ara", 108, 45, 1450, 'Qualify for European football', 'Vincenzo Italiano', '4-2-3-1', ['fiorentina', 'parma'], 'Bologna FC 1909'],
  ['torino', 'Torino FC', 'Torino', 'TOR', 'Turin', 1906, 7700, '#8A1E03', '#FFFFFF', '#FFFFFF', 'Stadio Olimpico Grande Torino', 28177, 'Stadio Olimpico Grande Torino', 80, 32, 1250, 'Finish in the top half', 'Marco Baroni', '4-2-3-1', ['juventus'], 'Torino FC'],
  ['udinese', 'Udinese', 'Udinese', 'UDI', 'Udine', 1896, 7550, '#FFFFFF', '#000000', '#111111', 'Bluenergy Stadium', 25132, 'Stadio Friuli', 72, 28, 1050, 'Achieve a mid-table finish', 'Kosta Runjaic', '3-5-2', ['verona', 'venezia'], 'Udinese Calcio'],
  ['genoa', 'Genoa CFC', 'Genoa', 'GEN', 'Genoa', 1893, 7500, '#A5191B', '#0A2240', '#FFFFFF', 'Stadio Luigi Ferraris', 33205, 'Stadio Luigi Ferraris', 68, 25, 1050, 'Achieve a mid-table finish', 'Patrick Vieira', '4-2-3-1', ['sampdoria'], 'Genoa CFC'],
  ['como', 'Como 1907', 'Como', 'COM', 'Como', 1907, 7650, '#0057B7', '#FFFFFF', '#FFFFFF', 'Stadio Giuseppe Sinigaglia', 13602, 'Stadio Giuseppe Sinigaglia', 115, 58, 1300, 'Finish in the top half', 'Cesc Fabregas', '4-2-3-1', ['ac-milan', 'inter-milan'], 'Como 1907'],
  ['cagliari', 'Cagliari', 'Cagliari', 'CAG', 'Cagliari', 1920, 7250, '#002350', '#A6192E', '#FFFFFF', 'Unipol Domus', 16416, 'Unipol Domus', 52, 19, 850, 'Avoid relegation', 'Fabio Pisacane', '3-5-2', ['napoli'], 'Cagliari Calcio'],
  ['parma', 'Parma Calcio', 'Parma', 'PAR', 'Parma', 1913, 7350, '#FFFFFF', '#003087', '#003087', 'Stadio Ennio Tardini', 22352, 'Stadio Ennio Tardini', 62, 24, 900, 'Avoid relegation comfortably', 'Carlos Cuesta', '4-2-3-1', ['bologna', 'reggiana'], 'Parma Calcio 1913'],
  ['verona', 'Hellas Verona', 'Verona', 'VER', 'Verona', 1903, 7200, '#002D72', '#FFCD00', '#FFCD00', "Stadio Marcantonio Bentegodi", 31713, 'Stadio Marcantonio Bentegodi', 48, 17, 820, 'Avoid relegation', 'Paolo Zanetti', '3-5-2', ['udinese', 'venezia'], 'Hellas Verona FC'],
  ['lecce', 'US Lecce', 'Lecce', 'LEC', 'Lecce', 1908, 7150, '#FFCC00', '#D4002A', '#8B0000', 'Stadio Via del mare', 31461, 'Stadio Via del mare', 46, 16, 760, 'Avoid relegation', 'Eusebio Di Francesco', '4-3-3', ['bari'], 'US Lecce'],
  ['sassuolo', 'US Sassuolo', 'Sassuolo', 'SAS', 'Sassuolo', 1920, 7300, '#00A752', '#000000', '#FFFFFF', 'Mapei Stadium', 21525, 'Mapei Stadium – Città del Tricolore', 60, 24, 920, 'Avoid relegation comfortably', 'Fabio Grosso', '4-3-3', ['modena', 'reggiana'], 'US Sassuolo Calcio'],
  ['pisa', 'Pisa SC', 'Pisa', 'PIS', 'Pisa', 1909, 6900, '#004D98', '#000000', '#FFFFFF', 'Arena Garibaldi', 14869, 'Arena Garibaldi', 38, 14, 650, 'Avoid relegation', 'Alberto Gilardino', '3-5-2', ['fiorentina', 'spezia'], 'Pisa SC'],
  ['cremonese', 'US Cremonese', 'Cremonese', 'CRE', 'Cremona', 1903, 6850, '#9B1B30', '#9CA3AF', '#FFFFFF', 'Stadio Giovanni Zini', 15191, 'Stadio Giovanni Zini', 36, 13, 640, 'Avoid relegation', 'Davide Nicola', '3-5-2', ['brescia', 'mantova'], 'US Cremonese'],
]);

// ============================================================================
// 6. ITALY — SERIE B (20 clubs)
// ============================================================================
const SERIE_B_CLUBS = buildLeagueClubs('serie-b', 'Italy', [
  ['empoli', 'Empoli FC', 'Empoli', 'EMP', 'Empoli', 1920, 6450, '#00579C', '#FFFFFF', '#FFFFFF', 'Stadio Carlo Castellani', 16284, 'Stadio Carlo Castellani', 22, 8, 420, 'Win automatic promotion', 'Guido Pagliuca', '3-5-2', ['fiorentina', 'pisa'], 'Empoli FC'],
  ['venezia', 'Venezia FC', 'Venezia', 'VEN', 'Venice', 1907, 6400, '#F58220', '#006E51', '#FFFFFF', 'Stadio Pier Luigi Penzo', 12048, 'Stadio Pier Luigi Penzo', 21, 8, 400, 'Win automatic promotion', 'Giovanni Stroppa', '3-5-2', ['verona', 'padova'], 'Venezia FC'],
  ['monza', 'AC Monza', 'Monza', 'MON', 'Monza', 1912, 6450, '#E30613', '#FFFFFF', '#FFFFFF', 'U-Power Stadium', 17102, 'Stadio Brianteo', 24, 9, 440, 'Win automatic promotion', 'Paolo Bianco', '3-5-2', ['como', 'ac-milan'], 'AC Monza'],
  ['palermo', 'Palermo FC', 'Palermo', 'PAL', 'Palermo', 1900, 6350, '#F29CB7', '#000000', '#111111', 'Stadio Renzo Barbera', 36365, 'Stadio Renzo Barbera', 26, 10, 410, 'Push for automatic promotion', 'Filippo Inzaghi', '4-3-3', ['bari', 'catanzaro'], 'Palermo FC'],
  ['sampdoria', 'UC Sampdoria', 'Sampdoria', 'SAM', 'Genoa', 1946, 6250, '#005DA9', '#FFFFFF', '#FFFFFF', 'Stadio Luigi Ferraris', 33205, 'Stadio Luigi Ferraris', 19, 6.5, 380, 'Reach the promotion playoffs', 'Massimo Donati', '4-2-3-1', ['genoa', 'spezia'], 'UC Sampdoria'],
  ['spezia', 'Spezia Calcio', 'Spezia', 'SPE', 'La Spezia', 1906, 6150, '#FFFFFF', '#000000', '#111111', 'Stadio Alberto Picco', 11968, 'Stadio Alberto Picco', 17, 5.5, 340, 'Reach the promotion playoffs', 'Luca D\'Angelo', '3-5-2', ['pisa', 'sampdoria'], 'Spezia Calcio'],
  ['bari', 'SSC Bari', 'Bari', 'BAR', 'Bari', 1908, 6050, '#FFFFFF', '#E30613', '#B80010', 'Stadio San Nicola', 58270, 'Stadio San Nicola', 16, 5, 320, 'Challenge for the playoffs', 'Fabio Caserta', '4-3-3', ['lecce', 'palermo'], 'SSC Bari'],
  ['cesena', 'Cesena FC', 'Cesena', 'CES', 'Cesena', 1940, 5950, '#FFFFFF', '#111111', '#111111', 'Stadio Dino Manuzzi', 20194, 'Stadio Dino Manuzzi', 14, 4.5, 290, 'Finish in the top half', 'Michele Mignani', '3-5-2', ['bologna', 'modena'], 'Cesena FC'],
  ['catanzaro', 'US Catanzaro', 'Catanzaro', 'CAT', 'Catanzaro', 1929, 5950, '#FFCC00', '#C8102E', '#7A0010', 'Stadio Nicola Ceravolo', 14650, 'Stadio Nicola Ceravolo', 14, 4.5, 290, 'Challenge for the playoffs', 'Alberto Aquilani', '3-5-2', ['palermo'], 'US Catanzaro 1929'],
  ['modena', 'Modena FC', 'Modena', 'MOD', 'Modena', 1912, 5900, '#FFDD00', '#0038A8', '#002878', 'Stadio Alberto Braglia', 21151, 'Stadio Alberto Braglia', 14, 4.2, 285, 'Finish in the top half', 'Andrea Sottil', '3-5-2', ['reggiana', 'sassuolo'], 'Modena FC 2018'],
  ['brescia', 'Brescia Calcio', 'Brescia', 'BRE', 'Brescia', 1911, 5900, '#0055A4', '#FFFFFF', '#FFFFFF', 'Stadio Mario Rigamonti', 19550, 'Stadio Mario Rigamonti', 13, 4, 280, 'Consolidate mid-table status', 'Rolando Maran', '4-3-3', ['atalanta', 'cremonese'], 'Brescia Calcio'],
  ['salernitana', 'US Salernitana', 'Salernitana', 'SAL', 'Salerno', 1919, 5950, '#7A1C24', '#FFFFFF', '#FFFFFF', 'Stadio Arechi', 37180, 'Stadio Arechi', 15, 4.8, 310, 'Finish in the top half', 'Giuseppe Raffaele', '3-5-2', ['napoli', 'avellino'], 'US Salernitana 1919'],
  ['frosinone', 'Frosinone Calcio', 'Frosinone', 'FRO', 'Frosinone', 1906, 5950, '#FFCC00', '#0055A4', '#003870', 'Stadio Benito Stirpe', 16227, 'Stadio Benito Stirpe', 15, 4.5, 300, 'Finish in the top half', 'Massimiliano Alvini', '4-2-3-1', ['as-roma', 'lazio'], 'Frosinone Calcio'],
  ['juve-stabia', 'SS Juve Stabia', 'Juve Stabia', 'JST', 'Castellammare di Stabia', 1907, 5800, '#FFDD00', '#0038A8', '#002878', 'Stadio Romeo Menti', 7642, 'Stadio Romeo Menti (Castellammare di Stabia)', 12, 3.8, 250, 'Consolidate mid-table status', 'Ignazio Abate', '3-5-2', ['salernitana', 'avellino'], 'SS Juve Stabia'],
  ['reggiana', 'AC Reggiana', 'Reggiana', 'REG', 'Reggio Emilia', 1919, 5750, '#7A1C24', '#FFFFFF', '#FFFFFF', 'Mapei Stadium', 21525, 'Mapei Stadium – Città del Tricolore', 11, 3.5, 245, 'Consolidate mid-table status', 'Davide Dionigi', '3-5-2', ['modena', 'parma'], 'AC Reggiana 1919'],
  ['mantova', 'Mantova 1911', 'Mantova', 'MAN', 'Mantua', 1911, 5700, '#FFFFFF', '#C8102E', '#A0001C', 'Stadio Danilo Martelli', 11219, 'Stadio Danilo Martelli', 11, 3.2, 235, 'Avoid relegation comfortably', 'Davide Possanzini', '4-2-3-1', ['cremonese', 'verona'], 'Mantova 1911'],
  ['sudtirol', 'FC Sudtirol', 'Sudtirol', 'SUD', 'Bolzano', 1974, 5700, '#FFFFFF', '#E30613', '#B80010', 'Stadio Druso', 5539, 'Stadio Druso', 11, 3.2, 240, 'Avoid relegation comfortably', 'Fabrizio Castori', '3-5-2', ['padova'], 'FC Südtirol'],
  ['carrarese', 'Carrarese Calcio', 'Carrarese', 'CAR', 'Carrara', 1908, 5600, '#0057B7', '#FFDD00', '#FFFFFF', 'Stadio dei Marmi', 4194, 'Stadio dei Marmi', 9.5, 2.8, 215, 'Avoid relegation', 'Antonio Calabro', '3-5-2', ['spezia', 'pisa'], 'Carrarese Calcio 1908'],
  ['padova', 'Calcio Padova', 'Padova', 'PAD', 'Padua', 1910, 5650, '#FFFFFF', '#E30613', '#B80010', 'Stadio Euganeo', 18060, 'Stadio Euganeo', 10, 3, 225, 'Avoid relegation', 'Matteo Andreoletti', '3-5-2', ['venezia'], 'Calcio Padova'],
  ['avellino', 'US Avellino', 'Avellino', 'AVE', 'Avellino', 1912, 5650, '#008A45', '#FFFFFF', '#FFFFFF', 'Stadio Partenio-Adriano Lombardi', 10215, 'Stadio Partenio-Adriano Lombardi', 10, 3, 225, 'Avoid relegation', 'Raffaele Biancolino', '4-3-3', ['salernitana', 'juve-stabia'], 'US Avellino 1912'],
]);

// ============================================================================
// 7. GERMANY — BUNDESLIGA (18 clubs)
// ============================================================================
const BUNDESLIGA_CLUBS = buildLeagueClubs('bundesliga', 'Germany', [
  ['bayern-munich', 'FC Bayern Munich', 'Bayern', 'BAY', 'Munich', 1900, 9600, '#DC052D', '#FFFFFF', '#FFFFFF', 'Allianz Arena', 75024, 'Allianz Arena', 310, 145, 4300, 'Win the Bundesliga title', 'Vincent Kompany', '4-2-3-1', ['borussia-dortmund', 'bayer-leverkusen', 'fc-nurnberg'], 'FC Bayern Munich'],
  ['bayer-leverkusen', 'Bayer 04 Leverkusen', 'Leverkusen', 'LEV', 'Leverkusen', 1904, 8950, '#E32221', '#000000', '#FFFFFF', 'BayArena', 30210, 'BayArena', 175, 85, 2350, 'Challenge for the Bundesliga title', 'Erik ten Hag', '3-5-2', ['fc-koln', 'bayern-munich'], 'Bayer 04 Leverkusen'],
  ['borussia-dortmund', 'Borussia Dortmund', 'Dortmund', 'BVB', 'Dortmund', 1909, 9000, '#FDE100', '#000000', '#111111', 'Signal Iduna Park', 81365, 'Westfalenstadion', 195, 90, 2750, 'Qualify for Champions League', 'Niko Kovac', '4-2-3-1', ['schalke-04', 'bayern-munich'], 'Borussia Dortmund'],
  ['rb-leipzig', 'RB Leipzig', 'RB Leipzig', 'RBL', 'Leipzig', 2009, 8650, '#DD0741', '#FFFFFF', '#FFFFFF', 'Red Bull Arena', 47069, 'Red Bull Arena (Leipzig)', 170, 82, 2200, 'Qualify for Champions League', 'Ole Werner', '4-4-2', ['dynamo-dresden', 'bayern-munich'], 'RB Leipzig'],
  ['vfb-stuttgart', 'VfB Stuttgart', 'Stuttgart', 'VFB', 'Stuttgart', 1893, 8450, '#E32219', '#FFFFFF', '#FFFFFF', 'MHPArena', 60058, 'MHPArena', 125, 55, 1650, 'Qualify for European football', 'Sebastian Hoeness', '4-2-3-1', ['karlsruher-sc', 'sc-freiburg'], 'VfB Stuttgart'],
  ['eintracht-frankfurt', 'Eintracht Frankfurt', 'Frankfurt', 'SGE', 'Frankfurt', 1899, 8500, '#E1000F', '#000000', '#FFFFFF', 'Deutsche Bank Park', 58000, 'Waldstadion (Frankfurt)', 140, 65, 1750, 'Qualify for Champions League', 'Dino Toppmoller', '4-2-3-1', ['mainz-05', 'darmstadt-98'], 'Eintracht Frankfurt'],
  ['sc-freiburg', 'SC Freiburg', 'Freiburg', 'SCF', 'Freiburg', 1904, 8050, '#E30613', '#000000', '#FFFFFF', 'Europa-Park Stadion', 34700, 'Europa-Park Stadion', 95, 38, 1250, 'Qualify for European football', 'Julian Schuster', '4-2-3-1', ['vfb-stuttgart'], 'SC Freiburg'],
  ['vfl-wolfsburg', 'VfL Wolfsburg', 'Wolfsburg', 'WOB', 'Wolfsburg', 1945, 7900, '#65B32E', '#FFFFFF', '#FFFFFF', 'Volkswagen Arena', 30000, 'Volkswagen Arena', 110, 46, 1500, 'Finish in the top half', 'Paul Simonis', '4-2-3-1', ['eintracht-braunschweig', 'hannover-96'], 'VfL Wolfsburg'],
  ['borussia-monchengladbach', 'Borussia Monchengladbach', 'Gladbach', 'BMG', 'Monchengladbach', 1900, 7850, '#FFFFFF', '#000000', '#111111', 'Borussia-Park', 54042, 'Borussia-Park', 92, 36, 1380, 'Finish in the top half', 'Gerardo Seoane', '4-2-3-1', ['fc-koln', 'borussia-dortmund'], 'Borussia Mönchengladbach'],
  ['werder-bremen', 'SV Werder Bremen', 'Werder', 'SVW', 'Bremen', 1899, 7750, '#1D9053', '#FFFFFF', '#FFFFFF', 'Weserstadion', 42100, 'Weserstadion', 82, 32, 1220, 'Finish in the top half', 'Horst Steffen', '3-5-2', ['hamburger-sv'], 'SV Werder Bremen'],
  ['mainz-05', '1. FSV Mainz 05', 'Mainz 05', 'M05', 'Mainz', 1905, 7800, '#C3141E', '#FFFFFF', '#FFFFFF', 'Mewa Arena', 33305, 'Mewa Arena', 85, 34, 1180, 'Challenge for European places', 'Bo Henriksen', '3-5-2', ['eintracht-frankfurt', 'kaiserslautern'], '1. FSV Mainz 05'],
  ['fc-augsburg', 'FC Augsburg', 'Augsburg', 'FCA', 'Augsburg', 1907, 7450, '#BA3733', '#007A33', '#FFFFFF', 'WWK Arena', 30660, 'Augsburg Arena', 66, 25, 1020, 'Achieve a mid-table finish', 'Sandro Wagner', '3-5-2', ['bayern-munich'], 'FC Augsburg'],
  ['union-berlin', '1. FC Union Berlin', 'Union Berlin', 'FCU', 'Berlin', 1966, 7500, '#EB1923', '#FFFFFF', '#FFFFFF', 'Stadion An der Alten Forsterei', 22012, 'Stadion An der Alten Försterei', 70, 26, 1080, 'Achieve a mid-table finish', 'Steffen Baumgart', '3-5-2', ['hertha-bsc'], '1. FC Union Berlin'],
  ['hoffenheim', 'TSG Hoffenheim', 'Hoffenheim', 'TSG', 'Sinsheim', 1899, 7500, '#1C63B7', '#FFFFFF', '#FFFFFF', 'PreZero Arena', 30150, 'Rhein-Neckar-Arena', 82, 32, 1200, 'Achieve a mid-table finish', 'Christian Ilzer', '4-2-3-1', ['vfb-stuttgart'], 'TSG 1899 Hoffenheim'],
  ['st-pauli', 'FC St. Pauli', 'St. Pauli', 'STP', 'Hamburg', 1910, 7200, '#623B2A', '#FFFFFF', '#FFFFFF', 'Millerntor-Stadion', 29546, 'Millerntor-Stadion', 52, 18, 820, 'Avoid relegation', 'Alexander Blessin', '3-5-2', ['hamburger-sv'], 'FC St. Pauli'],
  ['fc-koln', '1. FC Koln', 'FC Koln', 'KOE', 'Cologne', 1948, 7450, '#ED1C24', '#FFFFFF', '#FFFFFF', 'RheinEnergieStadion', 50000, 'RheinEnergieStadion', 65, 24, 980, 'Avoid relegation comfortably', 'Lukas Kwasniok', '4-2-3-1', ['borussia-monchengladbach', 'bayer-leverkusen', 'fortuna-dusseldorf'], '1. FC Köln'],
  ['hamburger-sv', 'Hamburger SV', 'HSV', 'HSV', 'Hamburg', 1887, 7450, '#005CA9', '#FFFFFF', '#FFFFFF', 'Volksparkstadion', 57000, 'Volksparkstadion', 68, 25, 1000, 'Avoid relegation comfortably', 'Merlin Polzin', '4-3-3', ['st-pauli', 'werder-bremen'], 'Hamburger SV'],
  ['heidenheim', '1. FC Heidenheim', 'Heidenheim', 'HDH', 'Heidenheim', 1846, 7150, '#E30613', '#003875', '#FFFFFF', 'Voith-Arena', 15000, 'Voith-Arena', 48, 16, 760, 'Avoid relegation', 'Frank Schmidt', '4-2-3-1', ['vfb-stuttgart'], '1. FC Heidenheim'],
]);

// ============================================================================
// 8. GERMANY — 2. BUNDESLIGA (18 clubs)
// ============================================================================
const BUNDESLIGA_2_CLUBS = buildLeagueClubs('2-bundesliga', 'Germany', [
  ['schalke-04', 'FC Schalke 04', 'Schalke 04', 'S04', 'Gelsenkirchen', 1904, 6600, '#004D9D', '#FFFFFF', '#FFFFFF', 'Veltins-Arena', 62271, 'Veltins-Arena', 28, 9, 520, 'Push for automatic promotion', 'Miron Muslic', '4-2-3-1', ['borussia-dortmund', 'vfl-bochum'], 'FC Schalke 04'],
  ['hertha-bsc', 'Hertha BSC', 'Hertha BSC', 'BSC', 'Berlin', 1892, 6550, '#005CA9', '#FFFFFF', '#FFFFFF', 'Olympiastadion Berlin', 74475, 'Olympiastadion (Berlin)', 28, 9.5, 510, 'Push for automatic promotion', 'Stefan Leitl', '4-2-3-1', ['union-berlin'], 'Hertha BSC'],
  ['vfl-bochum', 'VfL Bochum', 'Bochum', 'BOC', 'Bochum', 1848, 6500, '#005CA9', '#FFFFFF', '#FFFFFF', 'Vonovia Ruhrstadion', 26000, 'Ruhrstadion', 24, 8, 460, 'Win automatic promotion', 'Dieter Hecking', '3-5-2', ['schalke-04', 'borussia-dortmund'], 'VfL Bochum'],
  ['holstein-kiel', 'Holstein Kiel', 'Kiel', 'KIE', 'Kiel', 1900, 6450, '#005CA9', '#E30613', '#FFFFFF', 'Holstein-Stadion', 15034, 'Holstein-Stadion', 22, 7.5, 430, 'Push for automatic promotion', 'Marcel Rapp', '3-5-2', ['hamburger-sv', 'st-pauli'], 'Holstein Kiel'],
  ['fortuna-dusseldorf', 'Fortuna Dusseldorf', 'Dusseldorf', 'F95', 'Dusseldorf', 1895, 6400, '#E30613', '#FFFFFF', '#FFFFFF', 'Merkur Spiel-Arena', 54600, 'Merkur Spiel-Arena', 23, 8, 440, 'Push for automatic promotion', 'Daniel Thioune', '4-2-3-1', ['fc-koln'], 'Fortuna Düsseldorf'],
  ['hannover-96', 'Hannover 96', 'Hannover', 'H96', 'Hannover', 1896, 6350, '#1E8352', '#000000', '#FFFFFF', 'Heinz von Heiden Arena', 49000, 'Niedersachsenstadion', 21, 7, 410, 'Challenge for promotion', 'Christian Titz', '4-3-3', ['eintracht-braunschweig', 'vfl-wolfsburg'], 'Hannover 96'],
  ['kaiserslautern', '1. FC Kaiserslautern', 'K\'lautern', 'FCK', 'Kaiserslautern', 1900, 6350, '#C8102E', '#FFFFFF', '#FFFFFF', 'Fritz-Walter-Stadion', 49327, 'Fritz-Walter-Stadion', 20, 6.8, 400, 'Challenge for promotion', 'Torsten Lieberknecht', '3-5-2', ['mainz-05', 'karlsruher-sc'], '1. FC Kaiserslautern'],
  ['karlsruher-sc', 'Karlsruher SC', 'Karlsruhe', 'KSC', 'Karlsruhe', 1894, 6250, '#004A99', '#FFFFFF', '#FFFFFF', 'BBBank Wildpark', 34302, 'Wildparkstadion', 18, 6, 370, 'Finish in the top half', 'Christian Eichner', '4-4-2-diamond', ['vfb-stuttgart', 'kaiserslautern'], 'Karlsruher SC'],
  ['paderborn', 'SC Paderborn 07', 'Paderborn', 'SCP', 'Paderborn', 1907, 6250, '#005CA9', '#000000', '#FFFFFF', 'Home Deluxe Arena', 15000, 'Home Deluxe Arena', 18, 6, 360, 'Challenge for promotion', 'Ralf Kettemann', '3-5-2', ['arminia-bielefeld'], 'SC Paderborn 07'],
  ['fc-nurnberg', '1. FC Nurnberg', 'Nurnberg', 'FCN', 'Nuremberg', 1900, 6250, '#8C1D40', '#FFFFFF', '#FFFFFF', 'Max-Morlock-Stadion', 50000, 'Max-Morlock-Stadion', 19, 6.5, 380, 'Finish in the top half', 'Miroslav Klose', '3-5-2', ['greuther-furth', 'bayern-munich'], '1. FC Nürnberg'],
  ['elversberg', 'SV Elversberg', 'Elversberg', 'ELV', 'Spiesen-Elversberg', 1907, 6150, '#000000', '#FFFFFF', '#FFFFFF', 'Waldstadion an der Kaiserlinde', 10000, 'Waldstadion an der Kaiserlinde', 16, 5.5, 330, 'Finish in the top half', 'Vincent Wagner', '4-2-3-1', ['kaiserslautern'], 'SV Elversberg'],
  ['magdeburg', '1. FC Magdeburg', 'Magdeburg', 'FCM', 'Magdeburg', 1965, 6150, '#005CA9', '#FFFFFF', '#FFFFFF', 'Avnet Arena', 30098, 'MDCC-Arena', 17, 5.5, 340, 'Finish in the top half', 'Markus Fiedler', '4-3-3', ['dynamo-dresden'], '1. FC Magdeburg'],
  ['darmstadt-98', 'SV Darmstadt 98', 'Darmstadt', 'D98', 'Darmstadt', 1898, 6100, '#004E9E', '#FFFFFF', '#FFFFFF', 'Merck-Stadion am Bollenfalltor', 17810, 'Stadion am Böllenfalltor', 16, 5.2, 340, 'Consolidate mid-table status', 'Florian Kohfeldt', '4-2-3-1', ['eintracht-frankfurt'], 'SV Darmstadt 98'],
  ['greuther-furth', 'SpVgg Greuther Furth', 'Furth', 'SGF', 'Furth', 1903, 5950, '#008A45', '#FFFFFF', '#FFFFFF', 'Sportpark Ronhof', 16626, 'Sportpark Ronhof Thomas Sommer', 14, 4.5, 300, 'Consolidate mid-table status', 'Thomas Kleine', '3-5-2', ['fc-nurnberg'], 'SpVgg Greuther Fürth'],
  ['eintracht-braunschweig', 'Eintracht Braunschweig', 'Braunschw.', 'EBS', 'Braunschweig', 1895, 5850, '#FFDD00', '#0055A4', '#003870', 'Eintracht-Stadion', 23325, 'Eintracht-Stadion', 13, 4, 280, 'Avoid relegation', 'Heiner Backhaus', '3-5-2', ['hannover-96', 'vfl-wolfsburg'], 'Eintracht Braunschweig'],
  ['preussen-munster', 'Preussen Munster', 'Munster', 'SCP', 'Munster', 1906, 5750, '#008A45', '#000000', '#FFFFFF', 'Preussenstadion', 12754, 'Preußenstadion', 11, 3.5, 250, 'Avoid relegation', 'Alexander Ende', '4-4-2', ['arminia-bielefeld'], 'Preußen Münster'],
  ['dynamo-dresden', 'SG Dynamo Dresden', 'Dresden', 'SGD', 'Dresden', 1953, 5950, '#FFDD00', '#000000', '#111111', 'Rudolf-Harbig-Stadion', 32249, 'Rudolf-Harbig-Stadion', 15, 4.8, 300, 'Avoid relegation comfortably', 'Thomas Stamm', '4-3-3', ['magdeburg', 'rb-leipzig'], 'Dynamo Dresden'],
  ['arminia-bielefeld', 'Arminia Bielefeld', 'Bielefeld', 'DSC', 'Bielefeld', 1905, 5900, '#004E9E', '#000000', '#FFFFFF', 'SchucoArena', 27332, 'Bielefelder Alm', 14, 4.5, 285, 'Avoid relegation comfortably', 'Mitch Kniat', '4-3-3', ['paderborn', 'preussen-munster'], 'Arminia Bielefeld'],
]);

// ============================================================================
// 9. FRANCE — LIGUE 1 (18 clubs)
// ============================================================================
const LIGUE_1_CLUBS = buildLeagueClubs('ligue-1', 'France', [
  ['psg', 'Paris Saint-Germain', 'PSG', 'PSG', 'Paris', 1970, 9650, '#004170', '#DA291C', '#FFFFFF', 'Parc des Princes', 48583, 'Parc des Princes', 320, 150, 4500, 'Win Ligue 1 and Champions League', 'Luis Enrique', '4-3-3', ['marseille', 'paris-fc', 'lyon'], 'Paris Saint-Germain F.C.'],
  ['marseille', 'Olympique de Marseille', 'Marseille', 'OM', 'Marseille', 1899, 8600, '#2FAEE0', '#FFFFFF', '#0D1B2A', 'Stade Velodrome', 67394, 'Stade Vélodrome', 145, 68, 2100, 'Qualify for Champions League', 'Roberto De Zerbi', '4-2-3-1', ['psg', 'lyon', 'nice'], 'Olympique de Marseille'],
  ['monaco', 'AS Monaco', 'Monaco', 'ASM', 'Monaco', 1924, 8550, '#E51B22', '#FFFFFF', '#FFFFFF', 'Stade Louis II', 18523, 'Stade Louis II', 155, 72, 2000, 'Qualify for Champions League', 'Adi Hutter', '4-2-3-1', ['nice', 'marseille'], 'AS Monaco FC'],
  ['lyon', 'Olympique Lyonnais', 'Lyon', 'OL', 'Lyon', 1950, 8350, '#00489A', '#DA291C', '#FFFFFF', 'Groupama Stadium', 59186, 'Parc Olympique Lyonnais', 110, 48, 1800, 'Qualify for European football', 'Paulo Fonseca', '4-2-3-1', ['marseille', 'psg'], 'Olympique Lyonnais'],
  ['lille', 'LOSC Lille', 'Lille', 'LOS', 'Lille', 1944, 8350, '#E01E13', '#1E2A4A', '#FFFFFF', 'Stade Pierre-Mauroy', 50186, 'Stade Pierre-Mauroy', 115, 50, 1550, 'Qualify for Champions League', 'Bruno Genesio', '4-2-3-1', ['lens'], 'Lille OSC'],
  ['nice', 'OGC Nice', 'Nice', 'OGC', 'Nice', 1904, 8100, '#CC0000', '#000000', '#FFFFFF', 'Allianz Riviera', 36178, 'Allianz Riviera', 105, 44, 1450, 'Qualify for European football', 'Franck Haise', '3-5-2', ['monaco', 'marseille'], 'OGC Nice'],
  ['lens', 'RC Lens', 'RC Lens', 'RCL', 'Lens', 1906, 7950, '#FFCC00', '#E30613', '#8B0000', 'Stade Bollaert-Delelis', 38223, 'Stade Bollaert-Delelis', 90, 38, 1300, 'Challenge for European places', 'Pierre Sage', '3-5-2', ['lille'], 'RC Lens'],
  ['rennes', 'Stade Rennais', 'Rennes', 'REN', 'Rennes', 1901, 7900, '#D4002A', '#000000', '#FFFFFF', 'Roazhon Park', 29778, 'Roazhon Park', 95, 42, 1350, 'Finish in the top half', 'Habib Beye', '4-3-3', ['nantes', 'brest', 'lorient'], 'Stade Rennais F.C.'],
  ['strasbourg', 'RC Strasbourg', 'Strasbourg', 'RCS', 'Strasbourg', 1906, 7950, '#009FE3', '#FFFFFF', '#FFFFFF', 'Stade de la Meinau', 26109, 'Stade de la Meinau', 98, 45, 1250, 'Challenge for European places', 'Liam Rosenior', '4-2-3-1', ['metz'], 'RC Strasbourg Alsace'],
  ['brest', 'Stade Brestois 29', 'Brest', 'SB2', 'Brest', 1950, 7650, '#E30613', '#FFFFFF', '#FFFFFF', 'Stade Francis-Le Ble', 15220, 'Stade Francis-Le Blé', 65, 24, 920, 'Finish in the top half', 'Eric Roy', '4-3-3', ['rennes', 'lorient', 'nantes'], 'Stade Brestois 29'],
  ['toulouse', 'Toulouse FC', 'Toulouse', 'TFC', 'Toulouse', 1970, 7550, '#5A2D82', '#FFFFFF', '#FFFFFF', 'Stadium de Toulouse', 33150, 'Stadium de Toulouse', 62, 24, 900, 'Achieve a mid-table finish', 'Carles Martinez Novell', '3-5-2', ['marseille'], 'Toulouse FC'],
  ['nantes', 'FC Nantes', 'Nantes', 'FCN', 'Nantes', 1943, 7400, '#FFDD00', '#008A45', '#005A2B', 'Stade de la Beaujoire', 35322, 'Stade de la Beaujoire', 55, 20, 880, 'Achieve a mid-table finish', 'Luis Castro', '4-3-3', ['rennes', 'angers'], 'FC Nantes'],
  ['auxerre', 'AJ Auxerre', 'Auxerre', 'AJA', 'Auxerre', 1905, 7300, '#FFFFFF', '#0055A4', '#003870', "Stade de l'Abbe-Deschamps", 18541, "Stade de l'Abbé-Deschamps", 50, 18, 800, 'Avoid relegation comfortably', 'Christophe Pelissier', '3-5-2', ['psg'], 'AJ Auxerre'],
  ['angers', 'Angers SCO', 'Angers', 'SCO', 'Angers', 1919, 7050, '#000000', '#FFFFFF', '#FFFFFF', 'Stade Raymond Kopa', 19800, 'Stade Raymond Kopa', 40, 14, 680, 'Avoid relegation', 'Alexandre Dujeux', '4-2-3-1', ['nantes'], 'Angers SCO'],
  ['le-havre', 'Le Havre AC', 'Le Havre', 'HAC', 'Le Havre', 1872, 7050, '#003A70', '#87CEEB', '#FFFFFF', 'Stade Oceane', 25178, 'Stade Océane', 42, 14, 700, 'Avoid relegation', 'Didier Digard', '4-2-3-1', ['lens'], 'Le Havre AC'],
  ['lorient', 'FC Lorient', 'Lorient', 'FCL', 'Lorient', 1926, 7150, '#F37021', '#000000', '#FFFFFF', 'Stade du Moustoir', 18890, 'Stade du Moustoir', 46, 17, 740, 'Avoid relegation', 'Olivier Pantaloni', '4-2-3-1', ['rennes', 'brest'], 'FC Lorient'],
  ['paris-fc', 'Paris FC', 'Paris FC', 'PFC', 'Paris', 1969, 7350, '#1B365D', '#FFFFFF', '#FFFFFF', 'Stade Jean-Bouin', 20000, 'Stade Jean-Bouin (Paris)', 85, 40, 1050, 'Establish Ligue 1 status', 'Stephane Gilli', '4-2-3-1', ['psg'], 'Paris FC'],
  ['metz', 'FC Metz', 'FC Metz', 'FCM', 'Metz', 1932, 7050, '#7A1C24', '#FFFFFF', '#FFFFFF', 'Stade Saint-Symphorien', 28786, 'Stade Saint-Symphorien', 42, 14, 690, 'Avoid relegation', 'Stephane Le Mignan', '4-2-3-1', ['strasbourg'], 'FC Metz'],
]);

// ============================================================================
// 10. SLOVENIA — PRVALIGA TELEMACH (10 clubs)
// ============================================================================
const PRVALIGA_CLUBS = buildLeagueClubs('prvaliga', 'Slovenia', [
  ['olimpija-ljubljana', 'NK Olimpija Ljubljana', 'Olimpija', 'OLI', 'Ljubljana', 1911, 5600, '#008A45', '#FFFFFF', '#FFFFFF', 'Stadion Stozice', 16038, 'Stožice Stadium', 8.5, 2.4, 145, 'Win the PrvaLiga title', 'Jorge Simao', '4-2-3-1', ['maribor', 'celje', 'bravo'], 'NK Olimpija Ljubljana'],
  ['maribor', 'NK Maribor', 'Maribor', 'MAR', 'Maribor', 1960, 5550, '#4B286D', '#FFCC00', '#FFFFFF', 'Ljudski vrt', 11709, 'Ljudski vrt', 8.2, 2.2, 140, 'Win the PrvaLiga title', 'Tugberk Tanrivermis', '4-2-3-1', ['olimpija-ljubljana', 'celje', 'mura'], 'NK Maribor'],
  ['celje', 'NK Celje', 'Celje', 'CEL', 'Celje', 1919, 5550, '#0057B7', '#FFDD00', '#FFFFFF', "Stadion Z'dezele", 13059, "Stadion Z'dežele", 9.0, 2.6, 150, 'Win the PrvaLiga title', 'Albert Riera', '4-3-3', ['maribor', 'olimpija-ljubljana'], 'NK Celje'],
  ['koper', 'FC Koper', 'Koper', 'KOP', 'Koper', 1955, 4950, '#FFCC00', '#0055A4', '#003870', 'SRC Bonifika', 4047, 'Bonifika Stadium', 4.2, 1.0, 82, 'Qualify for European football', 'Slavisa Stojanovic', '4-2-3-1', ['primorje', 'gorica', 'olimpija-ljubljana'], 'FC Koper'],
  ['bravo', 'NK Bravo', 'Bravo', 'BRA', 'Ljubljana', 2006, 4750, '#FFDD00', '#004A99', '#002855', 'Sportni park Siska', 2308, 'Šiška Sports Park', 3.4, 0.8, 68, 'Finish in the top half', 'Ales Arnol', '4-2-3-1', ['olimpija-ljubljana', 'domzale'], 'NK Bravo'],
  ['mura', 'NS Mura', 'Mura', 'MUR', 'Murska Sobota', 1924, 4800, '#111111', '#FFFFFF', '#FFFFFF', 'Mestni stadion Fazanerija', 4506, 'Fazanerija City Stadium', 3.6, 0.85, 74, 'Challenge for European places', 'Ivan Kurtusic', '4-2-3-1', ['nafta-1903', 'maribor'], 'NŠ Mura'],
  ['domzale', 'NK Domzale', 'Domzale', 'DOM', 'Domzale', 1921, 4550, '#FFCC00', '#0057B7', '#00306B', 'Sportni park Domzale', 3100, 'Domžale Sports Park', 2.8, 0.6, 58, 'Consolidate mid-table status', 'Tonci Zlogar', '4-2-3-1', ['radomlje', 'bravo'], 'NK Domžale'],
  ['radomlje', 'NK Radomlje', 'Radomlje', 'RAD', 'Radomlje', 1972, 4350, '#FFDD00', '#111111', '#111111', 'Sportni park Domzale', 3100, 'Domžale Sports Park', 2.1, 0.45, 48, 'Avoid relegation', 'Darjan Slavic', '4-3-3', ['domzale'], 'NK Radomlje'],
  ['primorje', 'ND Primorje', 'Primorje', 'PRI', 'Ajdovscina', 1924, 4300, '#C8102E', '#000000', '#FFFFFF', 'Mestni stadion Ajdovscina', 1630, 'Ajdovščina Stadium', 2.0, 0.4, 46, 'Avoid relegation', 'Milan Andjelkovic', '4-2-3-1', ['koper', 'gorica'], 'ND Primorje'],
  ['aluminij', 'NK Aluminij', 'Aluminij', 'ALU', 'Kidricevo', 1946, 4200, '#D4002A', '#FFFFFF', '#FFFFFF', 'Sportni park Kidricevo', 1200, 'Aluminij Sports Park', 1.8, 0.35, 42, 'Avoid relegation', 'Jura Arsic', '4-2-3-1', ['maribor', 'drava-ptuj'], 'NK Aluminij'],
]);

// ============================================================================
// 11. SLOVENIA — 2. SNL (16 clubs)
// ============================================================================
const SLOVENIA_2SNL_CLUBS = buildLeagueClubs('2-snl', 'Slovenia', [
  ['nafta-1903', 'NK Nafta 1903', 'Nafta', 'NAF', 'Lendava', 1903, 3950, '#0057B7', '#FFFFFF', '#FFFFFF', 'Sportni park Lendava', 2000, 'Lendava Sports Park', 1.6, 0.32, 34, 'Win promotion to PrvaLiga', 'Jozsef Bozsik', '4-2-3-1', ['mura', 'beltinci'], 'NK Nafta 1903'],
  ['gorica', 'ND Gorica', 'Gorica', 'GOR', 'Nova Gorica', 1947, 3900, '#0055A4', '#FFFFFF', '#FFFFFF', 'Sportni park Nova Gorica', 3100, 'Nova Gorica Sports Park', 1.5, 0.30, 32, 'Win promotion to PrvaLiga', 'Oliver Bogatinov', '4-3-3', ['koper', 'primorje', 'bilje'], 'ND Gorica'],
  ['triglav-kranj', 'NK Triglav Kranj', 'Triglav', 'TRI', 'Kranj', 1920, 3800, '#7A1C24', '#FFFFFF', '#FFFFFF', 'Stadion Stanka Mlakarja', 2060, 'Stanko Mlakar Stadium', 1.3, 0.25, 28, 'Challenge for promotion', 'Darijan Matic', '4-2-3-1', ['domzale'], 'NK Triglav Kranj'],
  ['tabor-sezana', 'NK Tabor Sezana', 'Tabor', 'TAB', 'Sezana', 1923, 3700, '#D4002A', '#000000', '#FFFFFF', 'Stadion Rajko Stolfa', 1310, 'Rajko Štolfa Stadium', 1.2, 0.22, 26, 'Finish in the top half', 'Radostin Aleksandrov', '4-2-3-1', ['koper', 'jadran-dekani'], 'NK Tabor Sežana'],
  ['beltinci', 'ND Beltinci', 'Beltinci', 'BEL', 'Beltinci', 1949, 3650, '#FFDD00', '#0055A4', '#00306B', 'Sportni park Beltinci', 1346, 'Beltinci Sports Park', 1.1, 0.20, 24, 'Finish in the top half', 'Simon Dvoršak', '4-2-3-1', ['nafta-1903', 'mura'], 'ND Beltinci'],
  ['brinje-grosuplje', 'NK Brinje Grosuplje', 'Brinje', 'BRI', 'Grosuplje', 2003, 3650, '#0057B7', '#FFDD00', '#FFFFFF', 'Sportni park Brinje', 1000, 'Grosuplje', 1.1, 0.20, 24, 'Finish in the top half', 'Goran Markovic', '4-3-3', ['ilirija-1911', 'slovan-ljubljana'], 'NK Brinje Grosuplje'],
  ['bistrica', 'NK Bistrica', 'Bistrica', 'BIS', 'Slovenska Bistrica', 1958, 3550, '#C8102E', '#FFFFFF', '#FFFFFF', 'Sportni park Slovenska Bistrica', 1200, 'Slovenska Bistrica', 0.95, 0.16, 21, 'Consolidate mid-table status', 'Robert Pevnik', '4-4-2', ['dravinja', 'aluminij'], 'NK Bistrica'],
  ['rudar-velenje', 'NK Rudar Velenje', 'Rudar', 'RUD', 'Velenje', 1948, 3600, '#008A45', '#000000', '#FFFFFF', 'Stadion Ob Jezeru', 1864, 'Ob Jezeru City Stadium', 1.0, 0.18, 22, 'Consolidate mid-table status', 'Miran Srebrnic', '4-2-3-1', ['celje'], 'NK Rudar Velenje'],
  ['krka', 'NK Krka', 'Krka', 'KRK', 'Novo Mesto', 1922, 3550, '#008A45', '#FFFFFF', '#FFFFFF', 'Stadion Portoval', 1500, 'Portoval', 0.95, 0.16, 21, 'Consolidate mid-table status', 'Adnan Zildzovic', '4-2-3-1', ['brinje-grosuplje'], 'NK Krka'],
  ['ilirija-1911', 'ND Ilirija 1911', 'Ilirija', 'ILI', 'Ljubljana', 1911, 3450, '#008A45', '#FFFFFF', '#FFFFFF', 'Sportni park Ilirija', 1000, 'Ilirija Sports Park', 0.85, 0.14, 19, 'Consolidate mid-table status', 'Darko Karapetrovic', '4-4-2', ['slovan-ljubljana', 'bravo'], 'ND Ilirija 1911'],
  ['jadran-dekani', 'NK Jadran Dekani', 'Dekani', 'JAD', 'Dekani', 1938, 3400, '#0055A4', '#FFFFFF', '#FFFFFF', 'Sportni park Dekani', 1000, 'Dekani', 0.8, 0.12, 18, 'Avoid relegation comfortably', 'Alen Sculac', '4-4-2', ['koper', 'tabor-sezana'], 'NK Jadran Dekani'],
  ['bilje', 'ND Bilje', 'Bilje', 'BIL', 'Bilje', 1946, 3350, '#000000', '#FFFFFF', '#FFFFFF', 'Igrisce V dolinci', 800, 'Bilje', 0.75, 0.11, 17, 'Avoid relegation comfortably', 'Ziga Pahor', '4-2-3-1', ['gorica', 'primorje'], 'ND Bilje'],
  ['drava-ptuj', 'NK Drava Ptuj', 'Drava', 'DRA', 'Ptuj', 1933, 3350, '#0057B7', '#FFFFFF', '#FFFFFF', 'Mestni stadion Ptuj', 1592, 'Ptuj City Stadium', 0.8, 0.12, 18, 'Avoid relegation', 'Jura Piber', '4-4-2', ['aluminij', 'maribor'], 'NK Drava Ptuj'],
  ['tolmin', 'NK Tolmin', 'Tolmin', 'TOL', 'Tolmin', 1921, 3250, '#C8102E', '#000000', '#FFFFFF', 'Sportni park Brajda', 800, 'Tolmin', 0.7, 0.10, 16, 'Avoid relegation', 'Sanel Konjevic', '4-4-2', ['gorica', 'bilje'], 'NK Tolmin'],
  ['slovan-ljubljana', 'ND Slovan Ljubljana', 'Slovan', 'SLO', 'Ljubljana', 1913, 3300, '#C8102E', '#FFFFFF', '#FFFFFF', 'Sportni park Kodeljevo', 1500, 'Kodeljevo Sports Park', 0.75, 0.11, 17, 'Avoid relegation', 'Luka Zinko', '4-2-3-1', ['ilirija-1911', 'olimpija-ljubljana'], 'ND Slovan'],
  ['dravinja', 'ND Dravinja', 'Dravinja', 'DRV', 'Slovenske Konjice', 1934, 3250, '#0057B7', '#FFFFFF', '#FFFFFF', 'SRC Dobrava', 1000, 'Slovenske Konjice', 0.7, 0.10, 16, 'Avoid relegation', 'Almir Sulejmanovic', '4-4-2', ['bistrica'], 'ND Dravinja'],
]);

// ============================================================================
// 12. NETHERLANDS — EREDIVISIE (18 clubs)
// ============================================================================
const EREDIVISIE_CLUBS = buildLeagueClubs('eredivisie', 'Netherlands', [
  ['ajax', 'AFC Ajax', 'Ajax', 'AJA', 'Amsterdam', 1900, 8400, '#FFFFFF', '#D2122E', '#C00D26', 'Johan Cruijff Arena', 55865, 'Johan Cruyff Arena', 135, 58, 1550, 'Win the Eredivisie title', 'John Heitinga', '4-3-3', ['feyenoord', 'psv', 'fc-utrecht'], 'AFC Ajax'],
  ['psv', 'PSV Eindhoven', 'PSV', 'PSV', 'Eindhoven', 1913, 8500, '#ED1C24', '#FFFFFF', '#FFFFFF', 'Philips Stadion', 35119, 'Philips Stadion', 140, 60, 1600, 'Win the Eredivisie title', 'Peter Bosz', '4-3-3', ['ajax', 'feyenoord'], 'PSV Eindhoven'],
  ['feyenoord', 'Feyenoord', 'Feyenoord', 'FEY', 'Rotterdam', 1908, 8350, '#EE1C25', '#FFFFFF', '#FFFFFF', 'De Kuip', 47500, 'De Kuip', 120, 50, 1450, 'Challenge for the Eredivisie title', 'Robin van Persie', '4-3-3', ['ajax', 'sparta-rotterdam', 'excelsior'], 'Feyenoord'],
  ['az-alkmaar', 'AZ Alkmaar', 'AZ', 'AZ', 'Alkmaar', 1967, 7800, '#DB0029', '#FFFFFF', '#FFFFFF', 'AFAS Stadion', 19500, 'AFAS Stadion', 78, 32, 920, 'Qualify for European football', 'Maarten Martens', '4-3-3', ['ajax'], 'AZ Alkmaar'],
  ['fc-twente', 'FC Twente', 'Twente', 'TWE', 'Enschede', 1965, 7650, '#E30613', '#FFFFFF', '#FFFFFF', 'De Grolsch Veste', 30205, 'De Grolsch Veste', 62, 24, 820, 'Qualify for European football', 'Joseph Oosting', '4-2-3-1', ['heracles-almelo', 'go-ahead-eagles'], 'FC Twente'],
  ['fc-utrecht', 'FC Utrecht', 'Utrecht', 'UTR', 'Utrecht', 1970, 7550, '#E30613', '#FFFFFF', '#FFFFFF', 'Stadion Galgenwaard', 23750, 'Stadion Galgenwaard', 56, 22, 760, 'Qualify for European football', 'Ron Jans', '4-2-3-1', ['ajax'], 'FC Utrecht'],
  ['nec-nijmegen', 'NEC Nijmegen', 'NEC', 'NEC', 'Nijmegen', 1900, 7100, '#E30613', '#008A45', '#FFFFFF', 'Goffertstadion', 12500, 'Goffertstadion', 34, 12, 520, 'Finish in the top half', 'Dick Schreuder', '4-3-3', ['fc-utrecht'], 'NEC Nijmegen'],
  ['go-ahead-eagles', 'Go Ahead Eagles', 'GA Eagles', 'GAE', 'Deventer', 1902, 7150, '#E30613', '#FFDD00', '#FFFFFF', 'De Adelaarshorst', 10000, 'De Adelaarshorst', 36, 13, 520, 'Finish in the top half', 'Melvin Boel', '4-2-3-1', ['pec-zwolle', 'fc-twente'], 'Go Ahead Eagles'],
  ['sparta-rotterdam', 'Sparta Rotterdam', 'Sparta', 'SPA', 'Rotterdam', 1888, 7000, '#E30613', '#FFFFFF', '#FFFFFF', 'Sparta Stadion Het Kasteel', 11026, 'Sparta Stadion Het Kasteel', 30, 10, 480, 'Achieve a mid-table finish', 'Maurice Steijn', '4-2-3-1', ['feyenoord', 'excelsior'], 'Sparta Rotterdam'],
  ['heerenveen', 'SC Heerenveen', 'Heerenveen', 'HEE', 'Heerenveen', 1920, 7050, '#0055A4', '#FFFFFF', '#FFFFFF', 'Abe Lenstra Stadion', 27224, 'Abe Lenstra Stadion', 32, 11, 500, 'Finish in the top half', 'Robin Veldman', '4-2-3-1', ['fc-groningen'], 'SC Heerenveen'],
  ['fortuna-sittard', 'Fortuna Sittard', 'Fortuna', 'FOR', 'Sittard', 1968, 6850, '#FFDD00', '#008A45', '#005A2B', 'Fortuna Sittard Stadion', 12500, 'Fortuna Sittard Stadion', 26, 9, 430, 'Achieve a mid-table finish', 'Danny Buijs', '4-2-3-1', ['psv'], 'Fortuna Sittard'],
  ['fc-groningen', 'FC Groningen', 'Groningen', 'GRO', 'Groningen', 1971, 6950, '#008A45', '#FFFFFF', '#FFFFFF', 'Euroborg', 22550, 'Euroborg', 28, 9.5, 460, 'Achieve a mid-table finish', 'Dick Lukkien', '4-4-2', ['heerenveen'], 'FC Groningen'],
  ['heracles-almelo', 'Heracles Almelo', 'Heracles', 'HER', 'Almelo', 1903, 6750, '#000000', '#FFFFFF', '#FFFFFF', 'Asito Stadion', 12080, 'Asito Stadion', 22, 7.5, 390, 'Avoid relegation comfortably', 'Bas Sibum', '4-2-3-1', ['fc-twente'], 'Heracles Almelo'],
  ['pec-zwolle', 'PEC Zwolle', 'PEC Zwolle', 'PEC', 'Zwolle', 1910, 6800, '#0057B7', '#FFFFFF', '#FFFFFF', 'MAC3PARK Stadion', 14000, 'MAC³PARK stadion', 24, 8, 400, 'Avoid relegation comfortably', 'Henry van der Vegt', '4-2-3-1', ['go-ahead-eagles'], 'PEC Zwolle'],
  ['nac-breda', 'NAC Breda', 'NAC Breda', 'NAC', 'Breda', 1912, 6750, '#FFDD00', '#000000', '#111111', 'Rat Verlegh Stadion', 19000, 'Rat Verlegh Stadion', 23, 7.5, 390, 'Avoid relegation comfortably', 'Carl Hoefkens', '4-4-2', ['willem-ii'], 'NAC Breda'],
  ['willem-ii', 'Willem II', 'Willem II', 'WIL', 'Tilburg', 1896, 6650, '#E30613', '#0055A4', '#FFFFFF', 'Koning Willem II Stadion', 14700, 'Koning Willem II Stadion', 20, 6.5, 360, 'Avoid relegation', 'John Stegeman', '4-3-3', ['nac-breda'], 'Willem II (football club)'],
  ['fc-volendam', 'FC Volendam', 'Volendam', 'VOL', 'Volendam', 1977, 6500, '#F37021', '#000000', '#FFFFFF', 'Kras Stadion', 6984, 'Kras Stadion', 16, 5, 310, 'Avoid relegation', 'Rick Kruys', '4-3-3', ['ajax'], 'FC Volendam'],
  ['excelsior', 'SBV Excelsior', 'Excelsior', 'EXC', 'Rotterdam', 1902, 6500, '#E30613', '#000000', '#FFFFFF', 'Van Donge & De Roo Stadion', 4400, 'Stadion Woudestein', 16, 5, 310, 'Avoid relegation', 'Ruben den Uil', '4-3-3', ['feyenoord', 'sparta-rotterdam'], 'Excelsior Rotterdam'],
]);

// ============================================================================
// 13. PORTUGAL — PRIMEIRA LIGA (18 clubs)
// ============================================================================
const PRIMEIRA_LIGA_CLUBS = buildLeagueClubs('primeira-liga', 'Portugal', [
  ['benfica', 'SL Benfica', 'Benfica', 'SLB', 'Lisbon', 1904, 8600, '#E30613', '#FFFFFF', '#FFFFFF', 'Estadio da Luz', 64642, 'Estádio da Luz', 155, 68, 1750, 'Win the Primeira Liga title', 'Bruno Lage', '4-2-3-1', ['sporting-cp', 'porto'], 'S.L. Benfica'],
  ['sporting-cp', 'Sporting CP', 'Sporting', 'SCP', 'Lisbon', 1906, 8650, '#008A45', '#FFFFFF', '#FFFFFF', 'Estadio Jose Alvalade', 50095, 'Estádio José Alvalade', 150, 65, 1650, 'Win the Primeira Liga title', 'Rui Borges', '3-5-2', ['benfica', 'porto'], 'Sporting CP'],
  ['porto', 'FC Porto', 'FC Porto', 'FCP', 'Porto', 1893, 8550, '#004B93', '#FFFFFF', '#FFFFFF', 'Estadio do Dragao', 50033, 'Estádio do Dragão', 140, 58, 1600, 'Win the Primeira Liga title', 'Francesco Farioli', '4-3-3', ['benfica', 'sporting-cp', 'boavista'], 'FC Porto'],
  ['braga', 'SC Braga', 'Braga', 'SCB', 'Braga', 1921, 7900, '#E30613', '#FFFFFF', '#FFFFFF', 'Estadio Municipal de Braga', 30286, 'Estádio Municipal de Braga', 75, 30, 950, 'Qualify for European football', 'Carlos Vicens', '4-3-3', ['vitoria-guimaraes'], 'S.C. Braga'],
  ['vitoria-guimaraes', 'Vitoria SC', 'Vitoria SC', 'VSC', 'Guimaraes', 1922, 7450, '#FFFFFF', '#000000', '#111111', 'Estadio D. Afonso Henriques', 30029, 'Estádio D. Afonso Henriques', 42, 16, 620, 'Qualify for European football', 'Luis Pinto', '4-2-3-1', ['braga'], 'Vitória S.C.'],
  ['santa-clara', 'CD Santa Clara', 'Santa Clara', 'STA', 'Ponta Delgada', 1921, 7100, '#E30613', '#FFFFFF', '#FFFFFF', 'Estadio de Sao Miguel', 12500, 'Estádio de São Miguel (Ponta Delgada)', 28, 10, 440, 'Finish in the top half', 'Vasco Matos', '3-5-2', ['nacional'], 'C.D. Santa Clara'],
  ['famalicao', 'FC Famalicao', 'Famalicao', 'FAM', 'Vila Nova de Famalicao', 1931, 7150, '#004A99', '#FFFFFF', '#FFFFFF', 'Estadio Municipal 22 de Junho', 5186, 'Estádio Municipal 22 de Junho', 32, 12, 480, 'Finish in the top half', 'Hugo Oliveira', '4-2-3-1', ['braga', 'vitoria-guimaraes'], 'F.C. Famalicão'],
  ['casa-pia', 'Casa Pia AC', 'Casa Pia', 'CAS', 'Lisbon', 1920, 6950, '#000000', '#FFFFFF', '#FFFFFF', 'Estadio Municipal de Rio Maior', 7000, 'Estádio Municipal de Rio Maior', 24, 8, 400, 'Achieve a mid-table finish', 'Joao Pereira', '3-5-2', ['estoril', 'benfica'], 'Casa Pia A.C.'],
  ['rio-ave', 'Rio Ave FC', 'Rio Ave', 'RIO', 'Vila do Conde', 1939, 6950, '#008A45', '#FFFFFF', '#FFFFFF', 'Estadio dos Arcos', 5300, 'Estádio dos Arcos', 26, 9, 430, 'Achieve a mid-table finish', 'Sotiris Silaidopoulos', '4-2-3-1', ['porto'], 'Rio Ave F.C.'],
  ['moreirense', 'Moreirense FC', 'Moreirense', 'MOR', 'Moreira de Conegos', 1938, 6950, '#008A45', '#FFFFFF', '#FFFFFF', 'Parque Joaquim de Almeida Freitas', 6150, 'Parque de Jogos Comendador Joaquim de Almeida Freitas', 24, 8, 400, 'Achieve a mid-table finish', 'Vasco Botelho da Costa', '4-2-3-1', ['vitoria-guimaraes'], 'Moreirense F.C.'],
  ['estoril', 'GD Estoril Praia', 'Estoril', 'EST', 'Estoril', 1939, 6900, '#FFDD00', '#0055A4', '#00306B', 'Estadio Antonio Coimbra da Mota', 5094, 'Estádio António Coimbra da Mota', 24, 8.5, 410, 'Achieve a mid-table finish', 'Ian Cathro', '3-5-2', ['casa-pia', 'estrela-amadora'], 'G.D. Estoril Praia'],
  ['gil-vicente', 'Gil Vicente FC', 'Gil Vicente', 'GIL', 'Barcelos', 1924, 6850, '#E30613', '#004A99', '#FFFFFF', 'Estadio Cidade de Barcelos', 12046, 'Estádio Cidade de Barcelos', 22, 7.5, 380, 'Avoid relegation comfortably', 'Cesar Peixoto', '4-2-3-1', ['braga'], 'Gil Vicente F.C.'],
  ['arouca', 'FC Arouca', 'Arouca', 'ARO', 'Arouca', 1951, 6800, '#FFDD00', '#0055A4', '#00306B', 'Estadio Municipal de Arouca', 5600, 'Estádio Municipal de Arouca', 20, 7, 360, 'Avoid relegation comfortably', 'Vasco Seabra', '4-2-3-1', ['porto'], 'F.C. Arouca'],
  ['nacional', 'CD Nacional', 'Nacional', 'NAC', 'Funchal', 1910, 6650, '#000000', '#FFFFFF', '#FFFFFF', 'Estadio da Madeira', 5200, 'Estádio da Madeira', 17, 5.5, 320, 'Avoid relegation', 'Tiago Margarido', '4-3-3', ['santa-clara'], 'C.D. Nacional'],
  ['estrela-amadora', 'CF Estrela da Amadora', 'Estrela', 'EST', 'Amadora', 1932, 6650, '#FFFFFF', '#E30613', '#008A45', 'Estadio Jose Gomes', 9288, 'Estádio José Gomes', 17, 5.5, 320, 'Avoid relegation', 'Jose Faria', '3-5-2', ['estoril', 'benfica'], 'C.F. Estrela da Amadora'],
  ['tondela', 'CD Tondela', 'Tondela', 'TON', 'Tondela', 1933, 6500, '#FFDD00', '#008A45', '#005A2B', 'Estadio Joao Cardoso', 5000, 'Estádio João Cardoso', 15, 4.5, 290, 'Avoid relegation', 'Ivo Vieira', '4-2-3-1', ['arouca'], 'C.D. Tondela'],
  ['alverca', 'FC Alverca', 'Alverca', 'ALV', 'Alverca do Ribatejo', 1939, 6450, '#E30613', '#0055A4', '#FFFFFF', 'Complexo Desportivo de Alverca', 7705, 'Complexo Desportivo FC Alverca', 16, 5, 290, 'Avoid relegation', 'Custodio Castro', '4-2-3-1', ['benfica', 'sporting-cp'], 'F.C. Alverca'],
  ['boavista', 'Boavista FC', 'Boavista', 'BOA', 'Porto', 1903, 6650, '#000000', '#FFFFFF', '#FFFFFF', 'Estadio do Bessa', 28263, 'Estádio do Bessa', 18, 5.5, 340, 'Avoid relegation', 'Stuart Baxter', '4-2-3-1', ['porto'], 'Boavista F.C.'],
]);

// ============================================================================
// 14. SCOTLAND — SCOTTISH PREMIERSHIP (12 clubs)
// ============================================================================
const SCOTTISH_PREMIERSHIP_CLUBS = buildLeagueClubs('scottish-premiership', 'Scotland', [
  ['celtic', 'Celtic FC', 'Celtic', 'CEL', 'Glasgow', 1887, 7950, '#018749', '#FFFFFF', '#FFFFFF', 'Celtic Park', 60411, 'Celtic Park', 92, 35, 1150, 'Win the Scottish Premiership', 'Brendan Rodgers', '4-3-3', ['rangers', 'aberdeen'], 'Celtic F.C.'],
  ['rangers', 'Rangers FC', 'Rangers', 'RAN', 'Glasgow', 1872, 7850, '#1B458F', '#FFFFFF', '#FFFFFF', 'Ibrox Stadium', 51700, 'Ibrox Stadium', 80, 30, 1080, 'Win the Scottish Premiership', 'Russell Martin', '4-2-3-1', ['celtic', 'aberdeen'], 'Rangers F.C.'],
  ['aberdeen', 'Aberdeen FC', 'Aberdeen', 'ABE', 'Aberdeen', 1903, 6800, '#E30613', '#FFFFFF', '#FFFFFF', 'Pittodrie Stadium', 20866, 'Pittodrie Stadium', 24, 8, 380, 'Qualify for European football', 'Jimmy Thelin', '4-2-3-1', ['rangers', 'celtic', 'dundee-united'], 'Aberdeen F.C.'],
  ['hearts', 'Heart of Midlothian', 'Hearts', 'HEA', 'Edinburgh', 1874, 6750, '#7A1C24', '#FFFFFF', '#FFFFFF', 'Tynecastle Park', 19852, 'Tynecastle Park', 25, 8.5, 390, 'Qualify for European football', 'Derek McInnes', '4-2-3-1', ['hibernian'], 'Heart of Midlothian F.C.'],
  ['hibernian', 'Hibernian FC', 'Hibernian', 'HIB', 'Edinburgh', 1875, 6700, '#007A33', '#FFFFFF', '#FFFFFF', 'Easter Road', 20421, 'Easter Road', 23, 7.5, 370, 'Qualify for European football', 'David Gray', '3-5-2', ['hearts'], 'Hibernian F.C.'],
  ['dundee-united', 'Dundee United', 'Dundee Utd', 'DUN', 'Dundee', 1909, 6450, '#F37021', '#000000', '#FFFFFF', 'Tannadice Park', 14223, 'Tannadice Park', 16, 5, 290, 'Finish in the top six', 'Jim Goodwin', '3-5-2', ['dundee', 'aberdeen'], 'Dundee United F.C.'],
  ['motherwell', 'Motherwell FC', 'Motherwell', 'MOT', 'Motherwell', 1886, 6350, '#F5A12D', '#7A1C24', '#111111', 'Fir Park', 13677, 'Fir Park', 14, 4.2, 260, 'Finish in the top six', 'Jens Berthel Askou', '3-5-2', ['st-mirren'], 'Motherwell F.C.'],
  ['st-mirren', 'St Mirren FC', 'St Mirren', 'STM', 'Paisley', 1877, 6350, '#000000', '#FFFFFF', '#FFFFFF', 'The SMiSA Stadium', 7937, 'St Mirren Park', 14, 4, 255, 'Finish in the top six', 'Stephen Robinson', '3-5-2', ['motherwell'], 'St Mirren F.C.'],
  ['kilmarnock', 'Kilmarnock FC', 'Kilmarnock', 'KIL', 'Kilmarnock', 1869, 6300, '#0055A4', '#FFFFFF', '#FFFFFF', 'Rugby Park', 15003, 'Rugby Park', 13, 3.8, 250, 'Finish in the top six', 'Stuart Kettlewell', '4-4-2', ['st-mirren'], 'Kilmarnock F.C.'],
  ['dundee', 'Dundee FC', 'Dundee', 'DND', 'Dundee', 1893, 6200, '#00285E', '#FFFFFF', '#FFFFFF', 'Dens Park', 11775, 'Dens Park', 12, 3.5, 235, 'Avoid relegation comfortably', 'Steven Pressley', '4-2-3-1', ['dundee-united'], 'Dundee F.C.'],
  ['falkirk', 'Falkirk FC', 'Falkirk', 'FAL', 'Falkirk', 1876, 6050, '#00285E', '#FFFFFF', '#FFFFFF', 'Falkirk Stadium', 7937, 'Falkirk Stadium', 10, 3, 210, 'Avoid relegation', 'John McGlynn', '4-2-3-1', ['livingston'], 'Falkirk F.C.'],
  ['livingston', 'Livingston FC', 'Livingston', 'LIV', 'Livingston', 1943, 6000, '#FFCC00', '#000000', '#111111', 'Almondvale Stadium', 9713, 'Almondvale Stadium', 9.5, 2.8, 200, 'Avoid relegation', 'David Martindale', '4-2-3-1', ['falkirk'], 'Livingston F.C.'],
]);

// ============================================================================
// 15. BELGIUM — BELGIAN PRO LEAGUE (16 clubs)
// ============================================================================
const BELGIAN_PRO_LEAGUE_CLUBS = buildLeagueClubs('belgian-pro-league', 'Belgium', [
  ['club-brugge', 'Club Brugge', 'Club Brugge', 'CLU', 'Bruges', 1891, 8050, '#0057B7', '#000000', '#FFFFFF', 'Jan Breydel Stadium', 29062, 'Jan Breydel Stadium', 95, 38, 1150, 'Win the Pro League title', 'Nicky Hayen', '4-2-3-1', ['anderlecht', 'cercle-brugge', 'gent'], 'Club Brugge KV'],
  ['union-sg', 'Royale Union Saint-Gilloise', 'Union SG', 'USG', 'Brussels', 1897, 7900, '#FFDD00', '#0055A4', '#00306B', 'Stade Joseph Marien', 9400, 'Joseph Marien Stadium', 72, 28, 880, 'Challenge for the title', 'Sebastien Pocognoli', '3-5-2', ['anderlecht', 'club-brugge'], 'Royale Union Saint-Gilloise'],
  ['anderlecht', 'RSC Anderlecht', 'Anderlecht', 'AND', 'Brussels', 1908, 7850, '#5A2D82', '#FFFFFF', '#FFFFFF', 'Lotto Park', 21500, 'Constant Vanden Stock Stadium', 76, 30, 980, 'Challenge for the title', 'Besnik Hasi', '4-2-3-1', ['club-brugge', 'union-sg', 'standard-liege'], 'R.S.C. Anderlecht'],
  ['genk', 'KRC Genk', 'KRC Genk', 'GNK', 'Genk', 1988, 7750, '#0057B7', '#FFFFFF', '#FFFFFF', 'Cegeka Arena', 23718, 'Cegeka Arena', 74, 30, 860, 'Challenge for the title', 'Thorsten Fink', '4-2-3-1', ['sint-truiden', 'standard-liege'], 'K.R.C. Genk'],
  ['gent', 'KAA Gent', 'KAA Gent', 'GNT', 'Ghent', 1900, 7500, '#0057B7', '#FFFFFF', '#FFFFFF', 'Planet Group Arena', 20000, 'Ghelamco Arena', 55, 22, 740, 'Qualify for Champions Playoffs', 'Ivan Leko', '3-5-2', ['club-brugge'], 'K.A.A. Gent'],
  ['antwerp', 'Royal Antwerp FC', 'Antwerp', 'ANT', 'Antwerp', 1880, 7550, '#E30613', '#FFFFFF', '#FFFFFF', 'Bosuilstadion', 16144, 'Bosuilstadion', 58, 22, 780, 'Qualify for Champions Playoffs', 'Stef Wils', '4-2-3-1', ['club-brugge', 'mechelen'], 'Royal Antwerp F.C.'],
  ['standard-liege', 'Standard Liege', 'Standard', 'STA', 'Liege', 1898, 7200, '#E30613', '#FFFFFF', '#FFFFFF', 'Stade Maurice Dufrasne', 27670, 'Stade Maurice Dufrasne', 35, 12, 580, 'Reach the top six', 'Mircea Rednic', '3-5-2', ['anderlecht', 'charleroi'], 'Standard Liège'],
  ['charleroi', 'Royal Charleroi SC', 'Charleroi', 'CHA', 'Charleroi', 1904, 7000, '#000000', '#FFFFFF', '#FFFFFF', 'Stade du Pays de Charleroi', 15000, 'Stade du Pays de Charleroi', 28, 10, 460, 'Finish in the top half', 'Rik De Mil', '4-2-3-1', ['standard-liege'], 'R. Charleroi S.C.'],
  ['mechelen', 'KV Mechelen', 'Mechelen', 'KVM', 'Mechelen', 1904, 7000, '#FFCC00', '#E30613', '#8B0000', 'AFAS Stadion', 16672, 'Achter de Kazerne', 27, 9.5, 450, 'Finish in the top half', 'Frederik Vanderbiest', '3-5-2', ['antwerp'], 'K.V. Mechelen'],
  ['westerlo', 'KVC Westerlo', 'Westerlo', 'WES', 'Westerlo', 1933, 6950, '#FFDD00', '#0055A4', '#00306B', 'Het Kuipje', 8035, 'Het Kuipje', 29, 11, 460, 'Finish in the top half', 'Issame Charai', '4-2-3-1', ['mechelen'], 'K.V.C. Westerlo'],
  ['oh-leuven', 'OH Leuven', 'OH Leuven', 'OHL', 'Leuven', 2002, 6850, '#FFFFFF', '#000000', '#111111', 'King Power at Den Dreef', 10020, 'Den Dreef', 26, 9, 430, 'Achieve a mid-table finish', 'David Hubert', '4-2-3-1', ['mechelen'], 'Oud-Heverlee Leuven'],
  ['sint-truiden', 'Sint-Truidense VV', 'STVV', 'STV', 'Sint-Truiden', 1924, 6800, '#FFDD00', '#0055A4', '#00306B', 'Stayen', 14600, 'Stayen', 24, 8, 410, 'Achieve a mid-table finish', 'Wouter Vrancken', '3-5-2', ['genk'], 'Sint-Truidense V.V.'],
  ['cercle-brugge', 'Cercle Brugge', 'Cercle', 'CER', 'Bruges', 1899, 6900, '#008A45', '#000000', '#FFFFFF', 'Jan Breydel Stadium', 29062, 'Jan Breydel Stadium', 26, 9, 420, 'Achieve a mid-table finish', 'Onur Cinel', '4-2-3-1', ['club-brugge'], 'Cercle Brugge K.S.V.'],
  ['dender', 'FCV Dender EH', 'Dender', 'DEN', 'Denderleeuw', 2005, 6500, '#0055A4', '#000000', '#FFFFFF', 'Dender Football Complex', 6429, 'Florent Beeckmanstadion', 16, 5, 310, 'Avoid relegation', 'Vincent Euvrard', '3-5-2', ['gent'], 'F.C.V. Dender E.H.'],
  ['zulte-waregem', 'SV Zulte Waregem', 'Zulte War.', 'ZWA', 'Waregem', 2001, 6600, '#7A1C24', '#008A45', '#FFFFFF', 'Elindus Arena', 12414, 'Regenboogstadion', 18, 6, 340, 'Avoid relegation', 'Sven Vandenbroeck', '4-2-3-1', ['gent'], 'S.V. Zulte Waregem'],
  ['raal-la-louviere', 'RAAL La Louviere', 'La Louviere', 'RAA', 'La Louviere', 2017, 6400, '#008A45', '#FFFFFF', '#FFFFFF', 'Easi Arena', 8050, 'Stade du Tivoli', 14, 4.5, 290, 'Avoid relegation', 'Frederic Taquin', '3-5-2', ['charleroi'], 'RAAL La Louvière'],
]);

// ============================================================================
// 16. CROATIA — SUPERSPORT HNL (10 clubs)
// ============================================================================
const SUPERSPORT_HNL_CLUBS = buildLeagueClubs('supersport-hnl', 'Croatia', [
  ['dinamo-zagreb', 'GNK Dinamo Zagreb', 'Dinamo', 'DIN', 'Zagreb', 1911, 7550, '#0055A4', '#FFFFFF', '#FFFFFF', 'Stadion Maksimir', 24851, 'Stadion Maksimir', 52, 20, 680, 'Win the SuperSport HNL title', 'Mario Kovacevic', '4-2-3-1', ['hajduk-split', 'rijeka'], 'GNK Dinamo Zagreb'],
  ['hajduk-split', 'HNK Hajduk Split', 'Hajduk', 'HAJ', 'Split', 1911, 7200, '#FFFFFF', '#0055A4', '#003870', 'Stadion Poljud', 33987, 'Stadion Poljud', 30, 10, 480, 'Win the SuperSport HNL title', 'Gonzalo Garcia', '4-2-3-1', ['dinamo-zagreb', 'rijeka'], 'HNK Hajduk Split'],
  ['rijeka', 'HNK Rijeka', 'Rijeka', 'RIJ', 'Rijeka', 1946, 7100, '#FFFFFF', '#009FE3', '#005587', 'Stadion Rujevica', 8191, 'Stadion Rujevica', 26, 9, 410, 'Challenge for the title', 'Radomir Dalovic', '4-2-3-1', ['hajduk-split', 'dinamo-zagreb', 'istra-1961'], 'HNK Rijeka'],
  ['osijek', 'NK Osijek', 'Osijek', 'OSI', 'Osijek', 1947, 6700, '#0057B7', '#FFFFFF', '#FFFFFF', 'Opus Arena', 13005, 'Opus Arena', 22, 7.5, 340, 'Qualify for European football', 'Simon Rozman', '4-2-3-1', ['dinamo-zagreb', 'hajduk-split'], 'NK Osijek'],
  ['varazdin', 'NK Varazdin', 'Varazdin', 'VAR', 'Varazdin', 2012, 6250, '#0055A4', '#FFFFFF', '#FFFFFF', 'Stadion Varteks', 8850, 'Stadion Varteks', 11, 3.2, 210, 'Finish in the top half', 'Nikola Safaric', '4-2-3-1', ['slaven-belupo'], 'NK Varaždin (2012)'],
  ['slaven-belupo', 'NK Slaven Belupo', 'Slaven', 'SLA', 'Koprivnica', 1907, 6200, '#0057B7', '#FFFFFF', '#FFFFFF', 'Gradski stadion Ivan Kusek-Apas', 3205, 'Gradski stadion (Koprivnica)', 10, 2.8, 195, 'Finish in the top half', 'Mario Gregurina', '4-2-3-1', ['varazdin'], 'NK Slaven Belupo'],
  ['istra-1961', 'NK Istra 1961', 'Istra 1961', 'IST', 'Pula', 1948, 6200, '#FFDD00', '#008A45', '#005A2B', 'Stadion Aldo Drosina', 9800, 'Stadion Aldo Drosina', 11, 3.2, 200, 'Consolidate mid-table status', 'Goran Tomic', '4-3-3', ['rijeka'], 'NK Istra 1961'],
  ['lokomotiva-zagreb', 'NK Lokomotiva Zagreb', 'Lokomotiva', 'LOK', 'Zagreb', 1914, 6150, '#0057B7', '#FFFFFF', '#FFFFFF', 'Stadion Kranjceviceva', 5350, 'Stadion Kranjčevićeva', 10, 2.8, 190, 'Consolidate mid-table status', 'Nikica Jelavic', '4-2-3-1', ['dinamo-zagreb'], 'NK Lokomotiva'],
  ['gorica-cro', 'HNK Gorica', 'HNK Gorica', 'HGO', 'Velika Gorica', 2009, 5950, '#E30613', '#000000', '#FFFFFF', 'Gradski stadion Velika Gorica', 5200, 'Stadion Radnik', 8, 2.2, 165, 'Avoid relegation', 'Mario Carevic', '4-2-3-1', ['lokomotiva-zagreb'], 'HNK Gorica'],
  ['vukovar-1991', 'HNK Vukovar 1991', 'Vukovar', 'VUK', 'Vukovar', 2012, 5750, '#0055A4', '#FFFFFF', '#FFFFFF', 'Gradski stadion Borovo Naselje', 3550, 'Vukovar', 6.5, 1.8, 145, 'Avoid relegation', 'Gordon Schildenfeld', '4-2-3-1', ['osijek'], 'HNK Vukovar 1991'],
]);

// ============================================================================
// 17. AUSTRIA — AUSTRIAN BUNDESLIGA (12 clubs)
// ============================================================================
const AUSTRIAN_BUNDESLIGA_CLUBS = buildLeagueClubs('austrian-bundesliga', 'Austria', [
  ['red-bull-salzburg', 'FC Red Bull Salzburg', 'RB Salzburg', 'RBS', 'Salzburg', 1933, 7950, '#DD0741', '#FFFFFF', '#FFFFFF', 'Red Bull Arena', 30188, 'Red Bull Arena (Salzburg)', 105, 42, 1150, 'Win the Austrian Bundesliga', 'Thomas Letsch', '4-4-2-diamond', ['sturm-graz', 'rapid-wien'], 'FC Red Bull Salzburg'],
  ['sturm-graz', 'SK Sturm Graz', 'Sturm Graz', 'STU', 'Graz', 1909, 7750, '#000000', '#FFFFFF', '#FFFFFF', 'Merkur Arena', 16364, 'Liebenauer Stadium', 64, 24, 780, 'Win the Austrian Bundesliga', 'Jurgen Saumel', '4-4-2-diamond', ['grazer-ak', 'red-bull-salzburg'], 'SK Sturm Graz'],
  ['rapid-wien', 'SK Rapid Wien', 'Rapid Wien', 'RAP', 'Vienna', 1899, 7450, '#008A45', '#FFFFFF', '#FFFFFF', 'Allianz Stadion', 28600, 'Allianz Stadion', 46, 16, 650, 'Qualify for European football', 'Peter Stoger', '4-2-3-1', ['austria-wien', 'red-bull-salzburg'], 'SK Rapid Wien'],
  ['austria-wien', 'FK Austria Wien', 'Austria W.', 'FAK', 'Vienna', 1911, 7350, '#5A2D82', '#FFFFFF', '#FFFFFF', 'Generali Arena', 17500, 'Franz Horr Stadium', 38, 13, 560, 'Qualify for European football', 'Stephan Helm', '3-5-2', ['rapid-wien'], 'FK Austria Wien'],
  ['lask', 'LASK', 'LASK', 'LAS', 'Linz', 1908, 7300, '#000000', '#FFFFFF', '#FFFFFF', 'Raiffeisen Arena', 19080, 'Raiffeisen Arena (Linz)', 42, 15, 580, 'Qualify for European football', 'Joao Sacramento', '4-2-3-1', ['blau-weiss-linz'], 'LASK'],
  ['wolfsberger-ac', 'Wolfsberger AC', 'WAC', 'WAC', 'Wolfsberg', 1931, 6950, '#000000', '#FFFFFF', '#FFFFFF', 'Lavanttal-Arena', 7300, 'Lavanttal-Arena', 24, 8, 380, 'Reach the Championship Group', 'Dietmar Kuhbauer', '3-5-2', ['sturm-graz'], 'Wolfsberger AC'],
  ['blau-weiss-linz', 'FC Blau-Weiss Linz', 'BW Linz', 'BWL', 'Linz', 1997, 6650, '#0057B7', '#FFFFFF', '#FFFFFF', 'Hofmann Personal Stadion', 5595, 'Hofmann Personal Stadion', 16, 5, 290, 'Finish in the top half', 'Mitja Morec', '3-5-2', ['lask'], 'FC Blau-Weiß Linz'],
  ['tsv-hartberg', 'TSV Hartberg', 'Hartberg', 'HAR', 'Hartberg', 1946, 6600, '#0055A4', '#FFFFFF', '#FFFFFF', 'Profertil Arena Hartberg', 5024, 'Stadion Hartberg', 15, 4.5, 280, 'Consolidate mid-table status', 'Manfred Schmid', '4-2-3-1', ['sturm-graz'], 'TSV Hartberg'],
  ['wsg-tirol', 'WSG Tirol', 'WSG Tirol', 'WSG', 'Wattens', 1930, 6450, '#008A45', '#FFFFFF', '#FFFFFF', 'Tivoli Stadion Tirol', 16008, 'Tivoli Stadion Tirol', 14, 4, 260, 'Avoid relegation comfortably', 'Philipp Semlic', '3-5-2', ['scr-altach'], 'WSG Tirol'],
  ['grazer-ak', 'Grazer AK', 'GAK', 'GAK', 'Graz', 1902, 6450, '#E30613', '#FFFFFF', '#FFFFFF', 'Merkur Arena', 16364, 'Liebenauer Stadium', 14, 4.2, 265, 'Avoid relegation', 'Ferdinand Feldhofer', '3-5-2', ['sturm-graz'], 'Grazer AK'],
  ['scr-altach', 'SCR Altach', 'Altach', 'ALT', 'Altach', 1929, 6400, '#000000', '#FFFFFF', '#FFFFFF', 'Stadion Schnabelholz', 8500, 'Stadion Schnabelholz', 13, 3.8, 250, 'Avoid relegation', 'Fabio Ingolitsch', '4-2-3-1', ['wsg-tirol'], 'SC Rheindorf Altach'],
  ['sv-ried', 'SV Ried', 'SV Ried', 'RIE', 'Ried im Innkreis', 1912, 6350, '#008A45', '#000000', '#FFFFFF', 'Innviertel Arena', 7300, 'Keine Sorgen Arena', 12, 3.5, 240, 'Avoid relegation', 'Maximilian Senft', '3-5-2', ['lask'], 'SV Ried'],
]);

// ============================================================================
// 18. TURKEY — SUPER LIG (18 clubs)
// ============================================================================
const SUPER_LIG_CLUBS = buildLeagueClubs('super-lig', 'Turkey', [
  ['galatasaray', 'Galatasaray', 'Galatasaray', 'GAL', 'Istanbul', 1905, 8450, '#A90432', '#FDB912', '#FFFFFF', 'RAMS Park', 52600, 'Rams Park', 145, 65, 2150, 'Win the Super Lig title', 'Okan Buruk', '4-2-3-1', ['fenerbahce', 'besiktas', 'trabzonspor'], 'Galatasaray S.K. (football)'],
  ['fenerbahce', 'Fenerbahce', 'Fenerbahce', 'FEN', 'Istanbul', 1907, 8400, '#002D72', '#FFED00', '#FFED00', 'Ulker Stadium', 47834, 'Şükrü Saracoğlu Stadium', 140, 62, 2100, 'Win the Super Lig title', 'Jose Mourinho', '4-2-3-1', ['galatasaray', 'besiktas', 'trabzonspor'], 'Fenerbahçe S.K. (football)'],
  ['besiktas', 'Besiktas', 'Besiktas', 'BJK', 'Istanbul', 1903, 7950, '#000000', '#FFFFFF', '#FFFFFF', 'Tupras Stadium', 42590, 'Beşiktaş Stadium', 95, 40, 1450, 'Challenge for the title', 'Ole Gunnar Solskjaer', '4-2-3-1', ['galatasaray', 'fenerbahce'], 'Beşiktaş J.K.'],
  ['trabzonspor', 'Trabzonspor', 'Trabzonspor', 'TS', 'Trabzon', 1967, 7650, '#811234', '#3BB9FF', '#FFFFFF', 'Papara Park', 40782, 'Şenol Güneş Sports Complex', 68, 28, 1050, 'Qualify for European football', 'Fatih Tekke', '4-2-3-1', ['fenerbahce', 'galatasaray'], 'Trabzonspor'],
  ['basaksehir', 'Istanbul Basaksehir', 'Basaksehir', 'BAS', 'Istanbul', 1990, 7400, '#F37021', '#1D2951', '#FFFFFF', 'Basaksehir Fatih Terim Stadium', 17156, 'Başakşehir Fatih Terim Stadium', 52, 20, 820, 'Qualify for European football', 'Cagdas Atan', '4-3-3', ['galatasaray', 'fenerbahce'], 'İstanbul Başakşehir F.K.'],
  ['samsunspor', 'Samsunspor', 'Samsunspor', 'SAM', 'Samsun', 1965, 7250, '#E30613', '#FFFFFF', '#FFFFFF', 'Samsun 19 Mayis Stadium', 33919, 'Samsun 19 Mayıs Stadium', 40, 15, 620, 'Qualify for European football', 'Thomas Reis', '4-2-3-1', ['trabzonspor'], 'Samsunspor'],
  ['eyupspor', 'Eyupspor', 'Eyupspor', 'EYU', 'Istanbul', 1919, 7100, '#5A2D82', '#FFDD00', '#FFFFFF', 'Recep Tayyip Erdogan Stadium', 14234, 'Recep Tayyip Erdoğan Stadium', 34, 12, 540, 'Finish in the top half', 'Selcuk Sahin', '4-2-3-1', ['kasimpasa'], 'Eyüpspor'],
  ['goztepe', 'Goztepe SK', 'Goztepe', 'GOZ', 'Izmir', 1925, 7150, '#FFCC00', '#E30613', '#8B0000', 'Gursel Aksel Stadium', 19713, 'Gürsel Aksel Stadium', 38, 14, 560, 'Finish in the top half', 'Stanimir Stoilov', '3-5-2', ['fenerbahce'], 'Göztepe S.K.'],
  ['kasimpasa', 'Kasimpasa SK', 'Kasimpasa', 'KAS', 'Istanbul', 1921, 6950, '#004A99', '#FFFFFF', '#FFFFFF', 'Recep Tayyip Erdogan Stadium', 14234, 'Recep Tayyip Erdoğan Stadium', 28, 10, 480, 'Achieve a mid-table finish', 'Shota Arveladze', '4-2-3-1', ['eyupspor', 'fatih-karagumruk'], 'Kasımpaşa S.K.'],
  ['konyaspor', 'Konyaspor', 'Konyaspor', 'KON', 'Konya', 1922, 6950, '#008A45', '#FFFFFF', '#FFFFFF', 'Medas Konya Buyuksehir Stadium', 42000, 'Konya Metropolitan Municipality Stadium', 28, 9.5, 480, 'Achieve a mid-table finish', 'Recep Ucar', '4-2-3-1', ['kayserispor'], 'Konyaspor'],
  ['rizespor', 'Caykur Rizespor', 'Rizespor', 'RIZ', 'Rize', 1953, 6900, '#008A45', '#0055A4', '#FFFFFF', 'Caykur Didi Stadium', 15332, 'Çaykur Didi Stadium', 26, 9, 460, 'Achieve a mid-table finish', 'Ilhan Palut', '4-2-3-1', ['trabzonspor'], 'Çaykur Rizespor'],
  ['antalyaspor', 'Antalyaspor', 'Antalyaspor', 'ANT', 'Antalya', 1966, 6900, '#E30613', '#FFFFFF', '#FFFFFF', 'Corendon Airlines Park', 29307, 'Antalya Stadium', 26, 9, 460, 'Achieve a mid-table finish', 'Emre Belozoglu', '4-2-3-1', ['alanyaspor'], 'Antalyaspor'],
  ['gaziantep-fk', 'Gaziantep FK', 'Gaziantep', 'GFK', 'Gaziantep', 1988, 6800, '#E30613', '#000000', '#FFFFFF', 'Gaziantep Stadium', 33502, 'Gaziantep Stadium', 23, 8, 420, 'Avoid relegation comfortably', 'Ismet Tasdemir', '4-2-3-1', ['kayserispor'], 'Gaziantep F.K.'],
  ['alanyaspor', 'Alanyaspor', 'Alanyaspor', 'ALA', 'Alanya', 1948, 6800, '#F37021', '#008A45', '#FFFFFF', 'Gain Park Stadium', 10128, 'Bahçeşehir Okulları Stadium', 23, 8, 420, 'Avoid relegation comfortably', 'Joao Pereira', '4-2-3-1', ['antalyaspor'], 'Alanyaspor'],
  ['kayserispor', 'Kayserispor', 'Kayserispor', 'KAY', 'Kayseri', 1966, 6750, '#FFCC00', '#E30613', '#8B0000', 'RHG Enerturk Enerji Stadium', 32864, 'Kadir Has Stadium', 22, 7.5, 410, 'Avoid relegation comfortably', 'Markus Gisdol', '4-2-3-1', ['konyaspor'], 'Kayserispor'],
  ['kocaelispor', 'Kocaelispor', 'Kocaelispor', 'KOC', 'Izmit', 1966, 6700, '#008A45', '#000000', '#FFFFFF', 'Kocaeli Stadium', 34829, 'Kocaeli Stadium', 24, 8.5, 420, 'Avoid relegation', 'Selcuk Inan', '4-2-3-1', ['besiktas'], 'Kocaelispor'],
  ['genclerbirligi', 'Genclerbirligi', 'Genclerb.', 'GEN', 'Ankara', 1923, 6600, '#E30613', '#000000', '#FFFFFF', 'Eryaman Stadium', 20560, 'Eryaman Stadium', 20, 7, 380, 'Avoid relegation', 'Huseyin Eroglu', '4-2-3-1', ['konyaspor'], 'Gençlerbirliği S.K.'],
  ['fatih-karagumruk', 'Fatih Karagumruk', 'Karagumruk', 'KAR', 'Istanbul', 1926, 6600, '#E30613', '#000000', '#FFFFFF', 'Ataturk Olympic Stadium', 74753, 'Atatürk Olympic Stadium', 20, 7, 380, 'Avoid relegation', 'Marcel Licka', '4-2-3-1', ['kasimpasa'], 'Fatih Karagümrük S.K.'],
]);

export const CLUBS_SEED: ClubSeed[] = [
  ...PREMIER_LEAGUE_CLUBS,
  ...EFL_CHAMPIONSHIP_CLUBS,
  ...LA_LIGA_CLUBS,
  ...SEGUNDA_CLUBS,
  ...SERIE_A_CLUBS,
  ...SERIE_B_CLUBS,
  ...BUNDESLIGA_CLUBS,
  ...BUNDESLIGA_2_CLUBS,
  ...LIGUE_1_CLUBS,
  ...PRVALIGA_CLUBS,
  ...SLOVENIA_2SNL_CLUBS,
  ...EREDIVISIE_CLUBS,
  ...PRIMEIRA_LIGA_CLUBS,
  ...SCOTTISH_PREMIERSHIP_CLUBS,
  ...BELGIAN_PRO_LEAGUE_CLUBS,
  ...SUPERSPORT_HNL_CLUBS,
  ...AUSTRIAN_BUNDESLIGA_CLUBS,
  ...SUPER_LIG_CLUBS,
];
