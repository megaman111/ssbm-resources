/**
 * FightCore - Reusable Melee frame data module
 * Data source: https://github.com/FightCore/frame-data
 */
const FC_CHAR_NAMES = {
    0: "captainfalcon", 1: "donkeykong", 2: "fox", 3: "mrgame%26watch",
    4: "kirby", 5: "bowser", 6: "link", 7: "luigi", 8: "mario",
    9: "marth", 10: "mewtwo", 11: "ness", 12: "peach", 13: "pikachu",
    14: "iceclimbers", 15: "jigglypuff", 16: "samus", 17: "yoshi",
    18: "zelda", 19: "sheik", 20: "falco", 21: "younglink",
    22: "drmario", 23: "roy", 24: "pichu", 25: "ganondorf",
};
const CHAR_WEIGHTS = {
    0: 104, 1: 114, 2: 75, 3: 60, 4: 70, 5: 117, 6: 104, 7: 100,
    8: 100, 9: 87, 10: 85, 11: 94, 12: 90, 13: 80, 14: 88, 15: 60,
    16: 110, 17: 108, 18: 90, 19: 90, 20: 80, 21: 85, 22: 100,
    23: 85, 24: 55, 25: 109,
};
const ACTION_TO_FC_MOVE = {
    "Attack11": "jab1", "Attack12": "jab2", "Attack13": "jab3",
    "Attack100Start": "rapidjabs", "Attack100Loop": "rapidjabs",
    "Attack100End": "rapidjabs", "AttackDash": "dattack",
    "AttackS3Hi": "ftilt", "AttackS3HiS": "ftilt", "AttackS3S": "ftilt",
    "AttackS3LwS": "ftilt", "AttackS3Lw": "ftilt",
    "AttackHi3": "utilt", "AttackLw3": "dtilt",
    "AttackS4Hi": "fsmash", "AttackS4HiS": "fsmash", "AttackS4S": "fsmash",
    "AttackS4LwS": "fsmash", "AttackS4Lw": "fsmash",
    "AttackHi4": "usmash", "AttackLw4": "dsmash",
    "AttackAirN": "nair", "AttackAirF": "fair", "AttackAirB": "bair",
    "AttackAirHi": "uair", "AttackAirLw": "dair",
    "Catch": "grab", "CatchDash": "dashgrab",
    "ThrowF": "fthrow", "ThrowB": "bthrow",
    "ThrowHi": "uthrow", "ThrowLw": "dthrow",
    "CliffAttackSlow": "ledgeattackslow",
    "CliffAttackQuick": "ledgeattackfast",
    "DownAttackU": "getupattackback",
    "DownAttackD": "getupattackstomach",
};
const SPECIAL_TO_FC_MOVE = {
    "SpecialN": "neutralb", "SpecialNStart": "neutralb",
    "SpecialNLoop": "neutralb", "SpecialNEnd": "neutralb",
    "SpecialNCansel": "neutralb", "SpecialNCancel": "neutralb",
    "SpecialAirN": "neutralb", "SpecialAirNStart": "neutralb",
    "SpecialAirNLoop": "neutralb", "SpecialAirNEnd": "neutralb",
    "SpecialS": "sideb", "SpecialSStart": "sideb",
    "SpecialS1": "sideb", "SpecialS2": "sideb", "SpecialSEnd": "sideb",
    "SpecialAirS": "sideb", "SpecialAirSStart": "sideb",
    "SpecialAirS1": "sideb", "SpecialAirS2": "sideb",
    "SpecialAirSEnd": "sideb",
    "SpecialHi": "upb", "SpecialHiStart": "upb", "SpecialHiHold": "upb",
    "SpecialAirHi": "upb", "SpecialAirHiStart": "upb",
    "SpecialLw": "downb", "SpecialLwStart": "downb",
    "SpecialLwLoop": "downb", "SpecialLwHit": "downb",
    "SpecialLwEnd": "downb", "SpecialAirLw": "downb",
    "SpecialAirLwStart": "downb", "SpecialAirLwLoop": "downb",
    "SpecialAirLwHit": "downb", "SpecialAirLwEnd": "downb",
};
const DANCING_BLADE_MAP = {
    "SpecialS1": "sideb1", "SpecialAirS1": "sideb1",
    "SpecialS2Hi": "sideb2up", "SpecialAirS2Hi": "sideb2up",
    "SpecialS2Lw": "sideb2down", "SpecialAirS2Lw": "sideb2down",
    "SpecialS3Hi": "sideb3up", "SpecialAirS3Hi": "sideb3up",
    "SpecialS3S": "sideb3side", "SpecialAirS3S": "sideb3side",
    "SpecialS3Lw": "sideb3down", "SpecialAirS3Lw": "sideb3down",
    "SpecialS4Hi": "sideb4up", "SpecialAirS4Hi": "sideb4up",
    "SpecialS4S": "sideb4side", "SpecialAirS4S": "sideb4side",
    "SpecialS4Lw": "sideb4down", "SpecialAirS4Lw": "sideb4down",
};
const FC_DATA_BASE = "https://raw.githubusercontent.com/FightCore/frame-data/main/data";
export class FightCore {
    constructor() {
        this._cache = new Map();
        this._loading = new Map();
        this._moveMap = new Map();
    }

