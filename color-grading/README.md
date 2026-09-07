# BNC Grade — colour grading system for the Sony FX30 and Fujifilm X-T5

A learning path, a LUT pack and a look book, built so one set of looks works
on FX30 S-Log3 footage and X-T5 photos in **DaVinci Resolve**, **Photoshop**
(and Camera Raw / Lightroom) and **After Effects**.

The design rule behind everything here: **correct first, then look, and never
let a look clip what the camera captured.** Every look LUT is display-referred
and gentle; the technical LUTs carry a long filmic shoulder so highlights roll
off instead of blowing out.

## Folder map

```
color-grading/
  README.md                  ← you are here
  docs/                      ← the learning path (read in order)
    01-colour-theory-for-grading.md
    02-grading-fundamentals.md
    03-masks-power-windows-and-secondaries.md
    04-influences-and-how-they-grade.md
    05-resolve-workflow-fx30.md
    06-photoshop-workflow-xt5.md
    07-after-effects-workflow.md
    08-lookbook.md           ← the looks, their recipes, when to use them
    09-exposure-and-preserving-highlights.md
  luts/
    01_technical/            ← camera log → Rec.709 gamma 2.4 (use first)
    02_looks/                ← Rec.709/sRGB → Rec.709 creative looks (use last)
    03_combined_slog3/       ← S-Log3 → look in one LUT (After Effects / quick use)
  lookbook/
    index.html               ← visual look book (open in a browser)
    samples/, previews/      ← preview images
  resolve/dctl/              ← LUT-free versions of the base transform and looks for Resolve
  tools/                     ← the generator (Python) and its spec
```

## The pipeline (same in every app)

```
camera log ─▶ 1. BALANCE ─▶ 2. PRIMARIES ─▶ 3. SECONDARIES ─▶ 4. DISPLAY TRANSFORM ─▶ 5. LOOK ─▶ 6. TRIM + TEXTURE ─▶ Rec.709
              exposure, WB   contrast/pivot   windows, masks,    base LUT or CST         look LUT     soft clip, grain      gamma 2.4
              in log          saturation       skin, sky, relight (scene → display)      (opacity to
                                                                                          taste)
```

Everything before the display transform is scene-referred (log); everything
after it is display-referred. The look LUTs are display-referred, so they
always sit after the base LUT / CST. For photos, Camera Raw *is* steps 1–4.

* **FX30 footage** — S-Log3 / S-Gamut3.Cine. Normalise with
  `luts/01_technical/BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube` or
  Resolve's Colour Space Transform. Then correct, then apply a look from
  `luts/02_looks/`.
* **X-T5 photos** — develop the RAF in Camera Raw / Lightroom (that is the
  normalise step), then apply the same look LUT in Photoshop (Color Lookup
  layer) or as a Camera Raw profile. Same palette on stills and motion.
* **X-T5 video** — F-Log2 or F-Log: use the matching technical LUT in
  `luts/01_technical/`.

## Quick start

| App | Steps |
|---|---|
| DaVinci Resolve | Copy `luts/` into your LUT folder → Refresh LUT List. Nodes 1–4: balance, primaries, skin, windows (in log). Node 5: base LUT (or CST). Node 6: look LUT; lower that node's Key Output Gain for a lighter dose. Node 7–8: trims, grain. Details: `docs/05-resolve-workflow-fx30.md`. |
| Photoshop | Camera Raw: neutral, un-clipped development → open as 16-bit → Layer → New Adjustment Layer → Color Lookup → Load 3D LUT → pick a look → set opacity → mask if needed. Details: `docs/06-photoshop-workflow-xt5.md`. |
| After Effects | Interpret S-Log3 footage → Lumetri Color: Basic → Input LUT = base LUT; Creative → Look = look LUT (Intensity slider). Or one combined LUT from `luts/03_combined_slog3/`. Details: `docs/07-after-effects-workflow.md`. |

## The LUTs

