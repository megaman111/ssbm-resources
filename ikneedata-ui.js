/**
 * IKneeData Calculator UI — Embeddable Melee frame data calculator
 * Visual stage canvas with click-to-set-position and trajectory rendering.
 * Uses ikneedata-calc.js for computation.
 */
import {
    CHAR_NAMES, CHAR_PHYSICS, STAGES, fc,
    calcKnockback, calcHitstun, calcHitlag, resolveSakuraiAngle,
    applyDIFromAngle, simulateTrajectory,
    fullCalc, findKillPercent,
} from './ikneedata-calc.js';

// Stage SVG rendering constants
const STAGE_COLORS = {
    ground: '#4a7a4a', platform: '#6a6a8a', blastzone: 'rgba(255,60,60,0.15)',
    blaststroke: 'rgba(255,60,60,0.4)', trajectory: '#ff4444', trajectoryPost: '#ff8888',
    startDot: '#ffff00', killDot: '#ff0000', grid: 'rgba(255,255,255,0.06)',
};

const CSS = `
.ikd-calc{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(20,20,35,0.97);border-radius:12px;color:#e0e0e0;max-width:900px;overflow:hidden}
.ikd-calc *{box-sizing:border-box}
.ikd-header{display:flex;gap:.5rem;padding:.75rem;flex-wrap:wrap;align-items:end;background:rgba(0,0,0,0.3)}
.ikd-field{display:flex;flex-direction:column;gap:2px}
.ikd-field label{font-size:.65rem;color:#888;text-transform:uppercase;letter-spacing:.5px}
.ikd-field select,.ikd-field input{padding:.35rem .4rem;border:1px solid #444;border-radius:5px;background:#1a1a2e;color:#e0e0e0;font-size:.8rem;min-width:0}
.ikd-field select:focus,.ikd-field input:focus{border-color:#667eea;outline:none}
.ikd-field input[type=number]{width:65px}
.ikd-toggles{display:flex;gap:.6rem;padding:.4rem .75rem;flex-wrap:wrap;background:rgba(0,0,0,0.2)}
.ikd-toggle{display:flex;align-items:center;gap:3px;font-size:.7rem;color:#aaa;cursor:pointer}
.ikd-toggle input{accent-color:#667eea;margin:0}
.ikd-stage-wrap{position:relative;background:#111;cursor:crosshair;border-top:1px solid #333;border-bottom:1px solid #333}
.ikd-stage-wrap canvas{display:block;width:100%;height:auto}
.ikd-stage-info{position:absolute;top:6px;left:8px;font-size:.65rem;color:rgba(255,255,255,0.5);pointer-events:none}
.ikd-stage-coords{position:absolute;bottom:6px;right:8px;font-size:.65rem;color:rgba(255,255,255,0.6);pointer-events:none;background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:4px}
.ikd-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:.35rem;padding:.6rem .75rem}
.ikd-result{background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:7px;padding:.35rem .5rem;text-align:center}
.ikd-result .v{font-size:1rem;font-weight:700;color:#fff}
.ikd-result .l{font-size:.6rem;color:#888;text-transform:uppercase;letter-spacing:.4px}
.ikd-result.kill{border-color:#e44}.ikd-result.kill .v{color:#f66}
.ikd-result.safe{border-color:#2a7}.ikd-result.safe .v{color:#3c8}
.ikd-result.tumble{border-color:#c80}.ikd-result.tumble .v{color:#fa0}
.ikd-manual{padding:0 .75rem .5rem}
.ikd-manual-btn{background:none;border:1px solid #555;color:#aaa;padding:.25rem .5rem;border-radius:5px;cursor:pointer;font-size:.7rem}
.ikd-manual-btn:hover{border-color:#667eea;color:#ccc}
.ikd-manual-fields{display:none;margin-top:.4rem;gap:.4rem;flex-wrap:wrap}
.ikd-manual-fields.open{display:flex}
.ikd-manual-fields .ikd-field input{width:60px}
.ikd-loading{color:#666;font-size:.75rem;text-align:center;padding:.5rem}
`;

