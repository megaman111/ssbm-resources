/**
 * IKneeData Calculator UI — Embeddable Melee frame data calculator
 * Renders into any DOM container. Uses ikneedata-calc.js for computation.
 */
import {
    CHAR_NAMES, CHAR_PHYSICS, STAGES,
    fc, calcKnockback, calcHistun, calcHitlag, applyDI,
    resolveSakuraiAngle, kbToLaunchSpeed, simulateTrajectory,
    calcShieldStun, calcShieldAdvantage, assessCombo,
    fullCalc, findKillPercent, calcFromReplay,
} from './ikneedata-calc.js';

const CSS = `
.ikd-calc { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: rgba(30,30,50,0.95); border-radius: 12px; padding: 1rem; color: #e0e0e0; max-width: 520px; }
.ikd-calc * { box-sizing: border-box; }
.ikd-title { font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem; text-align: center; }
.ikd-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.ikd-field { flex: 1; min-width: 100px; }
.ikd-field label { display: block; font-size: 0.72rem; color: #aaa; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.ikd-field select, .ikd-field input { width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #444; border-radius: 6px; background: #1a1a2e; color: #e0e0e0; font-size: 0.85rem; }
.ikd-field select:focus, .ikd-field input:focus { border-color: #667eea; outline: none; }
.ikd-toggles { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.ikd-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: #bbb; cursor: pointer; }
.ikd-toggle input { accent-color: #667eea; }
.ikd-divider { border: none; border-top: 1px solid #333; margin: 0.6rem 0; }
.ikd-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.4rem; }
.ikd-result { background: rgba(102,126,234,0.1); border: 1px solid rgba(102,126,234,0.25); border-radius: 8px; padding: 0.4rem 0.6rem; text-align: center; }
.ikd-result .ikd-val { font-size: 1.1rem; font-weight: 700; color: #fff; }
.ikd-result .ikd-label { font-size: 0.65rem; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
.ikd-result.ikd-kill { border-color: #e44; }
.ikd-result.ikd-kill .ikd-val { color: #f66; }
.ikd-result.ikd-safe { border-color: #2a7; }
.ikd-result.ikd-safe .ikd-val { color: #3c8; }
.ikd-result.ikd-unsafe { border-color: #c44; }
.ikd-result.ikd-unsafe .ikd-val { color: #f66; }
.ikd-result.ikd-combo { border-color: #47a; }
.ikd-result.ikd-combo .ikd-val { color: #6af; }
.ikd-result.ikd-tumble { border-color: #c80; }
.ikd-result.ikd-tumble .ikd-val { color: #fa0; }
.ikd-manual-section { margin-top: 0.5rem; }
.ikd-manual-toggle { background: none; border: 1px solid #555; color: #aaa; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; }
.ikd-manual-toggle:hover { border-color: #667eea; color: #ccc; }
.ikd-manual-fields { display: none; margin-top: 0.5rem; }
.ikd-manual-fields.open { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.ikd-error { color: #f66; font-size: 0.8rem; text-align: center; padding: 0.5rem; }
.ikd-loading { color: #888; font-size: 0.8rem; text-align: center; padding: 0.5rem; }
`;

