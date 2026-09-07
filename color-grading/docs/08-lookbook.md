# The BNC Look Book

Thirteen looks, each built from the same small toolbox so you can apply the
LUT *or* rebuild the look by hand in Resolve, Photoshop / Camera Raw or After
Effects. The visual version with previews is `lookbook/index.html`.

Every look is display-referred: it expects a corrected Rec.709 (gamma 2.4) or
sRGB image and returns the same range. On FX30 footage that means the look
sits **after** the base LUT / CST; on X-T5 photos it sits after Camera Raw.

## How to choose

| If the brief is… | Start with | Then consider |
|---|---|---|
| Corporate, product, "just make it clean" | L01 Clean | L05 Chrome for a muted premium feel |
| Cinematic narrative, drama, interviews | L02 Print 2383 | L07 Eterna for softer dialogue scenes |
| Lifestyle, weddings, morning light | L03 Golden Hour | L13 Airy for bright, high-key |
| Action, travel, "blockbuster" | L04 Teal & Orange | L12 Vivid for landscapes |
| Editorial, fashion, street | L05 Chrome / L06 Nostalgic | L10 Faded for a printed-photo feel |
| Night, moody, urban | L09 Nocturne | L08 Bleach for grit |
| Documentary, gritty, war/industrial | L08 Bleach | L11 Acros in black and white |
| Matching X-T5 stills shot in a Fuji simulation | L05 Chrome (Classic Chrome), L06 Nostalgic (Nostalgic Neg), L07 Eterna (Eterna), L11 Acros (Acros), L12 Vivid (Velvia) | |

Rules of thumb: apply at 100% first, then pull the strength back to 60–80%
(Key Output Gain in Resolve, layer opacity in Photoshop, Intensity in
Lumetri). Never stack two looks. If skin looks wrong, fix white balance
*before* the look rather than fighting the LUT.

## The toolbox: one operation, three apps

Every recipe below is a list of these operations in order. This table is how
you reproduce any of them manually.

| Operation (recipe term) | What it does | DaVinci Resolve | Photoshop / Camera Raw | After Effects (Lumetri unless noted) |
|---|---|---|---|---|
| white_balance(warm, tint) | Shifts the whole image warm/cool and green/magenta, luminance preserved | Primaries → Offset wheel, or Temperature/Tint sliders | Camera Raw Temp/Tint; PS Photo Filter at low density | Basic Correction → Temperature / Tint |
| exposure(ev) | Brightens or darkens everything by a fraction of a stop | Primaries → Offset (log) or Gain | Camera Raw Exposure | Basic Correction → Exposure |
| contrast(amount, pivot) | S-curve contrast around the pivot (0.43 = middle grey) with a built-in soft clip | Primaries → Contrast / Pivot (pivot ≈ 0.435) | Curves: S-curve anchored at the midpoint; Camera Raw Contrast | Basic Correction → Contrast; Curves |
| toe(strength, range) | Deepens shadows below the range without touching mids | Custom curve: pull the point at 0.12 down; or Log wheels Shadow | Curves: lower a point at 12–15% input | Curves |
| shoulder(start, k) | Compresses highlights above the start point (matte highlights) | Custom curve: pull the top end down; Soft Clip High | Curves: drop the white point to 0.9–0.95 | Curves |
| lift_blacks(amount) | Raises pure black to the given level (faded/matte) | Primaries → Lift (all channels) | Curves: raise the black point; Camera Raw Blacks + | Basic Correction → Blacks; Curves |
| softclip(hi) | Gentle roll-off of everything above `hi` so nothing hard-clips | Soft Clip High / High Softness | Curves: soften the top | Curves |
| saturation(amount) | Global saturation (hue-safe, perceptual) | Primaries → Saturation | Hue/Saturation layer; Camera Raw Saturation | Basic Correction → Saturation |
| vibrance(amount) | Saturates muted colours more than already-saturated ones | Primaries → Color Boost | Vibrance layer; Camera Raw Vibrance | Creative → Vibrance |
| density(k) | Subtractive saturation: the more saturated a colour, the darker it gets (film-like) | Curves → Sat vs Lum (pull luminance down as saturation rises) | Camera Raw HSL → Luminance −5 to −10 on saturated colours | Curves → Sat vs Lum (via Lumetri Curves in Premiere; in AE use Hue/Sat lightness on colours) |
| split_tone(sh_hue, sh_amt, hi_hue, hi_amt) | Tints shadows toward one hue and highlights toward another | Log wheels: Shadow and Highlight wheels; or Color Warper | Camera Raw Color Grading (Shadows/Highlights wheels); PS Gradient Map at low opacity | Creative → Shadow Tint / Highlight Tint; Color Wheels |
| hue_shift(centre, width, shift) | Rotates one hue band (e.g. blues toward teal) | Curves → Hue vs Hue | Camera Raw HSL → Hue; PS Hue/Saturation on a colour range | Hue/Saturation effect on a colour range; Lumetri HSL Secondary |
| hue_sat(centre, width, mult) | Saturates or mutes one hue band | Curves → Hue vs Sat | Camera Raw HSL → Saturation | Hue/Saturation on a colour range |
| hue_lum(centre, width, mult) | Darkens or lightens one hue band (e.g. deeper blues) | Curves → Hue vs Lum | Camera Raw HSL → Luminance | Hue/Saturation → Lightness on a range |
| bw_mix(r, g, b) | Black and white with a channel mix (red-filter style) | Primaries → RGB Mixer, Monochrome on | Black & White adjustment layer sliders | Channel Mixer, Monochrome |
| tint(hue, amount) | Uniform colour tint (toning for B&W) | Primaries → Offset | Photo Filter; Color Balance | Tint effect at low amount |

