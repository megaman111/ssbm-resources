/**
 * IKneeData Calculator UI — Full-featured Melee KB calculator
 * Matches IKneeData layout: Attacker (left) | Stage (center) | Victim (right)
 * Interactive DI control stick with Trajectory DI / SDI 1 / SDI 2 / ASDI modes
 */
import {
    CHAR_NAMES, CHAR_PHYSICS, STAGES, fc,
    calcKnockback, calcHitstun, calcHitlag, resolveSakuraiAngle,
    applyDI, applyDIFromAngle, simulateTrajectory,
    fullCalc, findKillPercent, applyStaleness,
} from './ikneedata-calc.js?v=2';

const STAGE_COLORS = {
    ground: '#4a7a4a', platform: '#6a6a8a', blastzone: 'rgba(255,60,60,0.15)',
    blaststroke: 'rgba(255,60,60,0.4)', trajectory: '#ff4444', trajectoryPost: '#ff8888',
    startDot: '#ffff00', killDot: '#ff0000', grid: 'rgba(255,255,255,0.06)',
};

const DI_MODES = ['t', 's', 'z', 'a']; // Trajectory DI, SDI 1, SDI 2, ASDI
const DI_LABELS = { t: 'Trajectory DI', s: 'SDI 1', z: 'SDI 2', a: 'ASDI' };

