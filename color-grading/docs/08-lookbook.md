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
