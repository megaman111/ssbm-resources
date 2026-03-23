import { FightCore } from './fightcore.js';
import { fullCalc, findKillPercent, CHAR_PHYSICS, STAGES, CHAR_NAMES } from './ikneedata-calc.js';

const fc = new FightCore();

async function testChar(charId) {
    const moves = await fc.getMoves(charId);
    if (!moves.length) { console.log(`  No moves loaded`); return; }
    
    for (const m of moves) {
        if (!m.hits || !m.hits.length) continue;
        
        for (let hi = 0; hi < m.hits.length; hi++) {
            const hit = m.hits[hi];
            if (!hit?.hitboxes?.length) continue;
            
            for (let hbi = 0; hbi < hit.hitboxes.length; hbi++) {
                const hb = hit.hitboxes[hbi];
                const mp = {
                    damage: hb.damage ?? 0,
                    angle: hb.angle ?? 0,
                    kbg: hb.knockbackGrowth ?? 0,
                    bkb: hb.baseKnockback ?? 0,
                    setKb: hb.setKnockback ?? 0,
                };
                if (mp.damage === 0) continue;
                
                try {
                    const result = fullCalc({
                        ...mp, percent: 50,
                        defenderCharId: 2,
                        stageKey: 'final_destination',
                        startX: 0, startY: 0,
                        diAngle: null,
                        crouchCancel: false, vcancel: false, chargeInterrupt: false,
                        metal: false, ice: false, reverse: false,
                    });
                    
                    if (!result) continue;
                    
                    // Access all the properties _recalc accesses
                    result.knockback.toFixed(1);
                    result.hitstun + 'f';
                    result.hitlag + 'f';
                    result.launchSpeed.toFixed(2);
                    result.launchAngle.baseAngle + '°';
                    result.shieldStun + 'f';
                    
                    const kill = findKillPercent({
                        ...mp, defenderCharId: 2, stageKey: 'final_destination',
                        startX: 0, startY: 0,
                        crouchCancel: false, reverse: false,
                    });
                } catch (e) {
                    console.log(`  CRASH: ${CHAR_NAMES[charId]} ${m.name} hit[${hi}] hb[${hbi}]: ${e.message}`);
                    console.log(`    hb data: ${JSON.stringify(hb)}`);
                    console.log(`    ${e.stack}`);
                }
            }
        }
    }
}

async function main() {
    for (let id = 0; id <= 25; id++) {
        console.log(`Testing ${CHAR_NAMES[id]} (${id})...`);
        const t0 = Date.now();
        await testChar(id);
        console.log(`  Done in ${Date.now() - t0}ms`);
    }
    console.log('\nAll characters tested!');
}

main().catch(e => console.error('Fatal:', e));
