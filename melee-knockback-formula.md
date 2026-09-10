# Melee Knockback Formula Reference

## Official Formula (from SmashWiki)

```
KB = (((((p/10 + p×d/20) × 200/(w+100) × 1.4) + 18) × s) + b) × r
```

### Variables:

- **p** = target's percent AFTER damage is added (floored pre-hit % + damage)
- **d** = damage dealt (WITHOUT stale-move negation for non-projectiles)
- **w** = target's weight (100 = default)
- **s** = knockback scaling (KBG) ÷ 100
- **b** = base knockback (BKB)
- **r** = ratio modifiers (crouch cancel, charge interrupt, etc.)

### Important Constants:

- **Tumble threshold**: 80 knockback units
- **Hitstun formula**: `floor(KB × 0.4)` frames
- **Crouch cancel multiplier**: 0.666667× (exactly 2/3)
- **ASDI multiplier**: 1.0× (no reduction)

## Ratio Modifiers (r):

- **Crouch cancel**: 0.666667× (2/3)
- **Smash charge interrupt**: 1.2× (if hit during charge)
- **Frozen state**: 0.25×
- **Type effectiveness** (Pokémon only): 1.1× or 0.9×
- **Size modifiers**: Mushroom/Lightning affect knockback taken
- **Launch rate** (training mode): 0.5× to 2.0×

## Set Knockback

If a move has **set knockback**, then:
- d = set knockback value
- p = always 10
- Result is weight-dependent but damage-independent
- Used for multi-hit move setup hits

## Our Current Implementation

```javascript
// fightcore.js _calcKB function
_calcKB(damage, percent, weight, kbg, bkb, ccMult) {
    const p = percent + damage;
    return ((((((p / 10) + (p * damage / 20)) * (200 / (weight + 100)) * 1.4) + 18) * (kbg / 100)) + bkb) * ccMult;
}
```

### ✅ Verification:

Our formula matches the official Melee formula exactly!

- ✅ `p = percent + damage` (percent after hit)
- ✅ Base formula: `(((p/10 + p×d/20) × 200/(w+100) × 1.4) + 18) × (kbg/100) + bkb`
- ✅ CC multiplier applied at the end (`× ccMult`)

### ⚠️ Potential Improvements:

1. **Set Knockback handling**: Currently not implemented
   - Need to check if `setKnockback > 0`, then use different formula
   
2. **Smash charge interrupt bonus** (1.2×): Not implemented
   - Less relevant for frame data tables, more for replay analysis

3. **Sakurai angle (361°) resolution**: Not implemented
   - Angle becomes 0° at low KB, 45° at high KB
   - Threshold around 32-80 KB units

## References:

- SmashWiki Knockback: https://www.ssbwiki.com/Knockback
- Melee decomp: https://github.com/doldecomp/melee (search for collision/damage functions)
- Tumble threshold: 80.0001 knockback units (verified by community testing)