All hue centres in the recipes are Oklab hue angles: red 29°, skin/orange
about 60°, yellow 110°, green 142°, cyan 195°, blue 264°, magenta 328°.
"Width" is the half-width of the band in degrees.

## The looks

(Recipes and previews are generated from `tools/bnc_looks.py`; see the
table below, which the build script keeps in sync.)

<!-- LOOKS_TABLE -->
### L01 Clean

A neutral, true-to-life grade with a light punch -- the default 'just make it look intentional' pass.

**Use for:** General-purpose delivery and client review cuts that should read as graded without looking stylised.

**Files:** `luts/02_looks/BNC_L01_Clean.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L01_Clean.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.05 around pivot 0.43 (soft clip above 0.92, below 0.06)
2. Film density 0.03 (subtractive darkening of saturated colours)
3. Vibrance × 1.04 (protects already-saturated colours)

### L02 Print 2383

Kodak 2383 print-stock emulation: punchy contrast, a crushed toe, cool-leaning shadows against warm highlights, and an overall desaturated, filmic roll-off.

**Use for:** Cinematic narrative work and trailers wanting a classic release-print look.

**Files:** `luts/02_looks/BNC_L02_Print2383.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L02_Print2383.cube` (S-Log3 in)

**Recipe (in order):**

1. White balance warmer (+0.010)
2. Contrast 1.20 around pivot 0.43 (soft clip above 0.85, below 0.06)
3. Shadow toe: strength 0.40 over the bottom 0.30 of range
4. Hue shift: blue (264° ±45°) rotated -6°
5. Hue shift: yellow (110° ±30°) rotated -8°
6. Saturation of red (29° ±30°) × 0.90
7. Saturation of green (142° ±40°) × 0.90
8. Film density 0.14 (subtractive darkening of saturated colours)
9. Shadows toned toward cyan (195°) by 0.014, highlights toward orange (75°) by 0.014
10. Saturation × 0.90
11. Soft clip highlights above 0.86

### L03 Golden Hour

Warm, golden-hour glow with an amber split-tone and a soft top end.

**Use for:** Sunset and outdoor lifestyle footage, weddings and travel work shot near golden hour.

**Files:** `luts/02_looks/BNC_L03_GoldenHour.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L03_GoldenHour.cube` (S-Log3 in)

**Recipe (in order):**

1. White balance warmer (+0.050), toward green (-0.010)
2. Contrast 1.10 around pivot 0.43 (soft clip above 0.85, below 0.06)
3. Shadows toned toward red (40°) by 0.008, highlights toward orange (65°) by 0.026
4. Saturation of orange (60° ±35°) × 1.08
5. Film density 0.06 (subtractive darkening of saturated colours)
6. Blacks lifted by 0.008 (raises the shadow floor)
7. Vibrance × 1.06 (protects already-saturated colours)
8. Soft clip highlights above 0.88

### L04 Teal & Orange

Complementary teal shadows against warm orange skin tones -- the modern high-contrast blockbuster look.

**Use for:** Action, travel and commercial work wanting a punchy, contemporary grade.

**Files:** `luts/02_looks/BNC_L04_TealOrange.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L04_TealOrange.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.12 around pivot 0.43 (soft clip above 0.85, below 0.06)
2. Shadows toned toward cyan (210°) by 0.042, highlights toward orange (55°) by 0.020
3. Hue shift: blue (264° ±45°) rotated -16°
4. Hue shift: green (142° ±40°) rotated +20°
5. Saturation of green (142° ±40°) × 0.85
6. Saturation of orange (60° ±25°) × 1.06
7. Film density 0.08 (subtractive darkening of saturated colours)
8. Soft clip highlights above 0.88