const CSS = `
.ikd-calc{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(20,20,35,0.97);border-radius:12px;color:#e0e0e0;max-width:1200px;overflow:hidden}
.ikd-calc *{box-sizing:border-box}
.ikd-layout{display:grid;grid-template-columns:260px 1fr 280px;min-height:500px}
@media(max-width:900px){.ikd-layout{grid-template-columns:1fr;}}

/* Panels */
.ikd-panel{padding:.6rem;overflow-y:auto;max-height:700px}
.ikd-panel-title{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#667eea;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid rgba(102,126,234,0.3)}
.ikd-panel-left{background:rgba(0,0,0,0.25);border-right:1px solid #333}
.ikd-panel-right{background:rgba(0,0,0,0.25);border-left:1px solid #333}

/* Fields */
.ikd-field{display:flex;flex-direction:column;gap:2px;margin-bottom:.4rem}
.ikd-field label{font-size:.6rem;color:#888;text-transform:uppercase;letter-spacing:.5px}
.ikd-field select,.ikd-field input{padding:.3rem .35rem;border:1px solid #444;border-radius:5px;background:#1a1a2e;color:#e0e0e0;font-size:.78rem;min-width:0;width:100%}
.ikd-field select:focus,.ikd-field input:focus{border-color:#667eea;outline:none}
.ikd-field-row{display:flex;gap:.4rem;align-items:end}
.ikd-field-row .ikd-field{flex:1}

/* Stale queue */
.ikd-stale-row{display:flex;gap:3px;margin-bottom:.5rem}
.ikd-stale-btn{width:24px;height:24px;border:1px solid #555;border-radius:4px;background:#1a1a2e;color:#888;font-size:.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.ikd-stale-btn.active{background:#667eea;color:#fff;border-color:#667eea}
.ikd-stale-btn:hover{border-color:#667eea}

/* Smash charge */
.ikd-charge-row{display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem}
.ikd-charge-row input{width:50px;text-align:center}
.ikd-charge-row span{font-size:.7rem;color:#888}

/* Toggle switches */
.ikd-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,0.05)}
.ikd-toggle-row label{font-size:.72rem;color:#bbb;cursor:pointer;flex:1}
.ikd-switch{position:relative;width:36px;height:20px;cursor:pointer;flex-shrink:0}
.ikd-switch input{position:absolute;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;margin:0}
.ikd-switch .slider{position:absolute;inset:0;background:#333;border-radius:10px;transition:.2s}
.ikd-switch .slider:before{content:'';position:absolute;height:16px;width:16px;left:2px;bottom:2px;background:#888;border-radius:50%;transition:.2s}
.ikd-switch input:checked+.slider{background:#667eea}
.ikd-switch input:checked+.slider:before{transform:translateX(16px);background:#fff}

/* Hit direction */
.ikd-dir-row{display:flex;gap:.3rem;margin-bottom:.5rem}
.ikd-dir-btn{flex:1;padding:.3rem;border:1px solid #555;border-radius:5px;background:#1a1a2e;color:#888;font-size:.7rem;cursor:pointer;text-align:center;transition:all .15s}
.ikd-dir-btn.active{background:#667eea;color:#fff;border-color:#667eea}

/* DI Stick */
.ikd-di-container{margin:.5rem 0}
.ikd-di-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem}
.ikd-di-label{font-size:.72rem;font-weight:600;color:#ccc}
.ikd-di-switch-btn{background:none;border:1px solid #555;color:#aaa;padding:.15rem .4rem;border-radius:4px;cursor:pointer;font-size:.65rem}
.ikd-di-switch-btn:hover{border-color:#667eea;color:#ccc}
.ikd-di-stick-wrap{position:relative;width:140px;height:140px;margin:0 auto}
.ikd-di-stick-bg{width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,#1a1a2e 60%,#111 100%);border:2px solid #444;position:relative;cursor:crosshair;overflow:hidden}
.ikd-di-deadzone-x{position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(255,255,255,0.08);transform:translateX(-50%)}
.ikd-di-deadzone-y{position:absolute;top:50%;left:0;height:1px;width:100%;background:rgba(255,255,255,0.08);transform:translateY(-50%)}
.ikd-di-pointer{position:absolute;width:10px;height:10px;border-radius:50%;background:#59e6ff;transform:translate(-50%,-50%);pointer-events:none;transition:background .2s}
.ikd-di-pointer.frozen{background:#ff6644}
.ikd-di-arrow{position:absolute;left:50%;top:50%;width:2px;background:#59e6ff;transform-origin:bottom center;pointer-events:none;opacity:0.7}
.ikd-di-precise-btn{background:none;border:1px solid #555;color:#888;padding:.1rem .35rem;border-radius:4px;cursor:pointer;font-size:.6rem;margin-left:.3rem;transition:all .15s}
.ikd-di-precise-btn:hover{border-color:#667eea;color:#ccc}
.ikd-di-precise-btn.active{background:rgba(102,126,234,0.25);border-color:#667eea;color:#ccc}
.ikd-di-launch-line{position:absolute;top:50%;left:0;width:100%;height:3px;margin-top:-1.5px;pointer-events:none;transform-origin:center center;display:none}
.ikd-di-launch-line .line-half{display:inline-block;width:50%;height:100%;vertical-align:top}
.ikd-di-launch-line .line-solid{background:#de4d4d;opacity:0.7}
.ikd-di-perp-line{position:absolute;left:50%;top:0;width:3px;height:100%;margin-left:-1.5px;pointer-events:none;transform-origin:center center;background:#3dee49;opacity:0.7;display:none}
.ikd-di-values{font-size:.6rem;color:#888;text-align:center;margin-top:.3rem}
.ikd-di-values span{color:#ccc}

/* Attempt CC button */
.ikd-attempt-cc{width:100%;padding:.4rem;border:1px solid #555;border-radius:5px;background:#1a1a2e;color:#ccc;font-size:.72rem;cursor:pointer;margin:.4rem 0;transition:all .15s}
.ikd-attempt-cc:hover{border-color:#667eea;background:rgba(102,126,234,0.15)}

/* Section divider */
.ikd-section-title{font-size:.6rem;color:#667eea;text-transform:uppercase;letter-spacing:.5px;margin:.6rem 0 .3rem;padding-top:.3rem;border-top:1px solid rgba(102,126,234,0.2)}

/* Stage */
.ikd-stage-wrap{position:relative;background:#111;cursor:crosshair;display:flex;flex-direction:column}
.ikd-stage-wrap canvas{display:block;width:100%;height:auto;flex:1}
.ikd-stage-info{position:absolute;top:6px;left:8px;font-size:.6rem;color:rgba(255,255,255,0.5);pointer-events:none}
.ikd-stage-coords{position:absolute;bottom:6px;right:8px;font-size:.6rem;color:rgba(255,255,255,0.6);pointer-events:none;background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:4px}
.ikd-stage-select{display:flex;gap:3px;padding:.3rem .5rem;background:rgba(0,0,0,0.3);border-bottom:1px solid #333}
.ikd-stage-btn{padding:.2rem .5rem;border:1px solid #444;border-radius:4px;background:#1a1a2e;color:#888;font-size:.65rem;cursor:pointer;transition:all .15s}
.ikd-stage-btn.active{background:#667eea;color:#fff;border-color:#667eea}
.ikd-stage-btn:hover{border-color:#667eea}
.ikd-fod-sliders{display:flex;gap:.75rem;padding:.25rem .5rem;background:rgba(0,0,0,0.2);border-bottom:1px solid #333;align-items:center}
.ikd-fod-slider{display:flex;align-items:center;gap:.35rem;flex:1}
.ikd-fod-slider label{font-size:.6rem;color:#aaa;white-space:nowrap;min-width:72px}
.ikd-fod-slider label span{color:#e0e0e0;font-weight:600}
.ikd-fod-slider input[type=range]{flex:1;height:4px;accent-color:#667eea;cursor:pointer}

/* Results bar */
.ikd-results{display:flex;flex-wrap:wrap;gap:.3rem;padding:.5rem;background:rgba(0,0,0,0.3);border-top:1px solid #333}
.ikd-result{background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:6px;padding:.25rem .4rem;text-align:center;flex:1;min-width:70px}
.ikd-result .v{font-size:.85rem;font-weight:700;color:#fff}
.ikd-result .l{font-size:.55rem;color:#888;text-transform:uppercase;letter-spacing:.3px}
.ikd-result.kill{border-color:#e44}.ikd-result.kill .v{color:#f66}
.ikd-result.safe{border-color:#2a7}.ikd-result.safe .v{color:#3c8}
.ikd-result.tumble{border-color:#c80}.ikd-result.tumble .v{color:#fa0}
.ikd-loading{color:#666;font-size:.7rem;text-align:center;padding:.4rem;width:100%}

/* Manual entry */
.ikd-manual{padding:.3rem .5rem;background:rgba(0,0,0,0.2)}
.ikd-manual-btn{background:none;border:1px solid #444;color:#888;padding:.2rem .4rem;border-radius:4px;cursor:pointer;font-size:.65rem;width:100%}
.ikd-manual-btn:hover{border-color:#667eea;color:#ccc}
.ikd-manual-fields{display:none;margin-top:.3rem;gap:.3rem;flex-wrap:wrap}
.ikd-manual-fields.open{display:flex}
.ikd-manual-fields .ikd-field{flex:1;min-width:55px}
.ikd-manual-fields .ikd-field input{width:100%}

/* Damage display */
.ikd-damage-display{font-size:.7rem;color:#aaa;padding:.2rem 0;text-align:center}
.ikd-damage-display span{color:#fff;font-weight:600}
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

        // Stale queue: array of 9 booleans (positions 1-9)
        this._staleQueue = [false,false,false,false,false,false,false,false,false];
        // Smash charge frames
        this._chargeFrames = 0;
        // Hit direction: false = right (default), true = reverse/left
        this._reverse = false;
        // Combo snapping
        this._comboSnap = false;

        // DI stick state for each mode
        this._diState = {};
        for (const mode of DI_MODES) {
            this._diState[mode] = { x: 0, y: 0, frozen: false };
        }
        this._activeDI = 't'; // current DI mode shown
        this._diPrecise = { t: false, s: false, z: false, a: false };

        // Toggles
        this._toggles = {
            crouch: false,
            chargeInterrupt: false,
            grabInterrupt: false,
            yoshiDJArmor: false,
            vcancel: false,
            meteorCancel: false,
            icg: false,
            metal: false,
            ice: false,
            fadeIn: true,
            doubleJump: false,
        };

        // Ready promise — must be LAST in constructor (after all properties initialized)
        this.ready = this._init();
    }

    async _init() {
        try {
            if (!document.getElementById('ikd-styles')) {
                const s = document.createElement('style');
                s.id = 'ikd-styles';
                s.textContent = CSS;
                document.head.appendChild(s);
            }
            this._render();
            this._setupCanvas();
            this._setupDIStick();
            await this._loadMoves(this._atkChar);
            this._recalc();
        } catch (e) {
            console.error('IKneeDataUI _init error:', e);
            if (this.container) {
                this.container.innerHTML = `<div style="color:#f66;padding:1rem;font-size:.8rem;background:rgba(0,0,0,0.5);border-radius:8px;margin:.5rem">
                    <div style="font-weight:600;margin-bottom:.3rem">Calculator init error</div>
                    <pre style="white-space:pre-wrap;font-size:.7rem;color:#ccc">${e.message}\n${e.stack}</pre>
                </div>`;
            }
        }
    }

    _d(id) { return this.container.querySelector(`[data-id="${id}"]`); }

    _render() {
        const chars = Object.entries(CHAR_NAMES)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
        const stageButtons = Object.entries(STAGES)
            .map(([k, s]) => `<button class="ikd-stage-btn${k === this._stageKey ? ' active' : ''}" data-stage="${k}">${s.name}</button>`).join('');

        this.container.innerHTML = `<div class="ikd-calc">
