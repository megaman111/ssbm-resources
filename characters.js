/**
 * characters.js — single source of truth for Melee characters.
 *
 * `id` is the Slippi external character ID (0–25), the same ID found in .slp
 * replay settings. `name` is the value stored in player-notes.json, so do not
 * rename existing entries without migrating notes.
 *
 * Icons are self-hosted stock icons in img/stocks/ (from the Slippi Launcher repo).
 */

export const CHARACTERS = [
    { id: 0,  name: 'Captain Falcon', short: 'Falcon', slug: 'captain_falcon' },
    { id: 1,  name: 'Donkey Kong',    short: 'DK',     slug: 'donkey_kong' },
    { id: 2,  name: 'Fox',            short: 'Fox',    slug: 'fox' },
    { id: 3,  name: 'Game & Watch',   short: 'G&W',    slug: 'game_and_watch' },
    { id: 4,  name: 'Kirby',          short: 'Kirby',  slug: 'kirby' },
    { id: 5,  name: 'Bowser',         short: 'Bowser', slug: 'bowser' },
    { id: 6,  name: 'Link',           short: 'Link',   slug: 'link' },
    { id: 7,  name: 'Luigi',          short: 'Luigi',  slug: 'luigi' },
    { id: 8,  name: 'Mario',          short: 'Mario',  slug: 'mario' },
    { id: 9,  name: 'Marth',          short: 'Marth',  slug: 'marth' },
    { id: 10, name: 'Mewtwo',         short: 'Mewtwo', slug: 'mewtwo' },
    { id: 11, name: 'Ness',           short: 'Ness',   slug: 'ness' },
    { id: 12, name: 'Peach',          short: 'Peach',  slug: 'peach' },
    { id: 13, name: 'Pikachu',        short: 'Pika',   slug: 'pikachu' },
    { id: 14, name: 'Ice Climbers',   short: 'ICs',    slug: 'ice_climbers' },
    { id: 15, name: 'Jigglypuff',     short: 'Puff',   slug: 'jigglypuff' },
    { id: 16, name: 'Samus',          short: 'Samus',  slug: 'samus' },
    { id: 17, name: 'Yoshi',          short: 'Yoshi',  slug: 'yoshi' },
    { id: 18, name: 'Zelda',          short: 'Zelda',  slug: 'zelda' },
    { id: 19, name: 'Sheik',          short: 'Sheik',  slug: 'sheik' },
    { id: 20, name: 'Falco',          short: 'Falco',  slug: 'falco' },
    { id: 21, name: 'Young Link',     short: 'YL',     slug: 'young_link' },
    { id: 22, name: 'Dr. Mario',      short: 'Doc',    slug: 'dr_mario' },
    { id: 23, name: 'Roy',            short: 'Roy',    slug: 'roy' },
    { id: 24, name: 'Pichu',          short: 'Pichu',  slug: 'pichu' },
    { id: 25, name: 'Ganondorf',      short: 'Ganon',  slug: 'ganondorf' },
];

// Display order for menus and filters: roughly by competitive relevance,
// then the rest alphabetically. Change freely — nothing depends on it.
const MENU_ORDER = [
    'Fox', 'Falco', 'Marth', 'Sheik', 'Jigglypuff', 'Peach', 'Captain Falcon',
    'Ice Climbers', 'Samus', 'Pikachu', 'Yoshi', 'Luigi', 'Dr. Mario', 'Ganondorf',
    'Donkey Kong', 'Link', 'Young Link', 'Mario', 'Roy', 'Mewtwo', 'Zelda',
    'Game & Watch', 'Ness', 'Kirby', 'Bowser', 'Pichu',
];

export const CHARACTERS_MENU = MENU_ORDER.map(n => CHARACTERS.find(c => c.name === n));

const byName = new Map(CHARACTERS.map(c => [c.name, c]));

/** Icon path for a character name. `base` is the path prefix to the site root (e.g. '../' from /matchups). */
export function charIcon(name, base = '') {
    const c = byName.get(name);
    return c ? `${base}img/stocks/${c.slug}.png` : '';
}

export function charByName(name) { return byName.get(name) || null; }
export function charById(id) { return CHARACTERS[id] || null; }
