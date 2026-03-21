/**
 * CC/ASDI Table Builder - Shared module for matchup pages
 * Imports FightCore data and renders CC/ASDI reference tables.
 * Usage: import { buildCCTables } from '../cc-table-builder.js';
 *        buildCCTables(containerId, foxCharId, opponentCharId, opponentName);
 */
import { FightCore } from './fightcore.js';

const fc = new FightCore();

// Character display names for table headers
const CHAR_DISPLAY = {
    0: 'Captain Falcon', 1: 'Donkey Kong', 2: 'Fox', 3: 'Mr. Game & Watch',
    4: 'Kirby', 5: 'Bowser', 6: 'Link', 7: 'Luigi', 8: 'Mario',
    9: 'Marth', 10: 'Mewtwo', 11: 'Ness', 12: 'Peach', 13: 'Pikachu',
    14: 'Ice Climbers', 15: 'Jigglypuff', 16: 'Samus', 17: 'Yoshi',
    18: 'Zelda', 19: 'Sheik', 20: 'Falco', 21: 'Young Link',
    22: 'Dr. Mario', 23: 'Roy', 24: 'Pichu', 25: 'Ganondorf',
};

function fmtPct(val) {
    if (val >= 999) return '∞';
    if (val < 0) return '✗';
    return val + '%';
}

function fmtColor(val, type) {
    if (val >= 999) return type === 'cc' ? '#2a7' : '#47a';
    if (val < 0) return '#a33';
    return type === 'cc' ? '#3a3' : '#38a';
}

async function renderPairTable(atkId, defId, atkLabel, defLabel) {
    await fc.getMoves(atkId);
    const ccData = await fc.getCCPercents(atkId, defId);
    if (!ccData || !ccData.length) return '';

    const useful = ccData
        .filter(m => m.ccMaxPercent > 0 && m.ccMaxPercent < 999)
        .sort((a, b) => b.ccMaxPercent - a.ccMaxPercent);
    if (!useful.length) return '';

    let html = `<div class="cc-pair-header">${atkLabel} → ${defLabel}</div>`;
    html += `<table class="cc-table"><thead><tr>`;
    html += `<th style="text-align:left">Move</th>`;
    html += `<th>Dmg</th>`;
    html += `<th class="cc-col">CC Max %</th>`;
    html += `<th class="asdi-col">ASDI↓ Max %</th>`;
    html += `</tr></thead><tbody>`;

    for (const m of useful) {
        const hitLabel = m.hitName && m.hitName !== 'unknown' ? ` (${m.hitName})` : '';
        html += `<tr>`;
        html += `<td class="move-name">${m.moveName}${hitLabel}</td>`;
        html += `<td class="dmg-cell">${m.damage}%</td>`;
        html += `<td class="cc-cell" style="color:${fmtColor(m.ccMaxPercent,'cc')}">${fmtPct(m.ccMaxPercent)}</td>`;
        html += `<td class="asdi-cell" style="color:${fmtColor(m.asdiMaxPercent,'asdi')}">${fmtPct(m.asdiMaxPercent)}</td>`;
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    return html;
}

export async function buildCCTables(containerId, foxId, opponentId, opponentName) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<p style="color:#888;text-align:center;padding:1rem;">Loading CC/ASDI data from FightCore...</p>';

    const foxName = CHAR_DISPLAY[foxId] || 'Fox';
    const oppName = opponentName || CHAR_DISPLAY[opponentId] || 'Opponent';

    try {
        await Promise.all([fc.getMoves(foxId), fc.getMoves(opponentId)]);

        let html = '';
        const isDitto = foxId === opponentId;

        if (isDitto) {
            // Ditto: same attacker/defender, only need one table
            const dittoTable = await renderPairTable(foxId, opponentId, foxName + ' (ditto)', foxName);
            if (dittoTable) html += `<div class="cc-pair-block">${dittoTable}</div>`;
        } else {
            // Fox attacking → Opponent defending (what can opponent CC/ASDI against Fox?)
            const foxAtk = await renderPairTable(foxId, opponentId, foxName, oppName);
            // Opponent attacking → Fox defending (what can Fox CC/ASDI against opponent?)
            const oppAtk = await renderPairTable(opponentId, foxId, oppName, foxName);

            if (foxAtk) html += `<div class="cc-pair-block">${foxAtk}</div>`;
            if (oppAtk) html += `<div class="cc-pair-block">${oppAtk}</div>`;
        }

        if (!html) {
            container.innerHTML = '<p style="color:#888;text-align:center;padding:1rem;">No CC/ASDI data available for this matchup.</p>';
            return;
        }

        html += `<p class="cc-attribution">Calculated from <a href="https://github.com/FightCore/frame-data" target="_blank">FightCore</a> hitbox data using Melee KB formula · CC mult=⅔ · ASDI↓ mult=1.0 · knockdown threshold=80</p>`;
        container.innerHTML = html;
    } catch (e) {
        console.error('CC table build error:', e);
        container.innerHTML = '<p style="color:#a33;text-align:center;padding:1rem;">Failed to load CC/ASDI data.</p>';
    }
}