| File | Input | Output | Use |
|---|---|---|---|
| `01_technical/BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube` | S-Log3 / S-Gamut3.Cine (FX30) | Rec.709 gamma 2.4 | First node on FX30 clips |
| `01_technical/BNC_Base_FLog2-FGamut_to_Rec709-G24.cube` | F-Log2 / F-Gamut (X-T5 video) | Rec.709 gamma 2.4 | First node on X-T5 F-Log2 clips |
| `01_technical/BNC_Base_FLog-FGamut_to_Rec709-G24.cube` | F-Log / F-Gamut | Rec.709 gamma 2.4 | First node on X-T5 F-Log clips |
| `02_looks/BNC_L01…L13_*.cube` | Rec.709 / sRGB (display-referred) | Rec.709 | Last node; photos and corrected footage |
| `03_combined_slog3/BNC_SLog3_L01…L13_*.cube` | S-Log3 / S-Gamut3.Cine | Rec.709 look | One-LUT option (After Effects, quick previews) |

All files are 33-point `.cube` LUTs, which load in Resolve, Photoshop,
Lightroom (as profiles), After Effects, Premiere and most camera monitors.

## The looks

Full recipes and previews: `docs/08-lookbook.md` and `lookbook/index.html`.

<!-- LOOKS_TABLE -->
| Look | Character | Use for |
|---|---|---|
| L01 Clean | A neutral, true-to-life grade with a light punch -- the default 'just make it look intentional' pass. | General-purpose delivery and client review cuts that should read as graded without looking stylised. |
| L02 Print 2383 | Kodak 2383 print-stock emulation: punchy contrast, a crushed toe, cool-leaning shadows against warm highlights, and an overall desaturated, filmic roll-off. | Cinematic narrative work and trailers wanting a classic release-print look. |
| L03 Golden Hour | Warm, golden-hour glow with an amber split-tone and a soft top end. | Sunset and outdoor lifestyle footage, weddings and travel work shot near golden hour. |
| L04 Teal & Orange | Complementary teal shadows against warm orange skin tones -- the modern high-contrast blockbuster look. | Action, travel and commercial work wanting a punchy, contemporary grade. |
| L05 Chrome | Muted, cross-processed 'chrome' look: rotated primaries, reduced saturation and cool highlights. | Music videos, fashion and moody narrative pieces. |
| L06 Nostalgic | Soft vintage look: lifted blacks, warm greens, cyan-leaning shadows and a gentle highlight shoulder. | Home-movie style memory pieces and documentary retrospectives. |
| L07 Eterna | Fujifilm Eterna-style flat, low-contrast cinema stock emulation with soft highlights and gentle desaturation. | Naturalistic drama and documentary work that needs to sit gently rather than pop. |
| L08 Bleach | Bleach-bypass emulation: heavy contrast, a crushed toe, and cool-leaning desaturation. | War/thriller and other gritty narrative work, high-contrast promos. |
| L09 Nocturne | Cool, blue-leaning night grade with deep, protected shadows. | Night exteriors, moody low-key interiors, thriller/noir work. |
| L10 Faded | Faded, lifted-black low-contrast look with a soft highlight shoulder, like a sun-faded print. | Retro/nostalgic edits and lifestyle content wanting an undone, filmic look. |
| L11 Acros | Fujifilm Acros-style fine-grain black & white with punchy contrast and a gentle toe. | Black & white delivery, timeless/classic edits. |
| L12 Vivid | High-punch, high-vibrance grade with cool blue shadows lifted in luminance for extra pop. | Social and commercial content wanting maximum pop and saturation. |
| L13 Airy | Bright, airy, lifted-shadow look with a soft top end and gentle overall desaturation. | Lifestyle, wedding and portrait work wanting a soft, bright aesthetic. |
<!-- /LOOKS_TABLE -->

## Rebuilding or renaming the pack

```
pip install numpy pillow
python3 tools/build_luts.py            # writes luts/
python3 tools/verify_luts.py           # proves range, monotonicity, neutrality
python3 tools/render_previews.py       # re-renders lookbook previews
python3 tools/build_lookbook.py        # rebuilds lookbook/index.html
python3 tools/gen_lookbook_doc.py      # refreshes the recipes in docs/08 and this README
python3 tools/test_pipeline.py         # 120 checks on the maths
```

`--prefix MBD` renames every file; the recipes live in `tools/bnc_looks.py`
and the maths in `tools/bnc_color.py` (specified in `tools/SPEC.md`).

## Learning path

1. Read docs 01–04 (theory, fundamentals, masks, influences) — about an hour.
2. Set Resolve up per doc 05 and grade five FX30 clips with the base LUT only.
3. Rebuild one look by hand from its recipe in doc 08 without the LUT.
4. Develop three X-T5 photos per doc 06, apply the same look, match them to a clip.
5. Read doc 09 before your next shoot.