### L05 Chrome

Muted, cross-processed 'chrome' look: rotated primaries, reduced saturation and cool highlights.

**Use for:** Music videos, fashion and moody narrative pieces.

**Files:** `luts/02_looks/BNC_L05_Chrome.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L05_Chrome.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.15 around pivot 0.43 (soft clip above 0.85, below 0.06)
2. Shadow toe: strength 0.30 over the bottom 0.30 of range
3. Saturation × 0.82
4. Hue shift: red (29° ±30°) rotated +8°
5. Saturation of red (29° ±30°) × 0.85
6. Hue shift: blue (264° ±45°) rotated -12°
7. Saturation of blue (264° ±45°) × 0.90
8. Hue shift: green (142° ±40°) rotated -10°
9. Saturation of green (142° ±40°) × 0.85
10. Shadows toned toward blue (250°) by 0.010, highlights toward orange (80°) by 0.006
11. Film density 0.10 (subtractive darkening of saturated colours)
12. Soft clip highlights above 0.87

### L06 Nostalgic

Soft vintage look: lifted blacks, warm greens, cyan-leaning shadows and a gentle highlight shoulder.

**Use for:** Home-movie style memory pieces and documentary retrospectives.

**Files:** `luts/02_looks/BNC_L06_Nostalgic.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L06_Nostalgic.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.04 around pivot 0.43 (soft clip above 0.85, below 0.06)
2. Blacks lifted by 0.025 (raises the shadow floor)
3. Saturation × 0.88
4. Hue shift: green (142° ±40°) rotated -14°
5. Saturation of green (142° ±40°) × 0.90
6. Shadows toned toward cyan (190°) by 0.016, highlights toward orange (70°) by 0.030
7. Tint toward magenta (340°) by 0.005
8. Saturation of orange (60° ±30°) × 1.05
9. Film density 0.08 (subtractive darkening of saturated colours)
10. Highlight shoulder from 0.80, roll-off k=0.15

### L07 Eterna

Fujifilm Eterna-style flat, low-contrast cinema stock emulation with soft highlights and gentle desaturation.

**Use for:** Naturalistic drama and documentary work that needs to sit gently rather than pop.

**Files:** `luts/02_looks/BNC_L07_Eterna.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L07_Eterna.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 0.95 around pivot 0.43
2. Blacks lifted by 0.015 (raises the shadow floor)
3. Highlight shoulder from 0.72, roll-off k=0.25
4. Saturation × 0.78
5. Hue shift: green (142° ±40°) rotated +8°
6. Saturation of green (142° ±40°) × 0.85
7. Shadows toned toward cyan (220°) by 0.008, highlights toward orange (60°) by 0.004
8. Film density 0.06 (subtractive darkening of saturated colours)

### L08 Bleach

Bleach-bypass emulation: heavy contrast, a crushed toe, and cool-leaning desaturation.

**Use for:** War/thriller and other gritty narrative work, high-contrast promos.

**Files:** `luts/02_looks/BNC_L08_Bleach.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L08_Bleach.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.28 around pivot 0.43 (soft clip above 0.85, below 0.06)
2. Shadow toe: strength 0.40 over the bottom 0.30 of range
3. Saturation × 0.50
4. Film density 0.15 (subtractive darkening of saturated colours)
5. Shadows toned toward cyan (220°) by 0.006, highlights toward orange (85°) by 0.008
6. Soft clip highlights above 0.85

