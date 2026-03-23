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
    if (val >= 999) return 'Never';
    if (val < 0) return 'N/A';
    return val + '%';
}

function cellClass(val) {
    if (val >= 999) return 'cc-never';   // never breaks — safe forever
    if (val < 0) return 'cc-na';         // can't CC (angle or always breaks)
    if (val === 0) return 'cc-zero';     // breaks at 0% — basically useless
    if (val <= 30) return 'cc-low';      // low window
    if (val <= 80) return 'cc-mid';      // decent window
    return 'cc-high';                    // great CC window
}

async function renderPairTable(atkId, defId, atkLabel, defLabel) {
    await fc.getMoves(atkId);
    const ccData = await fc.getCCPercents(atkId, defId);
    if (!ccData || !ccData.length) return '';

    // Show ALL hits — sort by ASDI max % descending (most useful first),
    // with "Never" (999) at top, then by percent desc, then N/A (-1) at bottom
    const sorted = ccData.slice().sort((a, b) => {
        // Primary: sort by ASDI max percent for practical usefulness
        // "Never breaks" (999) = best for defender, show first
        // "N/A" (-1) = can't ASDI, show last
        const aVal = a.asdiMaxPercent;
        const bVal = b.asdiMaxPercent;
        // Both "never" — sort by move name
        if (aVal >= 999 && bVal >= 999) return a.moveName.localeCompare(b.moveName);
        // "Never" goes first
        if (aVal >= 999) return -1;
        if (bVal >= 999) return 1;
        // "N/A" goes last
        if (aVal < 0 && bVal < 0) return a.moveName.localeCompare(b.moveName);
        if (aVal < 0) return 1;
        if (bVal < 0) return -1;
        // Higher ASDI % = more useful for defender, show first
        if (bVal !== aVal) return bVal - aVal;
        return a.moveName.localeCompare(b.moveName);
    });

    if (!sorted.length) return '';

    let html = `<div class="cc-pair-header">${atkLabel} → ${defLabel}</div>`;
    html += `<table class="cc-table"><thead><tr>`;
    html += `<th style="text-align:left">Move</th>`;
    html += `<th>Dmg</th>`;
    html += `<th class="cc-col">CC Max %</th>`;
    html += `<th class="asdi-col">ASDI↓ Max %</th>`;
    html += `</tr></thead><tbody>`;

    for (const m of sorted) {
        const hitLabel = m.hitName && m.hitName !== 'unknown' ? ` (${m.hitName})` : '';
        const ccCls = cellClass(m.ccMaxPercent);
        const asdiCls = cellClass(m.asdiMaxPercent);
        html += `<tr>`;
        html += `<td class="move-name">${m.moveName}${hitLabel}</td>`;
        html += `<td class="dmg-cell">${m.damage}%</td>`;
        html += `<td class="cc-cell ${ccCls}">${fmtPct(m.ccMaxPercent)}</td>`;
        html += `<td class="asdi-cell ${asdiCls}">${fmtPct(m.asdiMaxPercent)}</td>`;
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
            const dittoTable = await renderPairTable(foxId, opponentId, foxName + ' (ditto)', foxName);
            if (dittoTable) html += `<div class="cc-pair-block">${dittoTable}</div>`;
        } else {
            const foxAtk = await renderPairTable(foxId, opponentId, foxName, oppName);
            const oppAtk = await renderPairTable(opponentId, foxId, oppName, foxName);
            if (foxAtk) html += `<div class="cc-pair-block">${foxAtk}</div>`;
            if (oppAtk) html += `<div class="cc-pair-block">${oppAtk}</div>`;
        }

        if (!html) {
            container.innerHTML = '<p style="color:#888;text-align:center;padding:1rem;">No CC/ASDI data available for this matchup.</p>';
            return;
        }

        html += `<div class="cc-legend">
            <span class="cc-legend-item"><span class="cc-swatch cc-never"></span> Never breaks</span>
            <span class="cc-legend-item"><span class="cc-swatch cc-high"></span> 81%+</span>
            <span class="cc-legend-item"><span class="cc-swatch cc-mid"></span> 31-80%</span>
            <span class="cc-legend-item"><span class="cc-swatch cc-low"></span> 1-30%</span>
            <span class="cc-legend-item"><span class="cc-swatch cc-zero"></span> Breaks at 0%</span>
            <span class="cc-legend-item"><span class="cc-swatch cc-na"></span> N/A (angle)</span>
        </div>`;
        html += `<p class="cc-attribution">Calculated from <a href="https://github.com/FightCore/frame-data" target="_blank">FightCore</a> hitbox data using Melee KB formula · CC mult=⅔ · ASDI↓ mult=1.0 · knockdown threshold=80</p>`;
        container.innerHTML = html;
    } catch (e) {
        console.error('CC table build error:', e);
        container.innerHTML = '<p style="color:#a33;text-align:center;padding:1rem;">Failed to load CC/ASDI data.</p>';
    }
}