<div class="ikd-layout">

<!-- LEFT: ATTACKER -->
<div class="ikd-panel ikd-panel-left">
  <div class="ikd-panel-title">Attacker</div>
  <div class="ikd-field"><label>Character</label><select data-id="atk">${chars}</select></div>
  <div class="ikd-field"><label>Move</label><select data-id="move"><option value="">Loading...</option></select></div>
  <div class="ikd-field"><label>Hitbox</label><select data-id="hitbox"><option value="">--</option></select></div>

  <div class="ikd-section-title">Stale Queue</div>
  <div class="ikd-stale-row">
    ${[1,2,3,4,5,6,7,8,9].map(i => `<button class="ikd-stale-btn" data-stale="${i}">${i}</button>`).join('')}
  </div>

  <div class="ikd-section-title">Smash Charge</div>
  <div class="ikd-charge-row">
    <input type="number" data-id="charge" value="0" min="0" max="60" style="padding:.25rem;border:1px solid #444;border-radius:4px;background:#1a1a2e;color:#e0e0e0;font-size:.75rem">
    <span>frames</span>
  </div>

  <div class="ikd-damage-display">Damage: <span data-id="staleDmg">0</span>%</div>

  <div class="ikd-manual">
    <button class="ikd-manual-btn" data-id="manualBtn">Manual Entry ▸</button>
    <div class="ikd-manual-fields" data-id="manualFields">
      <div class="ikd-field"><label>Dmg</label><input type="number" data-id="m-dmg" value="0" step="0.1"></div>
      <div class="ikd-field"><label>Angle</label><input type="number" data-id="m-angle" value="45"></div>
      <div class="ikd-field"><label>KBG</label><input type="number" data-id="m-kbg" value="100"></div>
      <div class="ikd-field"><label>BKB</label><input type="number" data-id="m-bkb" value="0"></div>
      <div class="ikd-field"><label>SetKB</label><input type="number" data-id="m-setkb" value="0"></div>
    </div>
  </div>
</div>

<!-- CENTER: STAGE + RESULTS -->
<div class="ikd-center">
  <div class="ikd-stage-select" data-id="stageBar">${stageButtons}</div>
  <div class="ikd-fod-sliders" data-id="fodSliders" style="display:${this._stageKey === 'fountain_of_dreams' ? 'flex' : 'none'}">
    <div class="ikd-fod-slider">
      <label>Left Plat <span data-id="fodLeftVal">16.1</span></label>
      <input type="range" data-id="fodLeft" min="0" max="27.375" step="0.125" value="16.125">
    </div>
    <div class="ikd-fod-slider">
      <label>Right Plat <span data-id="fodRightVal">22.1</span></label>
      <input type="range" data-id="fodRight" min="0" max="27.375" step="0.125" value="22.125">
    </div>
  </div>
  <div class="ikd-stage-wrap">
    <canvas data-id="canvas" width="900" height="420"></canvas>
    <div class="ikd-stage-info" data-id="stageLabel"></div>
    <div class="ikd-stage-coords" data-id="coords">Click stage to set position</div>
  </div>
  <div class="ikd-results" data-id="output"><div class="ikd-loading">Select a move to calculate...</div></div>