### L09 Nocturne

Cool, blue-leaning night grade with deep, protected shadows.

**Use for:** Night exteriors, moody low-key interiors, thriller/noir work.

**Files:** `luts/02_looks/BNC_L09_Nocturne.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L09_Nocturne.cube` (S-Log3 in)

**Recipe (in order):**

1. White balance cooler (-0.060)
2. Contrast 1.15 around pivot 0.43 (soft clip above 0.85, below 0.06)
3. Shadow toe: strength 0.30 over the bottom 0.25 of range
4. Shadows toned toward blue (240°) by 0.038, highlights toward orange (60°) by 0.012
5. Saturation of orange (60° ±30°) × 1.05
6. Saturation of green (142° ±40°) × 0.80
7. Saturation × 0.90
8. Film density 0.10 (subtractive darkening of saturated colours)
9. Soft clip highlights above 0.88

### L10 Faded

Faded, lifted-black low-contrast look with a soft highlight shoulder, like a sun-faded print.

**Use for:** Retro/nostalgic edits and lifestyle content wanting an undone, filmic look.

**Files:** `luts/02_looks/BNC_L10_Faded.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L10_Faded.cube` (S-Log3 in)

**Recipe (in order):**

1. Blacks lifted by 0.060 (raises the shadow floor)
2. Contrast 0.98 around pivot 0.43
3. Highlight shoulder from 0.75, roll-off k=0.30
4. Saturation × 0.85
5. Shadows toned toward orange (50°) by 0.012, highlights toward orange (70°) by 0.015
6. Hue shift: green (142° ±40°) rotated -10°
7. Film density 0.04 (subtractive darkening of saturated colours)

### L11 Acros

Fujifilm Acros-style fine-grain black & white with punchy contrast and a gentle toe.

**Use for:** Black & white delivery, timeless/classic edits.

**Files:** `luts/02_looks/BNC_L11_Acros.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L11_Acros.cube` (S-Log3 in)

**Recipe (in order):**

1. Black & white mix: R 0.45 / G 0.45 / B 0.10
2. Contrast 1.15 around pivot 0.43 (soft clip above 0.85, below 0.06)
3. Shadow toe: strength 0.25 over the bottom 0.25 of range
4. Soft clip highlights above 0.88

### L12 Vivid

High-punch, high-vibrance grade with cool blue shadows lifted in luminance for extra pop.

**Use for:** Social and commercial content wanting maximum pop and saturation.

**Files:** `luts/02_looks/BNC_L12_Vivid.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L12_Vivid.cube` (S-Log3 in)

**Recipe (in order):**

1. Contrast 1.12 around pivot 0.43 (soft clip above 0.85, below 0.06)
2. Vibrance × 1.25 (protects already-saturated colours)
3. Luminance of blue (264° ±45°) × 0.90
4. Saturation of green (142° ±40°) × 1.10
5. Hue shift: green (142° ±40°) rotated +6°
6. Film density 0.14 (subtractive darkening of saturated colours)
7. Soft clip highlights above 0.88

### L13 Airy

Bright, airy, lifted-shadow look with a soft top end and gentle overall desaturation.

**Use for:** Lifestyle, wedding and portrait work wanting a soft, bright aesthetic.

**Files:** `luts/02_looks/BNC_L13_Airy.cube` (Rec.709 in) · `luts/03_combined_slog3/BNC_SLog3_L13_Airy.cube` (S-Log3 in)

**Recipe (in order):**

1. Exposure +0.12 EV
2. Blacks lifted by 0.030 (raises the shadow floor)
3. Contrast 0.92 around pivot 0.50
4. Highlight shoulder from 0.70, roll-off k=0.15
5. Saturation × 0.90
6. Shadows toned toward blue (230°) by 0.006, highlights toward red (25°) by 0.012
7. Saturation of green (142° ±40°) × 0.90

<!-- /LOOKS_TABLE -->
