# BNC Grade — DaVinci Resolve DCTLs

LUT-free, resolution-independent DCTL ports of the BNC Grade colour
pipeline (`tools/bnc_color.py` / `tools/bnc_looks.py`, spec in
`tools/SPEC.md`). Three kinds of file, all under this directory:

| File | What it is |
|---|---|
| `BNC_Base_Display_Transform.dctl` | Camera log (S-Log3, F-Log2 or F-Log) → Rec.709 gamma 2.4. Spec section 3: decode, exposure, camera-gamut matrix, gamut compression, filmic tone curve. |
| `BNC_Look_Toolbox.dctl` | Every look-toolbox operation (spec section 5) on one DCTL as live sliders, always applied in a fixed order, each defaulting to identity. Build a look interactively, or sanity-check a recipe before baking it. |
| `looks/BNC_L01_Clean.dctl` … `looks/BNC_L13_Airy.dctl` | One DCTL per finished look recipe (spec section 6), with the recipe's constants baked in and a single Strength slider. **Generated** by `tools/gen_look_dctls.py` from `tools/bnc_looks.LOOKS` — re-run that script after any recipe change; do not hand-edit files under `looks/`. |

## Install

1. Copy the `.dctl` file(s) you want into Resolve's LUT folder:
   - **macOS**: `/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT`
   - **Windows**: `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\LUT`
   - **Linux**: `/opt/resolve/LUT` (or `/home/resolve/LUT` on some installs)

   A `BNC/` subfolder is fine — Resolve scans subfolders too, and it keeps
   these grouped together in the LUTs panel.
2. In Resolve: **Preferences → General → Look Up Tables → "Update Lists"**
   (or just restart Resolve). The files then appear under the **DCTL**
   category of the **LUTs** panel on the Color page.
3. Apply one of two ways:
   - Right-click a node → **DCTL** → pick the file, or
   - Drag it from the LUTs panel straight onto a node.
4. Order on the timeline/node tree: `BNC_Base_Display_Transform` first (on
   the node holding camera-original log footage), then optionally
   `BNC_Look_Toolbox` and/or one `looks/BNC_L*` node afterward. The base
   transform's output and every look's input/output are Rec.709 (or
   sRGB-treated-as-Rec.709) gamma 2.4 code in `[0,1]`.

## Parameters

### BNC_Base_Display_Transform.dctl