export class IKneeDataUI {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.getElementById(container) : container;
        this._moves = [];
        this._atkChar = options.attackerCharId ?? 2;
        this._defChar = options.defenderCharId ?? 2;
        this._stageKey = options.stageKey ?? 'final_destination';
        this._selectedMove = null;
        this._manualMode = false;
        this._startX = 0;
        this._startY = 0;
        this._mouseStageX = 0;
        this._mouseStageY = 0;
        this._positionFrozen = false;
        this._lastResult = null;
        this._init();
    }

    async _init() {
        if (!document.getElementById('ikd-styles')) {
            const s = document.createElement('style');
            s.id = 'ikd-styles';
            s.textContent = CSS;
            document.head.appendChild(s);
        }
        this._render();
        this._setupCanvas();
        await this._loadMoves(this._atkChar);
        this._recalc();
    }

    _q(sel) { return this.container.querySelector(sel); }

    _render() {
        const chars = Object.entries(CHAR_NAMES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
        const stages = Object.entries(STAGES)
            .map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');

        this.container.innerHTML = `<div class="ikd-calc">
<div class="ikd-header">
  <div class="ikd-field"><label>Attacker</label><select data-id="atk">${chars}</select></div>
  <div class="ikd-field"><label>Move</label><select data-id="move"><option value="">Loading...</option></select></div>
  <div class="ikd-field"><label>Hitbox</label><select data-id="hitbox"><option value="">--</option></select></div>
  <div class="ikd-field"><label>Defender</label><select data-id="def">${chars}</select></div>
  <div class="ikd-field"><label>Percent</label><input type="number" data-id="pct" value="0" min="0" max="999"></div>
  <div class="ikd-field"><label>Stage</label><select data-id="stage">${stages}</select></div>
  <div class="ikd-field"><label>DI Angle</label><input type="number" data-id="di" value="" placeholder="None" min="0" max="360"></div>
</div>
<div class="ikd-toggles">
  <label class="ikd-toggle"><input type="checkbox" data-id="cc"> CC</label>
  <label class="ikd-toggle"><input type="checkbox" data-id="vcancel"> V-Cancel</label>
  <label class="ikd-toggle"><input type="checkbox" data-id="charge-int"> Charge Int.</label>
  <label class="ikd-toggle"><input type="checkbox" data-id="metal"> Metal</label>
  <label class="ikd-toggle"><input type="checkbox" data-id="ice"> Ice</label>
  <label class="ikd-toggle"><input type="checkbox" data-id="reverse"> Reverse</label>
</div>
<div class="ikd-stage-wrap">
  <canvas data-id="canvas" width="900" height="400"></canvas>
  <div class="ikd-stage-info" data-id="stageLabel"></div>
  <div class="ikd-stage-coords" data-id="coords">Click stage to set position</div>
</div>
<div class="ikd-manual">
  <button class="ikd-manual-btn" data-id="manualBtn">Manual Entry \u25B8</button>
  <div class="ikd-manual-fields" data-id="manualFields">
    <div class="ikd-field"><label>Dmg</label><input type="number" data-id="m-dmg" value="0" step="0.1"></div>
    <div class="ikd-field"><label>Angle</label><input type="number" data-id="m-angle" value="45"></div>
    <div class="ikd-field"><label>KBG</label><input type="number" data-id="m-kbg" value="100"></div>
    <div class="ikd-field"><label>BKB</label><input type="number" data-id="m-bkb" value="0"></div>
    <div class="ikd-field"><label>SetKB</label><input type="number" data-id="m-setkb" value="0"></div>
  </div>
</div>
<div class="ikd-results" data-id="output"><div class="ikd-loading">Select a move to calculate...</div></div>
</div>`;

        this._d = (id) => this.container.querySelector(`[data-id="${id}"]`);
        this._d('atk').value = this._atkChar;
        this._d('def').value = this._defChar;
        this._d('stage').value = this._stageKey;

        // Events
        this._d('atk').onchange = () => { try { this._onAtkChange(); } catch(e) { console.error(e); } };
        this._d('move').onchange = () => { try { this._onMoveChange(); } catch(e) { console.error(e); } };
        this._d('hitbox').onchange = () => { try { this._onHitboxChange(); } catch(e) { console.error(e); } };
        this._d('def').onchange = () => { this._defChar = +this._d('def').value; this._recalc(); };
        this._d('stage').onchange = () => { this._stageKey = this._d('stage').value; this._recalc(); };
        for (const id of ['pct','di','cc','vcancel','charge-int','metal','ice','reverse']) {
            this._d(id).addEventListener('input', () => this._recalc());
        }
        this._d('manualBtn').onclick = () => {
            this._manualMode = !this._manualMode;
            this._d('manualFields').classList.toggle('open', this._manualMode);
            this._d('manualBtn').textContent = this._manualMode ? 'Manual Entry \u25BE' : 'Manual Entry \u25B8';
        };
        for (const id of ['m-dmg','m-angle','m-kbg','m-bkb','m-setkb']) {
            this._d(id).addEventListener('input', () => { if (this._manualMode) this._recalc(); });
        }
    }

    _setupCanvas() {
        const canvas = this._d('canvas');
        const wrap = this._q('.ikd-stage-wrap');

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            const stage = STAGES[this._stageKey];
            if (!stage) return;
            const [sx, sy] = this._canvasToStage(px, py, stage, canvas);
            this._startX = Math.round(sx);
            this._startY = Math.round(sy);
            this._positionFrozen = true;
            this._recalc();
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            const stage = STAGES[this._stageKey];
            if (!stage) return;
            const [sx, sy] = this._canvasToStage(px, py, stage, canvas);
            this._mouseStageX = Math.round(sx * 10) / 10;
            this._mouseStageY = Math.round(sy * 10) / 10;
            this._d('coords').textContent = `X: ${this._mouseStageX}  Y: ${this._mouseStageY}`;
            if (!this._positionFrozen) {
                this._startX = Math.round(sx);
                this._startY = Math.round(sy);
                this._recalc();
            }
        });
    }

    _canvasToStage(px, py, stage, canvas) {
        const bz = stage.blastZones;
        const pad = 30;
        const w = canvas.width - pad * 2;
        const h = canvas.height - pad * 2;
        const stageW = bz.right - bz.left;
        const stageH = bz.top - bz.bottom;
        const sx = bz.left + ((px - pad) / w) * stageW;
        const sy = bz.top - ((py - pad) / h) * stageH;
        return [sx, sy];
    }

    _stageToCanvas(sx, sy, stage, canvas) {
        const bz = stage.blastZones;
        const pad = 30;
        const w = canvas.width - pad * 2;
        const h = canvas.height - pad * 2;
        const stageW = bz.right - bz.left;
        const stageH = bz.top - bz.bottom;
        const px = pad + ((sx - bz.left) / stageW) * w;
        const py = pad + ((bz.top - sy) / stageH) * h;
        return [px, py];
    }

    _drawStage() {
        const canvas = this._d('canvas');
        const ctx = canvas.getContext('2d');
        const stage = STAGES[this._stageKey];
        if (!stage) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Background
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(0, 0, W, H);

        const bz = stage.blastZones;

        // Grid lines every 50 units
        ctx.strokeStyle = STAGE_COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = Math.ceil(bz.left / 50) * 50; x <= bz.right; x += 50) {
            const [px] = this._stageToCanvas(x, 0, stage, canvas);
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
        }
        for (let y = Math.ceil(bz.bottom / 50) * 50; y <= bz.top; y += 50) {
            const [, py] = this._stageToCanvas(0, y, stage, canvas);
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
        }

        // Blast zone border
        ctx.strokeStyle = STAGE_COLORS.blaststroke;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        const [bzL, bzT] = this._stageToCanvas(bz.left, bz.top, stage, canvas);
        const [bzR, bzB] = this._stageToCanvas(bz.right, bz.bottom, stage, canvas);
        ctx.strokeRect(bzL, bzT, bzR - bzL, bzB - bzT);
        ctx.setLineDash([]);

        // Ground
        const [gL] = this._stageToCanvas(-stage.edge, 0, stage, canvas);
        const [gR, gY] = this._stageToCanvas(stage.edge, 0, stage, canvas);
        ctx.strokeStyle = STAGE_COLORS.ground;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(gL, gY); ctx.lineTo(gR, gY); ctx.stroke();

        // Platforms
        ctx.strokeStyle = STAGE_COLORS.platform;
        ctx.lineWidth = 3;
        for (const p of stage.platforms) {
            const [pL, pY] = this._stageToCanvas(p.left, p.y, stage, canvas);
            const [pR] = this._stageToCanvas(p.right, p.y, stage, canvas);
            ctx.beginPath(); ctx.moveTo(pL, pY); ctx.lineTo(pR, pY); ctx.stroke();
        }

        // Origin crosshair
        const [ox, oy] = this._stageToCanvas(0, 0, stage, canvas);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();

        // Start position dot
        const [sx, sy] = this._stageToCanvas(this._startX, this._startY, stage, canvas);
        ctx.fillStyle = STAGE_COLORS.startDot;
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();

        // Stage label
        this._d('stageLabel').textContent = `${stage.name} | Start: (${this._startX}, ${this._startY})`;
    }

    _drawTrajectory(result) {
        if (!result || !result.trajectory || !result.trajectory.frames) return;
        const canvas = this._d('canvas');
        const ctx = canvas.getContext('2d');
        const stage = STAGES[this._stageKey];
        if (!stage) return;

        const frames = result.trajectory.frames;
        const hitstun = result.hitstun;

        // Draw trajectory line
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 1; i < frames.length; i++) {
            const [x1, y1] = this._stageToCanvas(frames[i - 1].x, frames[i - 1].y, stage, canvas);
            const [x2, y2] = this._stageToCanvas(frames[i].x, frames[i].y, stage, canvas);
            ctx.strokeStyle = i <= hitstun ? STAGE_COLORS.trajectory : STAGE_COLORS.trajectoryPost;
            ctx.globalAlpha = i <= hitstun ? 1 : 0.5;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Hitstun end marker
        if (hitstun > 0 && hitstun < frames.length) {
            const f = frames[hitstun];
            const [hx, hy] = this._stageToCanvas(f.x, f.y, stage, canvas);
            ctx.fillStyle = '#6af';
            ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#6af';
            ctx.fillText(`${hitstun}f`, hx + 6, hy - 4);
        }

        // Kill marker
        if (result.trajectory.killed) {
            const lastF = frames[frames.length - 1];
            const [kx, ky] = this._stageToCanvas(lastF.x, lastF.y, stage, canvas);
            ctx.fillStyle = STAGE_COLORS.killDot;
            ctx.beginPath(); ctx.arc(kx, ky, 6, 0, Math.PI * 2); ctx.fill();
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = '#f66';
            ctx.fillText('\u2620', kx + 8, ky + 4);
        }

        // Frame dots every 10 frames
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 10; i < frames.length; i += 10) {
            if (i === hitstun) continue;
            const [dx, dy] = this._stageToCanvas(frames[i].x, frames[i].y, stage, canvas);
            ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    async _loadMoves(charId) {
        const sel = this._d('move');
        const hbSel = this._d('hitbox');
        sel.innerHTML = '<option value="">Loading...</option>';
        hbSel.innerHTML = '<option value="">--</option>';
        try {
            this._moves = await fc.getMoves(charId);
            sel.innerHTML = '<option value="">-- Select Move --</option>';
            const seen = new Set();
            for (const m of this._moves) {
                if (!m.hits || !m.hits.length || seen.has(m.normalizedName)) continue;
                seen.add(m.normalizedName);
                const o = document.createElement('option');
                o.value = m.normalizedName; o.textContent = m.name;
                sel.appendChild(o);
            }
        } catch { sel.innerHTML = '<option value="">Failed -- use manual</option>'; }
    }

    async _onAtkChange() {
        this._atkChar = +this._d('atk').value;
        await this._loadMoves(this._atkChar);
        this._selectedMove = null;
        this._recalc();
    }

    _onMoveChange() {
      try {
        const v = this._d('move').value;
        const hbSel = this._d('hitbox');
        if (!v) {
            this._selectedMove = null;
            hbSel.innerHTML = '<option value="">--</option>';
            this._recalc();
            return;
        }
        const m = this._moves.find(x => x.normalizedName === v);
        this._selectedMove = m || null;

        // Populate hitbox dropdown: group by hit window (Clean/Late/etc), list each hitbox ID
        // Uses hit index + hitbox index as the value key (e.g. "0:1") since hb.name can be missing
        hbSel.innerHTML = '';
        if (m?.hits?.length) {
            const multiHit = m.hits.length > 1;
            for (let hi = 0; hi < m.hits.length; hi++) {
                const hit = m.hits[hi];
                if (!hit?.hitboxes?.length) continue;

                // Build a label for this hit window
                let hitLabel;
                if (hit.name && hit.name !== 'unknown') {
                    hitLabel = hit.name.charAt(0).toUpperCase() + hit.name.slice(1);
                } else if (multiHit) {
                    if (m.hits.length === 2) {
                        hitLabel = hi === 0 ? 'Clean' : 'Late';
                    } else {
                        const fs = hit.start ?? '?';
                        const fe = hit.end ?? '?';
                        hitLabel = `Hit ${hi + 1} (f${fs}-${fe})`;
                    }
                } else {
                    hitLabel = null;
                }

                const makeOption = (hb, hbi) => {
                    const o = document.createElement('option');
                    o.value = `${hi}:${hbi}`;
                    const label = hb.name || `id${hbi}`;
                    o.textContent = `${label} (${hb.damage ?? 0}% ${hb.angle ?? 0}°)`;
                    return o;
                };

                if (hitLabel && multiHit) {
                    const group = document.createElement('optgroup');
                    group.label = hitLabel;
                    for (let hbi = 0; hbi < hit.hitboxes.length; hbi++) {
                        group.appendChild(makeOption(hit.hitboxes[hbi], hbi));
                    }
                    hbSel.appendChild(group);
                } else {
                    for (let hbi = 0; hbi < hit.hitboxes.length; hbi++) {
                        hbSel.appendChild(makeOption(hit.hitboxes[hbi], hbi));
                    }
                }
            }
        }

        if (!hbSel.options.length) {
            hbSel.innerHTML = '<option value="">No hitboxes</option>';
        }

        this._onHitboxChange();
      } catch (e) {
        console.error('_onMoveChange error:', e);
        const out = this._d('output');
        if (out) out.innerHTML = `<div style="color:red;padding:.5rem;font-size:.75rem;white-space:pre-wrap">MOVE ERROR: ${e.message}\n${e.stack}</div>`;
      }
    }

    _onHitboxChange() {
        const hb = this._getSelectedHitbox();
        if (hb) {
            this._d('m-dmg').value = hb.damage ?? 0;
            this._d('m-angle').value = hb.angle ?? 0;
            this._d('m-kbg').value = hb.knockbackGrowth ?? 0;
            this._d('m-bkb').value = hb.baseKnockback ?? 0;
            this._d('m-setkb').value = hb.setKnockback ?? 0;
        }
        this._recalc();
    }

    _getSelectedHitbox() {
        if (!this._selectedMove?.hits?.length) return null;
        const val = this._d('hitbox')?.value;
        if (!val || !val.includes(':')) return null;
        const parts = val.split(':');
        const hitIdx = parseInt(parts[0], 10);
        const hbIdx = parseInt(parts[1], 10);
        if (isNaN(hitIdx) || isNaN(hbIdx)) return null;
        const hit = this._selectedMove.hits[hitIdx];
        if (!hit?.hitboxes?.length) return null;
        return hit.hitboxes[hbIdx] || null;
    }

    _getMoveParams() {
        if (this._manualMode || !this._selectedMove) {
            return {
                damage: +this._d('m-dmg').value || 0,
                angle: +this._d('m-angle').value || 0,
                kbg: +this._d('m-kbg').value || 0,
                bkb: +this._d('m-bkb').value || 0,
                setKb: +this._d('m-setkb').value || 0,
            };
        }
        const hb = this._getSelectedHitbox();
        if (!hb) return null;
        return {
            damage: hb.damage ?? 0,
            angle: hb.angle ?? 0,
            kbg: hb.knockbackGrowth ?? 0,
            bkb: hb.baseKnockback ?? 0,
            setKb: hb.setKnockback ?? 0,
        };
    }

    _recalc() {
      try {
        const out = this._d('output');
        const mp = this._getMoveParams();

        // Always redraw stage
        this._drawStage();

        if (!mp || mp.damage === 0) {
            out.innerHTML = '<div class="ikd-loading">Select a move or enter values manually</div>';
            return;
        }

        const pct = +this._d('pct').value || 0;
        const diVal = this._d('di').value;
        const diAngle = diVal !== '' ? +diVal : null;

        const result = fullCalc({
            ...mp, percent: pct,
            defenderCharId: this._defChar,
            stageKey: this._stageKey,
            startX: this._startX, startY: this._startY,
            diAngle,
            crouchCancel: this._d('cc').checked,
            vcancel: this._d('vcancel').checked,
            chargeInterrupt: this._d('charge-int').checked,
            metal: this._d('metal').checked,
            ice: this._d('ice').checked,
            reverse: this._d('reverse').checked,
        });

        if (!result) {
            out.innerHTML = '<div class="ikd-loading">Could not calculate</div>';
            return;
        }

        this._lastResult = result;
        this._drawTrajectory(result);

        const kill = findKillPercent({
            ...mp, defenderCharId: this._defChar, stageKey: this._stageKey,
            startX: this._startX, startY: this._startY,
            crouchCancel: this._d('cc').checked,
            reverse: this._d('reverse').checked,
        });

        let h = '';
        h += this._c('Knockback', result.knockback.toFixed(1), result.tumble ? 'tumble' : '');
        h += this._c('Hitstun', result.hitstun + 'f', result.tumble ? 'tumble' : '');
        h += this._c('Hitlag', result.hitlag + 'f', '');
        h += this._c('Launch', result.launchSpeed.toFixed(2), '');
        h += this._c('Angle', result.launchAngle.baseAngle + '\u00B0', '');
        if (result.launchAngle.diAngle != null)
            h += this._c('DI\u2019d Angle', result.launchAngle.diModifiedAngle + '\u00B0', '');
        h += this._c('Shield Stun', result.shieldStun + 'f', '');

        if (result.trajectory) {
            const t = result.trajectory;
            h += this._c('Kills', t.killed ? 'Yes (' + t.killZone + ')' : 'No', t.killed ? 'kill' : 'safe');
            if (t.killed) h += this._c('Kill Frame', t.killFrame + 'f', 'kill');
        }
        if (kill.noDI != null) h += this._c('Kill% noDI', kill.noDI + '%', 'kill');
        if (kill.survivalDI != null) h += this._c('Kill% survDI', kill.survivalDI + '%', 'kill');
        if (!kill.noDI && !kill.survivalDI && !kill.killPercent)
            h += this._c('Kill%', "Doesn't kill", 'safe');

        out.innerHTML = h;
      } catch (e) {
        const out = this._d('output');
        if (out) out.innerHTML = `<div style="color:red;padding:.5rem;font-size:.75rem;white-space:pre-wrap">CALC ERROR: ${e.message}\n${e.stack}</div>`;
        console.error('_recalc error:', e);
      }
    }

    _c(label, val, cls) {
        return `<div class="ikd-result ${cls}"><div class="v">${val}</div><div class="l">${label}</div></div>`;
    }

    async populateFromReplay(fd) {
        this._d('atk').value = fd.attackerCharId;
        this._atkChar = fd.attackerCharId;
        await this._loadMoves(fd.attackerCharId);
        this._d('def').value = fd.defenderCharId;
        this._defChar = fd.defenderCharId;
        this._d('pct').value = fd.defenderPercent || 0;
        if (fd.stageKey) { this._d('stage').value = fd.stageKey; this._stageKey = fd.stageKey; }
        if (fd.startX != null) this._startX = fd.startX;
        if (fd.startY != null) this._startY = fd.startY;
        const m = fc.getFrameDataForAction(fd.attackerCharId, fd.actionState);
        if (m?.normalizedName) {
            this._d('move').value = m.normalizedName;
            this._selectedMove = m;
            this._onMoveChange();
        }
        this._recalc();
    }
}

export function embedCalculator(container, options = {}) {
    return new IKneeDataUI(container, options);
}