    async getMoves(charId) {
        if (this._cache.has(charId)) return this._cache.get(charId);
        if (this._loading.has(charId)) return this._loading.get(charId);
        const folderName = FC_CHAR_NAMES[charId];
        if (!folderName) return [];
        const promise = (async () => {
            try {
                const resp = await fetch(FC_DATA_BASE + "/" + folderName + "/moves.json");
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                const moves = await resp.json();
                this._cache.set(charId, moves);
                const map = new Map();
                for (const m of moves) {
                    if (m.normalizedName) map.set(m.normalizedName, m);
                }
                this._moveMap.set(charId, map);
                this._loading.delete(charId);
                return moves;
            } catch (e) {
                console.warn("FightCore: failed to load moves for char " + charId, e);
                this._cache.set(charId, []);
                this._moveMap.set(charId, new Map());
                this._loading.delete(charId);
                return [];
            }
        })();
        this._loading.set(charId, promise);
        return promise;
    }

    getMove(charId, normalizedName) {
        const map = this._moveMap.get(charId);
        return map ? (map.get(normalizedName) || null) : null;
    }

    getFrameDataForAction(charId, actionName) {
        if (!actionName) return null;
        const map = this._moveMap.get(charId);
        if (!map) return null;
        if ((charId === 9 || charId === 23) && DANCING_BLADE_MAP[actionName]) {
            return map.get(DANCING_BLADE_MAP[actionName]) || null;
        }
        let fcName = ACTION_TO_FC_MOVE[actionName];
        if (fcName) return map.get(fcName) || null;
        fcName = SPECIAL_TO_FC_MOVE[actionName];
        if (fcName) return map.get(fcName) || null;
        return map.get(actionName.toLowerCase()) || null;
    }

    async getCCPercents(attackerId, defenderId) {
        const moves = await this.getMoves(attackerId);
        if (!moves.length) return [];
        const defWeight = CHAR_WEIGHTS[defenderId] || 100;
        const results = [];
        for (const move of moves) {
            if (!move.hits || !move.hits.length) continue;
            for (const hit of move.hits) {
                if (!hit.hitboxes || !hit.hitboxes.length) continue;
                let bestHb = null;
                for (const hb of hit.hitboxes) {
                    if (hb.damage > 0 && (!bestHb || hb.damage > bestHb.damage)) bestHb = hb;
                }
                if (!bestHb) continue;
                const ccMax = this._calcMaxPercent(bestHb, defWeight, 80, 1 / 3);
                const asdiMax = this._calcMaxPercent(bestHb, defWeight, 47, 1.0);
                results.push({
                    moveName: move.name,
                    normalizedName: move.normalizedName,
                    hitName: hit.name || "unknown",
                    damage: bestHb.damage,
                    angle: bestHb.angle,
                    knockbackGrowth: bestHb.knockbackGrowth,
                    baseKnockback: bestHb.baseKnockback,
                    setKnockback: bestHb.setKnockback,
                    ccMaxPercent: ccMax,
                    asdiMaxPercent: asdiMax,
                });
            }
        }
        const deduped = new Map();
        for (const r of results) {
            const key = r.moveName + "|" + r.hitName;
            if (!deduped.has(key) || r.ccMaxPercent < deduped.get(key).ccMaxPercent) {
                deduped.set(key, r);
            }
        }
        return [...deduped.values()];
    }

    _calcMaxPercent(hb, weight, kbThreshold, ccMult) {
        const { damage, knockbackGrowth, baseKnockback, setKnockback } = hb;
        if (setKnockback > 0) {
            const kb = (((setKnockback * 10) * 200 / (weight + 100) * 1.4 + 18) * knockbackGrowth / 100) * ccMult;
            return kb < kbThreshold ? 999 : -1;
        }
        if (knockbackGrowth === 0 && baseKnockback === 0) return 999;
        const kb0 = this._calcKB(damage, 0, weight, knockbackGrowth, baseKnockback, ccMult);
        if (kb0 >= kbThreshold) return -1;
        const kb999 = this._calcKB(damage, 999, weight, knockbackGrowth, baseKnockback, ccMult);
        if (kb999 < kbThreshold) return 999;
        let lo = 0, hi = 999;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            const kb = this._calcKB(damage, mid, weight, knockbackGrowth, baseKnockback, ccMult);
            if (kb < kbThreshold) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    _calcKB(damage, percent, weight, kbg, bkb, ccMult) {
        const p = percent + damage;
        return (((p / 10 + p * damage / 20) * 200 / (weight + 100) * 1.4 + 18) * kbg / 100 + bkb) * ccMult;
    }
}