</div>

<!-- RIGHT: VICTIM -->
<div class="ikd-panel ikd-panel-right">
  <div class="ikd-panel-title">Victim</div>

  <div class="ikd-toggle-row">
    <label for="ikd-t-comboSnap">Combo Snapping</label>
    <div class="ikd-switch"><input type="checkbox" id="ikd-t-comboSnap" data-id="comboSnap"><span class="slider"></span></div>
  </div>

  <div class="ikd-section-title">Hit Direction</div>
  <div class="ikd-dir-row">
    <button class="ikd-dir-btn active" data-dir="right">→ Right</button>
    <button class="ikd-dir-btn" data-dir="left">← Left</button>
  </div>

  <div class="ikd-field"><label>Defender</label><select data-id="def">${chars}</select></div>
  <div class="ikd-field"><label>Percent</label><input type="number" data-id="pct" value="0" min="0" max="999"></div>

  <!-- DI Control Stick -->
  <div class="ikd-di-container">
    <div class="ikd-di-header">
      <span class="ikd-di-label" data-id="diModeLabel">Trajectory DI</span>
      <button class="ikd-di-precise-btn" data-id="diPreciseBtn">Precise</button>
      <button class="ikd-di-switch-btn" data-id="diSwitchBtn">▸</button>
    </div>
    <div class="ikd-di-stick-wrap">
      <div class="ikd-di-stick-bg" data-id="diStick">
        <div class="ikd-di-deadzone-x"></div>
        <div class="ikd-di-deadzone-y"></div>
        <div class="ikd-di-launch-line" data-id="diLaunchLine"><span class="line-half"></span><span class="line-half line-solid"></span></div>
        <div class="ikd-di-perp-line" data-id="diPerpLine"></div>
        <div class="ikd-di-pointer" data-id="diPointer" style="left:50%;top:50%"></div>
      </div>
    </div>
    <div class="ikd-di-values">X: <span data-id="diX">0.000</span> Y: <span data-id="diY">0.000</span> | <span data-id="diAngleDisp">0</span>° <span data-id="diStrength" style="color:#888"></span></div>
  </div>

  <button class="ikd-attempt-cc" data-id="attemptCC">Attempt Crouch Cancel</button>

  <div class="ikd-section-title">Options</div>
  ${this._renderToggle('crouch', 'Crouching')}
  ${this._renderToggle('chargeInterrupt', 'Smash charge interruption')}
  ${this._renderToggle('grabInterrupt', 'Hit when grabbed')}
  ${this._renderToggle('yoshiDJArmor', 'Yoshi DJ Armor')}
  ${this._renderToggle('vcancel', 'V-Cancel')}
  ${this._renderToggle('meteorCancel', 'Meteor Cancel')}
  ${this._renderToggle('icg', 'Invisible Ceiling Glitch')}
  ${this._renderToggle('metal', 'Metal')}
  ${this._renderToggle('ice', 'In DamageIce')}

  <div class="ikd-section-title">After Hitstun</div>
  ${this._renderToggle('fadeIn', 'Fade In', true)}
  ${this._renderToggle('doubleJump', 'Double Jump')}
</div>