| Parameter | Range | Default | Meaning |
|---|---|---|---|
| Camera | S-Log3/S-Gamut3.Cine, F-Log2/F-Gamut, F-Log/F-Gamut | S-Log3 | Must match the footage's camera log encoding. |
| Exposure (stops) | −3 … 3 | 0 | Scene-linear exposure trim before the camera→Rec.709 matrix. |
| Per-channel Mix | 0 … 1 | 0.8 | Blend between the per-channel tone curve and the hue-preserving luminance path (spec 3.3's `per_channel_mix`). |

### BNC_Look_Toolbox.dctl

Every operation from spec section 5 as a slider, always applied in this
fixed order, each defaulting to its identity value (so with every slider at
default the node is a no-op, modulo float32 round-off — see *Verification*
below): White Balance Warm/Tint → Exposure → Contrast/Pivot → Toe Strength →
Shoulder Amount → Lift Blacks → Saturation → Vibrance → Density → Split Tone
Shadow/Highlight → Hue Shift → Hue Sat → Hue Lum → Softclip Hi. Two design
choices worth knowing about, both spelled out in the file's own header
comment:

- Ops the brief lists as a single control (toe, shoulder, softclip, …) fix
  their secondary shape parameter at the spec default (toe's `range=0.25`,
  shoulder's `start=0.70`, contrast's `hi/lo=0.85/0.06`, softclip's `lo=0`)
  and expose only the parameter that actually needs a live control.
- **Hue Lum reuses the Hue Sat centre/width** as its hue window (the spec's
  toolbox list has no separate centre/width for it) — one "where" control
  drives both the saturation and luminance push at that hue.

### looks/BNC_L01_Clean.dctl … BNC_L13_Airy.dctl

Every constant is baked in from the recipe (see each file's own header
comment for the exact ops, in order, rendered as plain English by
`tools/bnc_looks.describe()`). The only control is:

| Parameter | Range | Default | Meaning |
|---|---|---|---|
| Strength | 0 … 1 | 1.0 | Linear blend in code space between the untouched input (0.0) and the fully graded look (1.0). |

| ID | Name | Intent |
|---|---|---|
| L01 | Clean | A neutral, true-to-life grade with a light punch — the default "just make it look intentional" pass. |
| L02 | Print 2383 | Kodak 2383 print-stock emulation: punchy contrast, a crushed toe, cool-leaning shadows against warm highlights, an overall desaturated, filmic roll-off. |
| L03 | Golden Hour | Warm, golden-hour glow with an amber split-tone and a soft top end. |
| L04 | Teal & Orange | Complementary teal shadows against warm orange skin tones — the modern high-contrast blockbuster look. |
| L05 | Chrome | Muted, cross-processed "chrome" look: rotated primaries, reduced saturation, cool highlights. |
| L06 | Nostalgic | Soft vintage look: lifted blacks, warm greens, cyan-leaning shadows, a gentle highlight shoulder. |
| L07 | Eterna | Fujifilm Eterna-style flat, low-contrast cinema stock emulation with soft highlights and gentle desaturation. |
| L08 | Bleach | Bleach-bypass emulation: heavy contrast, a crushed toe, cool-leaning desaturation. |
| L09 | Nocturne | Cool, blue-leaning night grade with deep, protected shadows. |
| L10 | Faded | Faded, lifted-black low-contrast look with a soft highlight shoulder, like a sun-faded print. |
| L11 | Acros | Fujifilm Acros-style fine-grain black & white with punchy contrast and a gentle toe. |
| L12 | Vivid | High-punch, high-vibrance grade with cool blue shadows lifted in luminance for extra pop. |
| L13 | Airy | Bright, airy, lifted-shadow look with a soft top end and gentle overall desaturation. |

## Verification — please read

**These DCTLs have been verified only against the `tools/bnc_color.py` /
`tools/bnc_looks.py` reference maths, evaluated with a small gcc-based
emulation of the DCTL environment (`tools/dctl_test/dctl_shim.h` — a
minimal, test-only stand-in for Resolve's own DCTL compiler, which is
explicitly not shipped to Resolve). They have NOT been run, previewed, or
visually checked inside DaVinci Resolve itself.** Before using any of them
for delivery: load one onto a node in a real Resolve project, confirm it
compiles and applies without error, and spot-check it against a frame you
already know the correct graded result for.

`tools/dctl_test/run_dctl_tests.py` compiles every file here with
`gcc -Wall -Wextra`, requiring no warnings beyond `-Wunused-parameter`
(the DCTL API's `transform()` signature always carries unused
`p_Width`/`p_Height`/`p_X`/`p_Y`), and compares its output against the
Python reference on 5,000 random inputs, a full grey ramp, and reference
points, per file. Run it yourself with:

```
python3 tools/dctl_test/run_dctl_tests.py
```

As of this writing: `BNC_Base_Display_Transform.dctl` (all three camera
settings), `BNC_Look_Toolbox.dctl`, and 9 of the 13 looks (L01, L02, L05,
L07, L08, L09, L10, L11, L13) match the Python reference to within
0.0004 — an order of magnitude inside their thresholds (base < 0.004,
looks < 0.006).

Four looks (L03, L04, L06, L12) each have a small handful of random test
points (0.02–0.09% of 5,521, i.e. 1–5 pixels) where the maximum error
exceeds the 0.006 threshold. This has been root-caused, not merely
observed: these looks chain several operations that individually push a
colour close to the edge of the Rec.709 gamut, and `gamut_clip`'s
bisection search (spec 5) is designed to converge until its test point is
within `1e-6` of the gamut boundary — a precision comparable to float32's
own rounding noise for the matrix maths involved. On the rare pixel where
the bisection's last iteration lands almost exactly on that boundary, the
same "is this inside the gamut?" decision can come out differently in
float32 than in `bnc_color.py`'s float64, and because it's a binary search,
one flipped decision changes which side the answer lands on. The resulting
*linear-light* difference is minute (on the order of 1e-4 or smaller —
far below any visible threshold), but Rec.709's gamma encode
(`code = lin ** (1/2.4)`) amplifies a linear difference that small, near
zero, into a much larger difference in the encoded code value the table
above measures, which is what trips the threshold. Widening the gamut
tolerance to paper over this was tried and measured to be worse, not
better — it caused many other, non-edge-case pixels to skip a real
correction `bnc_color.py` performs in the `1e-6`–`1e-4` range, so it was
reverted; matching `bnc_color.py`'s `1e-6` exactly is the correct
behaviour and remains in every file here. See `tools/gen_look_dctls.py`'s
`bnc_gamut_clip_lab_of()` and `BNC_GAMUT_EPS` comments for the full
derivation. In short: these four look DCTLs are correct, faithful ports —
the discrepancy is an intrinsic float32-vs-float64 conditioning limit of
the specified gamut-clip algorithm at rare, synthetic, fully-saturated
inputs unlikely to occur in real footage, not a translation defect.