export class IKneeDataUI {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.options = options;
        this._moves = [];
        this._attackerCharId = options.attackerCharId ?? 2; // Fox default
        this._defenderCharId = options.defenderCharId ?? 2;
        this._stageKey = options.stageKey ?? 'final_destination';
        this._selectedMove = null;
        this._manualMode = false;
        this._init();
    }

    async _init() {
        // Inject scoped CSS
        if (!document.getElementById('ikd-calc-styles')) {
            const style = document.createElement('style');
            style.id = 'ikd-calc-styles';
            style.textContent = CSS;
            document.head.appendChild(style);
        }
        this._render();
        await this._loadMoves(this._attackerCharId);
        this._recalc();
    }

    _render() {
        const charOptions = Object.entries(CHAR_NAMES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, name]) => `<option value="${id}">${name}</option>`)
            .join('');

        const stageOptions = Object.entries(STAGES)
            .map(([key, s]) => `<option value="${key}">${s.name}</option>`)
            .join('');

        this.container.innerHTML = `
<div class="ikd-calc">
    <div class="ikd-title">⚔️ Melee Calculator</div>
    <div class="ikd-row">
        <div class="ikd-field"><label>Attacker</label>
            <select id="ikd-atk-char">${charOptions}</select></div>
        <div class="ikd-field"><label>Move</label>
            <select id="ikd-atk-move"><option value="">Loading...</option></select></div>
    </div>
    <div class="ikd-row">
        <div class="ikd-field"><label>Defender</label>
            <select id="ikd-def-char">${charOptions}</select></div>
        <div class="ikd-field" style="max-width:90px"><label>Percent</label>
            <input type="number" id="ikd-percent" value="0" min="0" max="999"></div>
        <div class="ikd-field"><label>Stage</label>
            <select id="ikd-stage">${stageOptions}</select></div>
    </div>
    <div class="ikd-row">
        <div class="ikd-field" style="max-width:90px"><label>Start X</label>
            <input type="number" id="ikd-startx" value="0" step="1"></div>
        <div class="ikd-field" style="max-width:90px"><label>Start Y</label>
            <input type="number" id="ikd-starty" value="0" step="1"></div>
        <div class="ikd-field" style="max-width:90px"><label>DI Angle</label>
            <input type="number" id="ikd-di" value="" placeholder="None" min="0" max="360"></div>
    </div>
    <div class="ikd-toggles">
        <label class="ikd-toggle"><input type="checkbox" id="ikd-cc"> Crouch Cancel</label>
        <label class="ikd-toggle"><input type="checkbox" id="ikd-charge"> Charged Smash</label>
    </div>
    <div class="ikd-manual-section">
        <button class="ikd-manual-toggle" id="ikd-manual-btn">Manual Entry ▸</button>
        <div class="ikd-manual-fields" id="ikd-manual-fields">
            <div class="ikd-field" style="max-width:80px"><label>Damage</label>
                <input type="number" id="ikd-m-dmg" value="0" step="0.1"></div>
            <div class="ikd-field" style="max-width:80px"><label>Angle</label>
                <input type="number" id="ikd-m-angle" value="45" min="0" max="361"></div>
            <div class="ikd-field" style="max-width:80px"><label>KBG</label>
                <input type="number" id="ikd-m-kbg" value="100"></div>
            <div class="ikd-field" style="max-width:80px"><label>BKB</label>
                <input type="number" id="ikd-m-bkb" value="0"></div>
            <div class="ikd-field" style="max-width:80px"><label>Set KB</label>
                <input type="number" id="ikd-m-setkb" value="0"></div>
        </div>
    </div>
    <hr class="ikd-divider">
    <div id="ikd-output" class="ikd-results">
        <div class="ikd-loading">Select a move to calculate...</div>
    </div>
</div>`;

        // Set defaults
        this._el('ikd-atk-char').value = this._attackerCharId;
        this._el('ikd-def-char').value = this._defenderCharId;
        this._el('ikd-stage').value = this._stageKey;

        // Bind events
        this._el('ikd-atk-char').addEventListener('change', () => this._onAttackerChange());
        this._el('ikd-atk-move').addEventListener('change', () => this._onMoveChange());
        this._el('ikd-def-char').addEventListener('change', () => { this._defenderCharId = +this._el('ikd-def-char').value; this._recalc(); });
        this._el('ikd-stage').addEventListener('change', () => { this._stageKey = this._el('ikd-stage').value; this._recalc(); });

        for (const id of ['ikd-percent', 'ikd-startx', 'ikd-starty', 'ikd-di', 'ikd-cc', 'ikd-charge']) {
            this._el(id).addEventListener('input', () => this._recalc());
        }

        // Manual mode
        this._el('ikd-manual-btn').addEventListener('click', () => {
            this._manualMode = !this._manualMode;
            this._el('ikd-manual-fields').classList.toggle('open', this._manualMode);
            this._el('ikd-manual-btn').textContent = this._manualMode ? 'Manual Entry ▾' : 'Manual Entry ▸';
        });
        for (const id of ['ikd-m-dmg', 'ikd-m-angle', 'ikd-m-kbg', 'ikd-m-bkb', 'ikd-m-setkb']) {
            this._el(id).addEventListener('input', () => { if (this._manualMode) this._recalc(); });
        }
    }

    _el(id) { return this.container.querySelector('#' + id); }

    async _loadMoves(charId) {
        const moveSelect = this._el('ikd-atk-move');
        moveSelect.innerHTML = '<option value="">Loading...</option>';
        try {
            this._moves = await fc.getMoves(charId);
            moveSelect.innerHTML = '<option value="">— Select Move —</option>';
            const seen = new Set();
            for (const m of this._moves) {
                if (!m.hits || !m.hits.length) continue;
                if (seen.has(m.normalizedName)) continue;
                seen.add(m.normalizedName);
                const opt = document.createElement('option');
                opt.value = m.normalizedName;
                opt.textContent = m.name;
                moveSelect.appendChild(opt);
            }
        } catch (e) {
            moveSelect.innerHTML = '<option value="">Failed to load — use manual entry</option>';
        }
    }

    async _onAttackerChange() {
        this._attackerCharId = +this._el('ikd-atk-char').value;
        await this._loadMoves(this._attackerCharId);
        this._selectedMove = null;
        this._recalc();
    }

    _onMoveChange() {
        const val = this._el('ikd-atk-move').value;
        if (!val) { this._selectedMove = null; this._recalc(); return; }
        const move = this._moves.find(m => m.normalizedName === val);
        this._selectedMove = move || null;
        if (move && move.hits && move.hits[0] && move.hits[0].hitboxes) {
            // Auto-fill manual fields with strongest hitbox
            let best = null;
            for (const hb of move.hits[0].hitboxes) {
                if (hb.damage > 0 && (!best || hb.damage > best.damage)) best = hb;
            }
            if (best) {
                this._el('ikd-m-dmg').value = best.damage;
                this._el('ikd-m-angle').value = best.angle;
                this._el('ikd-m-kbg').value = best.knockbackGrowth;
                this._el('ikd-m-bkb').value = best.baseKnockback;
                this._el('ikd-m-setkb').value = best.setKnockback || 0;
            }
        }
        this._recalc();
    }

    _getMoveParams() {
        if (this._manualMode || !this._selectedMove) {
            return {
                damage: +this._el('ikd-m-dmg').value || 0,
                angle: +this._el('ikd-m-angle').value || 0,
                kbg: +this._el('ikd-m-kbg').value || 0,
                bkb: +this._el('ikd-m-bkb').value || 0,
                setKb: +this._el('ikd-m-setkb').value || 0,
            };
        }
        const move = this._selectedMove;
        if (!move.hits || !move.hits[0] || !move.hits[0].hitboxes) return null;
        let best = null;
        for (const hb of move.hits[0].hitboxes) {
            if (hb.damage > 0 && (!best || hb.damage > best.damage)) best = hb;
        }
        if (!best) return null;
        return {
            damage: best.damage,
            angle: best.angle,
            kbg: best.knockbackGrowth,
            bkb: best.baseKnockback,
            setKb: best.setKnockback || 0,
        };
    }

    _recalc() {
        const output = this._el('ikd-output');
        const moveParams = this._getMoveParams();
        if (!moveParams || moveParams.damage === 0) {
            output.innerHTML = '<div class="ikd-loading">Select a move or enter values manually</div>';
            return;
        }

        const percent = +this._el('ikd-percent').value || 0;
        const startX = +this._el('ikd-startx').value || 0;
        const startY = +this._el('ikd-starty').value || 0;
        const diVal = this._el('ikd-di').value;
        const diAngle = diVal !== '' ? +diVal : null;
        const cc = this._el('ikd-cc').checked;
        const charge = this._el('ikd-charge').checked;

        const result = fullCalc({
            ...moveParams,
            percent,
            defenderCharId: this._defenderCharId,
            stageKey: this._stageKey,
            startX, startY,
            diAngle,
            crouchCancel: cc,
            chargeMultiplier: charge ? 1.3671 : 1.0,
        });

        if (!result) {
            output.innerHTML = '<div class="ikd-error">Could not calculate — check inputs</div>';
            return;
        }

        // Kill percent (async but we'll show what we have)
        const killData = findKillPercent({
            ...moveParams,
            defenderCharId: this._defenderCharId,
            stageKey: this._stageKey,
            startX, startY,
            crouchCancel: cc,
        });

        let html = '';
        html += this._resultCard('Knockback', result.knockback.toFixed(1), result.tumble ? 'ikd-tumble' : '');
        html += this._resultCard('Hitstun', result.hitstun + 'f', result.tumble ? 'ikd-tumble' : '');
        html += this._resultCard('Hitlag', result.hitlag + 'f', '');
        html += this._resultCard('Launch Speed', result.launchSpeed.toFixed(2), '');
        html += this._resultCard('Base Angle', result.launchAngle.baseAngle + '°', '');
        if (result.launchAngle.diAngle != null) {
            html += this._resultCard('DI Angle', result.launchAngle.diModifiedAngle + '°', '');
        }
        html += this._resultCard('Shield Stun', result.shieldStun + 'f', '');
        html += this._resultCard('Tumble', result.tumble ? 'Yes' : 'No', result.tumble ? 'ikd-tumble' : '');

        if (result.trajectory) {
            html += this._resultCard('Kills', result.trajectory.killed ? 'Yes (' + result.trajectory.killZone + ')' : 'No',
                result.trajectory.killed ? 'ikd-kill' : 'ikd-safe');
            if (result.trajectory.killed) {
                html += this._resultCard('Kill Frame', result.trajectory.killFrame + 'f', 'ikd-kill');
            }
        }

        // Kill percents
        if (killData.noDI != null) {
            html += this._resultCard('Kill % (no DI)', killData.noDI + '%', 'ikd-kill');
        }
        if (killData.survivalDI != null) {
            html += this._resultCard('Kill % (surv DI)', killData.survivalDI + '%', 'ikd-kill');
        }
        if (killData.noDI == null && killData.survivalDI == null && killData.killPercent == null) {
            html += this._resultCard('Kill %', "Doesn't kill", 'ikd-safe');
        }

        output.innerHTML = html;
    }

    _resultCard(label, value, extraClass) {
        return `<div class="ikd-result ${extraClass}"><div class="ikd-val">${value}</div><div class="ikd-label">${label}</div></div>`;
    }

    /**
     * Public API: populate from replay frame data.
     */
    async populateFromReplay(frameData) {
        const { attackerCharId, actionState, defenderCharId, defenderPercent, stageKey, startX, startY } = frameData;
        this._el('ikd-atk-char').value = attackerCharId;
        this._attackerCharId = attackerCharId;
        await this._loadMoves(attackerCharId);

        this._el('ikd-def-char').value = defenderCharId;
        this._defenderCharId = defenderCharId;
        this._el('ikd-percent').value = defenderPercent || 0;
        if (stageKey) { this._el('ikd-stage').value = stageKey; this._stageKey = stageKey; }
        if (startX != null) this._el('ikd-startx').value = startX;
        if (startY != null) this._el('ikd-starty').value = startY;

        // Try to find the move from action state
        const moveData = fc.getFrameDataForAction(attackerCharId, actionState);
        if (moveData && moveData.normalizedName) {
            this._el('ikd-atk-move').value = moveData.normalizedName;
            this._selectedMove = moveData;
        }
        this._recalc();
    }
}

/**
 * Quick embed: create calculator in a container.
 * @param {string|HTMLElement} container - Container ID or element
 * @param {object} [options] - Initial options
 * @returns {IKneeDataUI}
 */
export function embedCalculator(container, options = {}) {
    return new IKneeDataUI(container, options);
}