</div>
</div>`;

        // Set initial values
        this._d('atk').value = this._atkChar;
        this._d('def').value = this._defChar;

        // Wire up events
        this._d('atk').onchange = () => { try { this._onAtkChange(); } catch(e) { console.error(e); } };
        this._d('move').onchange = () => { try { this._onMoveChange(); } catch(e) { console.error(e); } };
        this._d('hitbox').onchange = () => { try { this._onHitboxChange(); } catch(e) { console.error(e); } };
        this._d('def').onchange = () => { this._defChar = +this._d('def').value; this._recalc(); };
        this._d('pct').addEventListener('input', () => this._recalc());
        this._d('charge').addEventListener('input', () => { this._chargeFrames = +this._d('charge').value || 0; this._recalc(); });

        // Stage buttons
        this._d('stageBar').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-stage]');
            if (!btn) return;
            this._d('stageBar').querySelectorAll('.ikd-stage-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._stageKey = btn.dataset.stage;
            this._d('fodSliders').style.display = this._stageKey === 'fountain_of_dreams' ? 'flex' : 'none';
            if (this._stageKey === 'fountain_of_dreams') {
                this._d('fodRight').value = STAGES.fountain_of_dreams.platforms[1].y;
                this._d('fodRightVal').textContent = STAGES.fountain_of_dreams.platforms[1].y === 0 ? 'Off' : STAGES.fountain_of_dreams.platforms[1].y.toFixed(1);
                this._d('fodLeft').value = STAGES.fountain_of_dreams.platforms[2].y;
                this._d('fodLeftVal').textContent = STAGES.fountain_of_dreams.platforms[2].y === 0 ? 'Off' : STAGES.fountain_of_dreams.platforms[2].y.toFixed(1);
            }
            this._recalc();
        });

        // FoD platform sliders
        this._d('fodRight').addEventListener('input', () => {
            const v = +this._d('fodRight').value;
            STAGES.fountain_of_dreams.platforms[1].y = v;
            this._d('fodRightVal').textContent = v === 0 ? 'Off' : v.toFixed(1);
            if (this._stageKey === 'fountain_of_dreams') this._recalc();
        });
        this._d('fodLeft').addEventListener('input', () => {
            const v = +this._d('fodLeft').value;
            STAGES.fountain_of_dreams.platforms[2].y = v;
            this._d('fodLeftVal').textContent = v === 0 ? 'Off' : v.toFixed(1);
            if (this._stageKey === 'fountain_of_dreams') this._recalc();
        });

        // Stale queue buttons
        this.container.querySelectorAll('.ikd-stale-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = +btn.dataset.stale - 1;
                this._staleQueue[idx] = !this._staleQueue[idx];
                btn.classList.toggle('active', this._staleQueue[idx]);
                this._recalc();
            });
        });

        // Hit direction buttons
        this.container.querySelectorAll('.ikd-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.ikd-dir-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._reverse = btn.dataset.dir === 'left';
                this._recalc();
            });
        });

        // Toggle switches
        this.container.querySelectorAll('[data-toggle]').forEach(input => {
            const key = input.dataset.toggle;
            input.checked = this._toggles[key] ?? false;
            input.addEventListener('change', () => {
                this._toggles[key] = input.checked;
                this._recalc();
            });
        });

        // DI mode switch button
        this._d('diSwitchBtn').addEventListener('click', () => {
            const idx = DI_MODES.indexOf(this._activeDI);
            this._activeDI = DI_MODES[(idx + 1) % DI_MODES.length];
            this._updateDIDisplay();
        });

        // DI precise toggle button
        this._d('diPreciseBtn').addEventListener('click', () => {
            const mode = this._activeDI;
            this._diPrecise[mode] = !this._diPrecise[mode];
            this._updateDIDisplay();
        });

        // Attempt CC button
        this._d('attemptCC').addEventListener('click', () => {
            // Set crouch on, TDI to (0, -1), ASDI to (0, -1)
            this._toggles.crouch = true;
            const crouchToggle = this.container.querySelector('[data-toggle="crouch"]');
            if (crouchToggle) crouchToggle.checked = true;

            this._diState.t = { x: 0, y: -1, frozen: true };
            this._diState.a = { x: 0, y: -1, frozen: true };
            this._updateDIDisplay();
            this._recalc();
        });

        // Manual entry toggle
        this._d('manualBtn').onclick = () => {
            this._manualMode = !this._manualMode;
            this._d('manualFields').classList.toggle('open', this._manualMode);
            this._d('manualBtn').textContent = this._manualMode ? 'Manual Entry ▾' : 'Manual Entry ▸';
        };
        for (const id of ['m-dmg','m-angle','m-kbg','m-bkb','m-setkb']) {
            this._d(id).addEventListener('input', () => { if (this._manualMode) this._recalc(); });
        }
    }

    _renderToggle(key, label, defaultOn = false) {
        const uid = 'ikd-t-' + key;
        return `<div class="ikd-toggle-row">
            <label for="${uid}">${label}</label>
            <div class="ikd-switch"><input type="checkbox" id="${uid}" data-toggle="${key}"${defaultOn ? ' checked' : ''}><span class="slider"></span></div>
        </div>`;
    }

    // ===== DI Control Stick =====
    _setupDIStick() {
        const stick = this._d('diStick');
        if (!stick) return;

        const getStickXY = (e) => {
            const rect = stick.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width;
            const py = (e.clientY - rect.top) / rect.height;
            // Convert to -1..1 range (center = 0,0)
            let x = (px - 0.5) * 2;
            let y = -(py - 0.5) * 2; // Y is inverted (up = positive)
            // Clamp to unit circle
            const mag = Math.sqrt(x * x + y * y);
            if (mag > 1) { x /= mag; y /= mag; }
            // Round to Melee precision (0.0125 increments)
            x = Math.round(x / 0.0125) * 0.0125;
            y = Math.round(y / 0.0125) * 0.0125;
            return [x, y];
        };

        let dragging = false;

        stick.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const mode = this._activeDI;
            const state = this._diState[mode];
            if (state.frozen) {
                // Unfreeze and start dragging
                state.frozen = false;
            }
            dragging = true;
            const [x, y] = getStickXY(e);
            state.x = x; state.y = y;
            this._updateDIDisplay();
            this._recalc();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const mode = this._activeDI;
            const state = this._diState[mode];
            if (state.frozen) return;
            const [x, y] = getStickXY(e);
            state.x = x; state.y = y;
            this._updateDIDisplay();
            clearTimeout(this._diRecalcTimer);
            this._diRecalcTimer = setTimeout(() => this._recalc(), 30);
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                const mode = this._activeDI;
                this._diState[mode].frozen = true;
                this._updateDIDisplay();
                this._recalc();
            }
        });

        // Click to freeze/unfreeze
        stick.addEventListener('click', (e) => {
            // Already handled by mousedown/mouseup
        });
    }

    _updateDIDisplay() {
        const mode = this._activeDI;
        const state = this._diState[mode];
        const label = this._d('diModeLabel');
        const pointer = this._d('diPointer');
        const xDisp = this._d('diX');
        const yDisp = this._d('diY');
        const angleDisp = this._d('diAngleDisp');
        const preciseBtn = this._d('diPreciseBtn');
        const launchLine = this._d('diLaunchLine');
        const perpLine = this._d('diPerpLine');

        if (label) label.textContent = DI_LABELS[mode];

        // Update precise button state
        if (preciseBtn) {
            preciseBtn.classList.toggle('active', !!this._diPrecise[mode]);
            preciseBtn.textContent = this._diPrecise[mode] ? 'Precise' : 'Simple';
        }

        // Position pointer
        if (pointer) {
            const px = 50 + state.x * 50; // percent
            const py = 50 - state.y * 50;
            pointer.style.left = px + '%';
            pointer.style.top = py + '%';
            pointer.classList.toggle('frozen', state.frozen);
        }

        if (xDisp) xDisp.textContent = state.x.toFixed(4);
        if (yDisp) yDisp.textContent = state.y.toFixed(4);

        // Calculate angle
        let angle = 0;
        if (Math.abs(state.x) > 0.01 || Math.abs(state.y) > 0.01) {
            angle = Math.atan2(state.y, state.x) * (180 / Math.PI);
            if (angle < 0) angle += 360;
        }
        if (angleDisp) angleDisp.textContent = Math.round(angle);

        // DI strength display (TDI only, shows how effective the DI is)
        const strengthDisp = this._d('diStrength');
        if (strengthDisp) {
            if (mode === 't' && this._lastResult?.launchAngle?.baseAngle != null) {
                const attackAngle = this._lastResult.launchAngle.baseAngle;
                const diAngle = angle;
                let rAngle = attackAngle - diAngle;
                if (rAngle > 180) rAngle -= 360;
                if (rAngle < -180) rAngle += 360;
                const mag = Math.sqrt(state.x * state.x + state.y * state.y);
                const pDistance = Math.sin(rAngle * (Math.PI / 180)) * mag;
                let angleOffset = pDistance * pDistance * 18;
                if (angleOffset > 18) angleOffset = 18;
                const strength = Math.round((angleOffset / 18) * 100);
                strengthDisp.textContent = `| Str: ${strength}%`;
                // Color: red (0%) → green (100%)
                const green = Math.floor(strength * 2.55);
                const red = 255 - green;
                strengthDisp.style.color = `rgb(${red},${green},0)`;
            } else {
                strengthDisp.textContent = '';
            }
        }

        // Precise mode lines (only meaningful for TDI)
        this._updatePreciseLines();
    }

    _updatePreciseLines() {
        const launchLine = this._d('diLaunchLine');
        const perpLine = this._d('diPerpLine');
        if (!launchLine || !perpLine) return;

        const mode = this._activeDI;
        const showPrecise = this._diPrecise[mode] && mode === 't';

        if (!showPrecise || !this._lastResult) {
            launchLine.style.display = 'none';
            perpLine.style.display = 'none';
            return;
        }

        // Get the attack angle (pre-DI launch angle)
        const la = this._lastResult.launchAngle;
        if (!la) {
            launchLine.style.display = 'none';
            perpLine.style.display = 'none';
            return;
        }

        const attackAngle = la.baseAngle ?? 0;

        // Launch angle line: rotated so the solid half points in the launch direction
        // IKneeData rotates by -(attackAngle) degrees (CSS rotation is clockwise)
        launchLine.style.display = 'block';
        launchLine.style.transform = `rotate(${-attackAngle}deg)`;

        // Perpendicular line: same rotation (it's a vertical line, so rotating by the
        // attack angle makes it perpendicular to the launch direction)
        perpLine.style.display = 'block';
        perpLine.style.transform = `rotate(${-attackAngle}deg)`;
    }

    // ===== Canvas Setup =====
    _setupCanvas() {
        const canvas = this._d('canvas');

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
                const newX = Math.round(sx);
                const newY = Math.round(sy);
                if (newX !== this._startX || newY !== this._startY) {
                    this._startX = newX;
                    this._startY = newY;
                    clearTimeout(this._moveTimer);
                    this._moveTimer = setTimeout(() => this._recalc(), 30);
                }
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
        return [bz.left + ((px - pad) / w) * stageW, bz.top - ((py - pad) / h) * stageH];
    }

    _stageToCanvas(sx, sy, stage, canvas) {
        const bz = stage.blastZones;
        const pad = 30;
        const w = canvas.width - pad * 2;
        const h = canvas.height - pad * 2;
        const stageW = bz.right - bz.left;
        const stageH = bz.top - bz.bottom;
        return [pad + ((sx - bz.left) / stageW) * w, pad + ((bz.top - sy) / stageH) * h];
    }

    _drawStage() {
        const canvas = this._d('canvas');
        const ctx = canvas.getContext('2d');
        const stage = STAGES[this._stageKey];
        if (!stage) return;
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(0, 0, W, H);

        const bz = stage.blastZones;

        // Grid
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

        // Stage body polygon (filled silhouette)
        if (stage.polygon?.length) {
            const poly = stage.polygon;
            ctx.beginPath();
            const [px0, py0] = this._stageToCanvas(poly[0][0], poly[0][1], stage, canvas);
            ctx.moveTo(px0, py0);
            for (let i = 1; i < poly.length; i++) {
                const [px, py] = this._stageToCanvas(poly[i][0], poly[i][1], stage, canvas);
                ctx.lineTo(px, py);
            }
            ctx.closePath();
            // Solid fill for the stage body
            const bodyGrad = ctx.createLinearGradient(0, this._stageToCanvas(0, 0, stage, canvas)[1], 0, this._stageToCanvas(0, -80, stage, canvas)[1]);
            bodyGrad.addColorStop(0, 'rgba(50,70,50,0.7)');
            bodyGrad.addColorStop(1, 'rgba(25,35,25,0.5)');
            ctx.fillStyle = bodyGrad;
            ctx.fill();
            // Outline
            ctx.strokeStyle = 'rgba(100,160,100,0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Ground surface (bright top edge)
        const [gL] = this._stageToCanvas(-stage.edge, 0, stage, canvas);
        const [gR, gY] = this._stageToCanvas(stage.edge, 0, stage, canvas);
        ctx.strokeStyle = STAGE_COLORS.ground;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(gL, gY); ctx.lineTo(gR, gY); ctx.stroke();

        // Platforms
        ctx.lineWidth = 3;
        for (const p of stage.platforms) {
            if (p.movable && p.y === 0) continue;
            ctx.strokeStyle = p.movable ? '#88aaff' : STAGE_COLORS.platform;
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

        this._d('stageLabel').textContent = `${stage.name} | Start: (${this._startX}, ${this._startY})`;
    }

    _drawTrajectory(result) {
        if (!result?.trajectory?.frames) return;
        const canvas = this._d('canvas');
        const ctx = canvas.getContext('2d');
        const stage = STAGES[this._stageKey];
        if (!stage) return;

        const frames = result.trajectory.frames;
        const hitstun = result.hitstun;

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

    // ===== Move loading =====
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

        hbSel.innerHTML = '';
        if (m?.hits?.length) {
            const multiHit = m.hits.length > 1;
            for (let hi = 0; hi < m.hits.length; hi++) {
                const hit = m.hits[hi];
                if (!hit?.hitboxes?.length) continue;

                let hitLabel;
                if (hit.name && hit.name !== 'unknown') {
                    hitLabel = hit.name.charAt(0).toUpperCase() + hit.name.slice(1);
                } else if (multiHit) {
                    hitLabel = m.hits.length === 2
                        ? (hi === 0 ? 'Clean' : 'Late')
                        : `Hit ${hi + 1} (f${hit.start ?? '?'}-${hit.end ?? '?'})`;
                } else {
                    hitLabel = null;
                }

                const makeOption = (hb, hbi) => {
                    const o = document.createElement('option');
                    o.value = `${hi}:${hbi}`;
                    o.textContent = `${hb.name || 'id' + hbi} (${hb.damage ?? 0}% ${hb.angle ?? 0}°)`;
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
        const [hitIdx, hbIdx] = val.split(':').map(Number);
        if (isNaN(hitIdx) || isNaN(hbIdx)) return null;
        const hit = this._selectedMove.hits[hitIdx];
        return hit?.hitboxes?.[hbIdx] || null;
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

    _getStalePositions() {
        const positions = [];
        for (let i = 0; i < 9; i++) {
            if (this._staleQueue[i]) positions.push(i);
        }
        return positions;
    }

    _recalc() {
      try {
        const out = this._d('output');
        const mp = this._getMoveParams();

        this._drawStage();

        if (!mp || mp.damage === 0) {
            out.innerHTML = '<div class="ikd-loading">Select a move or enter values manually</div>';
            this._updateStaleDamage(0);
            return;
        }

        const pct = +this._d('pct').value || 0;
        const stalePositions = this._getStalePositions();

        // Calculate effective damage for display (with charge boost)
        let effectiveDmg = mp.damage;
        if (this._chargeFrames > 0) {
            effectiveDmg *= 1 + (this._chargeFrames * (0.3671 / 60));
        }
        const staledDmg = applyStaleness(effectiveDmg, stalePositions) * (this._toggles.grabInterrupt ? 0.5 : 1);
        this._updateStaleDamage(staledDmg);

        // Get DI from stick state
        const tdi = this._diState.t;
        const sdi1 = this._diState.s;
        const sdi2 = this._diState.z;
        const asdi = this._diState.a;

        const result = fullCalc({
            ...mp, percent: pct,
            defenderCharId: this._defChar,
            stageKey: this._stageKey,
            startX: this._startX, startY: this._startY,
            diX: tdi.x, diY: tdi.y,
            sdi1X: sdi1.x, sdi1Y: sdi1.y,
            sdi2X: sdi2.x, sdi2Y: sdi2.y,
            asdiX: asdi.x, asdiY: asdi.y,
            crouchCancel: this._toggles.crouch,
            vcancel: this._toggles.vcancel,
            chargeInterrupt: this._toggles.chargeInterrupt,
            metal: this._toggles.metal,
            ice: this._toggles.ice,
            reverse: this._reverse,
            yoshiDJArmor: this._toggles.yoshiDJArmor,
            grabInterrupt: this._toggles.grabInterrupt,
            stalenessQueue: stalePositions,
            chargeFrames: this._chargeFrames,
            meteorCancel: this._toggles.meteorCancel,
            icg: this._toggles.icg,
            fadeIn: this._toggles.fadeIn,
            doubleJump: this._toggles.doubleJump,
        });

        if (!result) {
            out.innerHTML = '<div class="ikd-loading">Could not calculate</div>';
            return;
        }

        this._lastResult = result;
        this._drawTrajectory(result);
        this._updatePreciseLines();

        // Debounced kill% search
        clearTimeout(this._killTimer);
        this._killTimer = setTimeout(() => {
          try {
            const kill = findKillPercent({
                ...mp, defenderCharId: this._defChar, stageKey: this._stageKey,
                startX: this._startX, startY: this._startY,
                crouchCancel: this._toggles.crouch,
                reverse: this._reverse,
                stalenessQueue: stalePositions,
                chargeFrames: this._chargeFrames,
                grabInterrupt: this._toggles.grabInterrupt,
                vcancel: this._toggles.vcancel,
                chargeInterrupt: this._toggles.chargeInterrupt,
                metal: this._toggles.metal,
                ice: this._toggles.ice,
                yoshiDJArmor: this._toggles.yoshiDJArmor,
            });
            let kh = '';
            if (kill.noDI != null) kh += this._c('Kill% noDI', kill.noDI + '%', 'kill');
            if (kill.survivalDI != null) kh += this._c('Kill% survDI', kill.survivalDI + '%', 'kill');
            if (!kill.noDI && !kill.survivalDI && !kill.killPercent)
                kh += this._c('Kill%', "Doesn't kill", 'safe');
            const killEl = this._d('killResults');
            if (killEl) killEl.innerHTML = kh;
          } catch (e) { console.error('kill% error:', e); }
        }, 150);

        let h = '';
        h += this._c('Knockback', result.knockback.toFixed(1), result.tumble ? 'tumble' : '');
        h += this._c('Hitstun', result.hitstun + 'f', result.tumble ? 'tumble' : '');
        h += this._c('Hitlag', result.hitlag + 'f', '');
        h += this._c('Launch', result.launchSpeed.toFixed(2), '');
        h += this._c('Angle', result.launchAngle.baseAngle + '\u00B0', '');
        if (result.launchAngle.diAngle != null)
            h += this._c("DI'd Angle", result.launchAngle.diModifiedAngle + '\u00B0', '');
        h += this._c('Shield Stun', result.shieldStun + 'f', '');

        if (result.trajectory) {
            const t = result.trajectory;
            h += this._c('Kills', t.killed ? 'Yes (' + t.killZone + ')' : 'No', t.killed ? 'kill' : 'safe');
            if (t.killed) h += this._c('Kill Frame', t.killFrame + 'f', 'kill');
        }
        h += '<span data-id="killResults"><span class="ikd-loading" style="font-size:.6rem">Calculating kill%...</span></span>';

        out.innerHTML = h;
      } catch (e) {
        const out = this._d('output');
        if (out) out.innerHTML = `<div style="color:red;padding:.5rem;font-size:.7rem;white-space:pre-wrap">CALC ERROR: ${e.message}\n${e.stack}</div>`;
        console.error('_recalc error:', e);
      }
    }

    _updateStaleDamage(dmg) {
        const el = this._d('staleDmg');
        if (el) el.textContent = (Math.round(dmg * 100) / 100).toString();
    }

    _c(label, val, cls) {
        return `<div class="ikd-result ${cls}"><div class="v">${val}</div><div class="l">${label}</div></div>`;
    }

    async populateFromReplay(fd) {
        await this.ready; // Ensure DOM and initial moves are loaded
        this._d('atk').value = fd.attackerCharId;
        this._atkChar = fd.attackerCharId;
        await this._loadMoves(fd.attackerCharId);
        this._d('def').value = fd.defenderCharId;
        this._defChar = fd.defenderCharId;
        this._d('pct').value = Math.floor(fd.defenderPercent || 0);
        if (fd.stageKey) {
            this._stageKey = fd.stageKey;
            this._d('stageBar').querySelectorAll('.ikd-stage-btn').forEach(b => b.classList.toggle('active', b.dataset.stage === fd.stageKey));
            this._d('fodSliders').style.display = fd.stageKey === 'fountain_of_dreams' ? 'flex' : 'none';
        }
        if (fd.startX != null) this._startX = Math.round(fd.startX);
        if (fd.startY != null) this._startY = Math.round(fd.startY);
        this._positionFrozen = true;
        console.log('[Calc] Position set to:', this._startX, this._startY, '| Stage:', this._stageKey);

        // Hit direction
        if (fd.reverse != null) {
            this._reverse = !!fd.reverse;
            this.container.querySelectorAll('.ikd-dir-btn').forEach(b => {
                b.classList.toggle('active', (b.dataset.dir === 'left') === this._reverse);
            });
        }

        // Trajectory DI from replay
        if (fd.diX != null && fd.diY != null) {
            // Round to Melee precision
            const dx = Math.round(fd.diX / 0.0125) * 0.0125;
            const dy = Math.round(fd.diY / 0.0125) * 0.0125;
            this._diState.t = { x: dx, y: dy, frozen: true };
            this._activeDI = 't';
            this._updateDIDisplay();
        }

        // FoD platform heights from replay viewer
        if (fd.fodLeftY != null) {
            STAGES.fountain_of_dreams.platforms[2].y = fd.fodLeftY;
            this._d('fodLeft').value = fd.fodLeftY;
            this._d('fodLeftVal').textContent = fd.fodLeftY === 0 ? 'Off' : fd.fodLeftY.toFixed(1);
        }
        if (fd.fodRightY != null) {
            STAGES.fountain_of_dreams.platforms[1].y = fd.fodRightY;
            this._d('fodRight').value = fd.fodRightY;
            this._d('fodRightVal').textContent = fd.fodRightY === 0 ? 'Off' : fd.fodRightY.toFixed(1);
        }
        const m = fc.getFrameDataForAction(fd.attackerCharId, fd.actionState);
        console.log('[Calc] getFrameDataForAction:', fd.attackerCharId, fd.actionState, '→', m?.normalizedName || 'NOT FOUND', m ? '' : '(fc._moveMap has char?', fc._moveMap.has(fd.attackerCharId), ')');
        if (m?.normalizedName) {
            this._d('move').value = m.normalizedName;
            this._selectedMove = m;
            this._onMoveChange();
        } else {
            console.warn('[Calc] Could not find move for action:', fd.actionState, 'charId:', fd.attackerCharId);
        }
        this._recalc();
    }
}

export function embedCalculator(container, options = {}) {
    return new IKneeDataUI(container, options);
}
