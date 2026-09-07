# BNC Grade — LUT pipeline specification (v1.0)

This document is the single source of truth for `tools/build_luts.py`,
`tools/verify_luts.py`, `tools/render_previews.py` and the DCTL ports.
Implement exactly what is written here. Where a number is given, use it
verbatim. Where the spec says "parameter", expose it as a Python function
argument with the stated default.

Goals:

1. Technical ("base") LUTs that convert camera log footage to Rec.709 /
   gamma 2.4 with a filmic highlight roll-off that never hard-clips inside
   the camera's range. Cameras: Sony FX30 (S-Log3 / S-Gamut3.Cine), Fujifilm
   X-T5 (F-Log2 / F-Gamut and F-Log / F-Gamut).
2. Creative "look" LUTs that take display-referred Rec.709 (gamma 2.4) or
   sRGB-like input in [0,1] and return the same range, built from a small
   toolbox of documented operations so every look can be reproduced by hand
   in Resolve, Photoshop or After Effects.
3. Combined LUTs (camera log → look) computed analytically (no LUT-of-LUT).
4. A verifier that proves the files are monotone, neutral on the grey axis,
   in range, NaN-free and match reference values.

All maths in float64 numpy. Vectorise over arrays of shape (..., 3).
Never use scipy (not installed). Only numpy and Pillow are available.

---------------------------------------------------------------------------

## 1. Conventions

* "code" = encoded value in [0,1] as stored in a .cube (input or output).
* Rec.709 display encoding is a pure power: `lin = code ** 2.4`,
  `code = lin ** (1/2.4)`. Clamp lin to [0,1] before encoding. Treat
  sRGB input the same way (the difference is negligible for these looks).
* Rec.709 luminance weights (linear): Y = 0.2126 R + 0.7152 G + 0.0722 B.
* Middle grey: 0.18 scene-linear. Target display code for grey: 0.43.
* "t" = stops relative to middle grey: `t = log2(max(x, 1e-6) / 0.18)`.
* smoothstep(e0, e1, x): u = clip((x-e0)/(e1-e0), 0, 1); return u*u*(3-2u).
* All angle maths in degrees; hue window `w(h; centre, width)`:
  d = smallest angular distance between h and centre (0..180);
  w = 0.5*(1+cos(pi*d/width)) if d < width else 0. (`width` is the
  half-width where influence reaches zero.)

## 2. Camera decodes (code → scene-linear reflectance)

### 2.1 Sony S-Log3 (input code y in [0,1], full-range normalised)

```
if y >= 171.2102946929/1023:
    x = (10 ** ((y*1023 - 420) / 261.5)) * (0.18 + 0.01) - 0.01
else:
    x = (y*1023 - 95) * 0.01125000 / (171.2102946929 - 95)
```
Encode (needed for synthetic previews and tests):
```
if x >= 0.01125000:
    y = (420 + log10((x + 0.01) / (0.18 + 0.01)) * 261.5) / 1023
else:
    y = (x * (171.2102946929 - 95) / 0.01125000 + 95) / 1023
```
Reference values (assert in tests, tolerance 1e-4):
* x = 0.18 → y = 0.410557 (420/1023)
* x = 0.90 → y = 0.584447
* y = 1.0  → x ≈ 38.42
* y = 0.0929 (95/1023) → x = 0

### 2.2 Fujifilm F-Log2 and F-Log (same formula family)

```
encode: y = c*log10(a*x + b) + d   if x >= cut1  else  y = e*x + f
decode: x = (10**((y - d)/c))/a - b/a  if y >= cut2  else  x = (y - f)/e
```
F-Log2: a=5.555556, b=0.064829, c=0.245281, d=0.384316, e=8.799461,
        f=0.092864, cut1=0.000889, cut2=0.100686685370811
F-Log : a=0.555556, b=0.009468, c=0.344676, d=0.790453, e=8.735631,
        f=0.092864, cut1=0.00089,  cut2=0.100537775223865
Reference values (tolerance 1e-3): F-Log2 x=0.18 → y≈0.3910;
F-Log x=0.18 → y≈0.4593; F-Log2 y=1.0 → x≈58.2.

### 2.3 Gamut matrices (scene-linear, D65 → D65, no adaptation needed)

S-Gamut3.Cine → Rec.709:
```
[[ 1.6269474097, -0.5401385389, -0.0868088709],
 [-0.1785155271,  1.4179409275, -0.2394254003],
 [-0.0444361150, -0.1959199662,  1.2403560812]]
```
F-Gamut (= ITU-R BT.2020 primaries) → Rec.709:
```
[[ 1.6604910021, -0.5876411388, -0.0728498633],
 [-0.1245504745,  1.1328998971, -0.0083494226],
 [-0.0181507634, -0.1005788980,  1.1187296614]]
```
Rec.709 → S-Gamut3.Cine (for synthetic log previews):
```
[[0.6456794776, 0.2591145470, 0.0952059754],
 [0.0875299915, 0.7596995626, 0.1527704459],
 [0.0369574199, 0.1292809048, 0.8337616753]]
```
Each row sums to 1.0 (white maps to white). Assert that in tests.
Derivation (for the reader): RGB→XYZ from primaries
S-Gamut3.Cine R(0.766,0.275) G(0.225,0.800) B(0.089,-0.087),
BT.2020 R(0.708,0.292) G(0.170,0.797) B(0.131,0.046),
Rec.709 R(0.64,0.33) G(0.30,0.60) B(0.15,0.06), white D65 (0.3127,0.3290).

## 3. Base display transform ("BNC Base")

Input: camera code RGB in [0,1]. Output: Rec.709 gamma 2.4 code in [0,1].

```
step 1  lin_cam = decode(code)                     # per channel, section 2
step 2  lin_cam *= 2 ** exposure_ev                # parameter, default 0.0
step 3  lin709 = M_cam_to_709 @ lin_cam
step 4  lin709 = gamut_compress(lin709)            # section 3.1
step 5  out = tonemap_blend(lin709)                # section 3.2 + 3.3
step 6  clamp to [0,1]
```

### 3.1 Gamut compression (derived from the ACES 1.3 reference gamut compressor)

Operates per pixel in Rec.709 linear.
```
ach = max(r, g, b)
if ach <= 1e-6: return unchanged
d_i = (ach - c_i) / ach                 # for i in r,g,b; 0 for the max channel
d_i' = compress(d_i, thr_i, power_i)
c_i' = ach - d_i' * ach
```
where, for d > thr (else identity):
```
x  = (d - thr) / (1 - thr)
d' = thr + (1 - thr) * x / (1 + x ** power) ** (1 / power)
```
The curve is the identity up to `thr`, C1-continuous at the knee, and
asymptotes exactly at the gamut boundary (d' → 1 as d → ∞), so every input
lands inside Rec.709 with no negative channels. (The ACES original maps its
`limit` distance to exactly 1.0 and lets larger distances stay outside the
gamut; that leaves negative channel values which, combined with the log tone
curve, produce a kink a 33-point LUT cannot follow. The change above removes
it.)
Parameters (per channel r,g,b = cyan, magenta, yellow directions):
thr = (0.80, 0.80, 0.80), power = (1.2, 1.2, 1.2).
Property to assert: for any input, all channels of the compressed result are
≥ -1e-9; a colour exactly on the boundary (d = 1) maps to d' ≈ 0.912.

### 3.2 Tone curve T(t) — monotone PCHIP through control points

Input t (stops from grey), output display code. Control points:

```
t:   -9    -8     -7     -6     -5     -4     -3     -2     -1     0
y:  0.000  0.002  0.007  0.017  0.036  0.068  0.120  0.195  0.295  0.430
t:   +1    +2     +3     +4     +5     +6     +7     +8
y:  0.595  0.735  0.835  0.905  0.950  0.978  0.993  1.000
```
Outside the range: t ≤ -9 → 0.0, t ≥ +8 → 1.0.
Interpolation: Fritsch–Carlson monotone cubic (PCHIP). Implement it
yourself in numpy (~40 lines): compute secant slopes, set node slopes to
the harmonic-mean rule (zero where secants change sign), evaluate the
Hermite cubic. Assert monotonic output on a fine grid.

### 3.3 Per-channel / luminance blend

```
rgb_pc  = T(log2(max(rgb, 1e-6)/0.18))                  # per channel, code
Y       = 0.2126 r + 0.7152 g + 0.0722 b                 # linear
Yc      = T(log2(max(Y, 1e-6)/0.18))                     # code
ratio   = (Yc ** 2.4) / max(Y, 1e-6)
rgb_lp  = clip(rgb * ratio, 0, 1) ** (1/2.4)             # hue-preserving path
out     = k * rgb_pc + (1 - k) * rgb_lp,   k = 0.8 (parameter per_channel_mix)
```
Reference values to assert for the S-Log3 base (tolerance 0.01, and the
three output channels equal within 0.002 for neutral inputs):
* S-Log3 code 0.410557 (grey) → 0.430
* S-Log3 code 0.584447 (90% white) → ≈ 0.77 (tolerance 0.02)
* S-Log3 code 1.0 → ≥ 0.995
* S-Log3 code 0.0929 or lower → ≤ 0.002
* The grey-axis output must be non-decreasing in the input.

## 4. Oklab (used by the look toolbox)

Linear Rec.709/sRGB → Oklab:
```
M1 = [[0.4122214708, 0.5363325363, 0.0514459929],
      [0.2119034982, 0.6806995451, 0.1073969566],
      [0.0883024619, 0.2817188376, 0.6299787005]]
lms  = M1 @ lin ;  lms_ = cbrt(lms)   (use np.cbrt, handles negatives)
M2 = [[0.2104542553,  0.7936177850, -0.0040720468],
      [1.9779984951, -2.4285922050,  0.4505937099],
      [0.0259040371,  0.7827717662, -0.8086757660]]
Lab = M2 @ lms_
```
Oklab → linear:
```
M2inv = [[1.0,  0.3963377774,  0.2158037573],
         [1.0, -0.1055613458, -0.0638541728],
         [1.0, -0.0894841775, -1.2914855480]]
lms = (M2inv @ Lab) ** 3 ;  lin = M1inv @ lms
M1inv = [[ 4.0767416621, -3.3077115913,  0.2309699292],
         [-1.2684380046,  2.6097574011, -0.3413193965],
         [-0.0041960863, -0.7034186147,  1.7076147010]]
```
Assert round trip error < 1e-6 on random colours, and that lin (1,1,1)
gives L ≈ 1.0, a ≈ b ≈ 0. Chroma C = hypot(a,b); hue h = degrees(atan2(b,a)) mod 360.
Reference hues (sRGB primaries/secondaries, ±2°): red 29°, yellow 110°,
green 142°, cyan 195°, blue 264°, magenta 328°. Skin tones sit ≈ 45–75°.

## 5. Look toolbox

A look is an ordered list of operations applied to display-referred data.
Wrapper: `apply_look(code_in, ops) -> code_out`:
```
lin = clip(code_in, 0, 1) ** 2.4
for op in ops: lin = OP[op.name](lin, **op.kwargs)     # every op takes and returns linear RGB
lin = gamut_clip(lin)
return clip(lin, 0, 1) ** (1/2.4)
```
Ops that are naturally defined on code values convert internally
(lin → code → op → lin). Ops defined in Oklab convert internally and call
`gamut_clip` afterwards. Definitions:

* `exposure(ev)`: lin * 2**ev.
* `white_balance(warm=0, tint=0)`: gains g = (1+warm, 1+tint, 1-warm);
  divide g by (0.2126 g_r + 0.7152 g_g + 0.0722 g_b); lin *= g.
* `contrast(amount, pivot=0.43, hi=0.85, lo=0.06)`: on code v:
  v = pivot + (v - pivot)*amount. If amount > 1 apply soft clip:
  v>hi: v = hi + (1-hi)*tanh((v-hi)/(1-hi)); v<lo: v = lo - lo*tanh((lo-v)/lo).
  If amount == 1 the op is the identity.
* `tone_curve(points)`: PCHIP through (x,y) points in code domain; must
  include x=0 and x=1.
* `lift_blacks(amount)`: code' = amount + code*(1-amount).
* `toe(strength, range=0.25)`: for code < range: u = code/range;
  code' = code - strength*code*(1-u)**2 ; else unchanged. (C1, monotone for strength<1.)
* `shoulder(start, k)`: for code > start: u = (code-start)/(1-start);
  code' = start + (1-start) * u / sqrt(1 + k*u*u); else unchanged.
* `softclip(hi=0.85, lo=0.0)`: code>hi: hi + (1-hi)*tanh((code-hi)/(1-hi));
  if lo>0 mirror for shadows as in contrast.
* `saturation(amount)`: Oklab a,b *= amount.
* `vibrance(amount)`: Oklab factor = 1 + (amount-1)*(1 - min(1, C/0.20)); a,b *= factor.
* `density(k)`: Oklab L *= (1 - k*min(1, C/0.25)).   # subtractive, film-like
* `split_tone(sh_hue, sh_amt, hi_hue, hi_amt, sh_range=(0.0,0.55), hi_range=(0.45,1.0))`:
  Yc = (0.2126R+0.7152G+0.0722B)**(1/2.4) from the *input* lin;
  w_sh = (1 - smoothstep(sh_range[0], sh_range[1], Yc)) * smoothstep(0, 0.08, Yc)  (fades to zero at black);
  w_hi = smoothstep(hi_range[0], hi_range[1], Yc);
  Oklab a += w_sh*sh_amt*cos(sh_hue) + w_hi*hi_amt*cos(hi_hue); b likewise with sin.
* `hue_shift(centre, width, shift)`: h += shift * w(h; centre, width).
* `hue_sat(centre, width, mult)`: C *= 1 + (mult-1)*w(h).
* `hue_lum(centre, width, mult)`: L *= 1 + (mult-1)*w(h)*min(1, C/0.10).
* `bw_mix(wr, wg, wb)`: normalise weights to sum 1; Y = wr R + wg G + wb B (linear); return (Y,Y,Y).
* `tint(hue, amount)`: Oklab a += amount*cos(hue)*smoothstep(0, 0.08, L); b likewise with sin.
* `gamut_clip(lin)`: clamp L to [0,1] in Oklab; if any channel of lin is
  outside [-1e-6, 1+1e-6], find the largest s in [0,1] such that Oklab
  (L, s*a, s*b) converts to lin inside [-1e-6, 1+1e-6]: scan s downward
  from 1 in 32 equal steps to the first in-gamut sample, then bisect 16
  times inside that bracket (a plain bisection over [0,1] is not safe:
  along the chroma line the in-gamut set is not always one interval);
  vectorised over pixels; finally clip to [0,1].

## 6. Look recipes (initial values — the planner will tune after previews)

Hue centres (Oklab degrees): RED=29, ORANGE=60 (skin), YELLOW=110, GREEN=142,
CYAN=195, BLUE=264, MAGENTA=328.

(Current recipes, regenerated from `tools/bnc_looks.py` after visual tuning;
hue-shift sign convention: Oklab hue increases red 29° → yellow 110° → green 142° →
cyan 195° → blue 264° → magenta 328°, so "greens toward yellow" is a negative shift.)

```
L01 Clean       : contrast(amount=1.05, pivot=0.43, hi=0.92, lo=0.06); density(k=0.03); vibrance(amount=1.04)
L02 Print2383   : white_balance(warm=0.01, tint=0); contrast(amount=1.2, pivot=0.43, hi=0.85, lo=0.06); toe(strength=0.4, range=0.3); hue_shift(centre=264, width=45, shift=-6); hue_shift(centre=110, width=30, shift=-8); hue_sat(centre=29, width=30, mult=0.9); hue_sat(centre=142, width=40, mult=0.9); density(k=0.14); split_tone(sh_hue=195, sh_amt=0.014, hi_hue=75, hi_amt=0.014, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); saturation(amount=0.9); softclip(hi=0.86, lo=0.0)
L03 GoldenHour  : white_balance(warm=0.05, tint=-0.01); contrast(amount=1.1, pivot=0.43, hi=0.85, lo=0.06); split_tone(sh_hue=40, sh_amt=0.008, hi_hue=65, hi_amt=0.026, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); hue_sat(centre=60, width=35, mult=1.08); density(k=0.06); lift_blacks(amount=0.008); vibrance(amount=1.06); softclip(hi=0.88, lo=0.0)
L04 TealOrange  : contrast(amount=1.12, pivot=0.43, hi=0.85, lo=0.06); split_tone(sh_hue=210, sh_amt=0.042, hi_hue=55, hi_amt=0.02, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); hue_shift(centre=264, width=45, shift=-16); hue_shift(centre=142, width=40, shift=20); hue_sat(centre=142, width=40, mult=0.85); hue_sat(centre=60, width=25, mult=1.06); density(k=0.08); softclip(hi=0.88, lo=0.0)
L05 Chrome      : contrast(amount=1.15, pivot=0.43, hi=0.85, lo=0.06); toe(strength=0.3, range=0.3); saturation(amount=0.82); hue_shift(centre=29, width=30, shift=8); hue_sat(centre=29, width=30, mult=0.85); hue_shift(centre=264, width=45, shift=-12); hue_sat(centre=264, width=45, mult=0.9); hue_shift(centre=142, width=40, shift=-10); hue_sat(centre=142, width=40, mult=0.85); split_tone(sh_hue=250, sh_amt=0.01, hi_hue=80, hi_amt=0.006, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); density(k=0.1); softclip(hi=0.87, lo=0.0)
L06 Nostalgic   : contrast(amount=1.04, pivot=0.43, hi=0.85, lo=0.06); lift_blacks(amount=0.025); saturation(amount=0.88); hue_shift(centre=142, width=40, shift=-14); hue_sat(centre=142, width=40, mult=0.9); split_tone(sh_hue=190, sh_amt=0.016, hi_hue=70, hi_amt=0.03, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); tint(hue=340, amount=0.005); hue_sat(centre=60, width=30, mult=1.05); density(k=0.08); shoulder(start=0.8, k=0.15)
L07 Eterna      : contrast(amount=0.95, pivot=0.43, hi=0.85, lo=0.06); lift_blacks(amount=0.015); shoulder(start=0.72, k=0.25); saturation(amount=0.78); hue_shift(centre=142, width=40, shift=8); hue_sat(centre=142, width=40, mult=0.85); split_tone(sh_hue=220, sh_amt=0.008, hi_hue=60, hi_amt=0.004, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); density(k=0.06)
L08 Bleach      : contrast(amount=1.28, pivot=0.43, hi=0.85, lo=0.06); toe(strength=0.4, range=0.3); saturation(amount=0.5); density(k=0.15); split_tone(sh_hue=220, sh_amt=0.006, hi_hue=85, hi_amt=0.008, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); softclip(hi=0.85, lo=0.0)
L09 Nocturne    : white_balance(warm=-0.06, tint=0); contrast(amount=1.15, pivot=0.43, hi=0.85, lo=0.06); toe(strength=0.3, range=0.25); split_tone(sh_hue=240, sh_amt=0.038, hi_hue=60, hi_amt=0.012, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); hue_sat(centre=60, width=30, mult=1.05); hue_sat(centre=142, width=40, mult=0.8); saturation(amount=0.9); density(k=0.1); softclip(hi=0.88, lo=0.0)
L10 Faded       : lift_blacks(amount=0.06); contrast(amount=0.98, pivot=0.43, hi=0.85, lo=0.06); shoulder(start=0.75, k=0.3); saturation(amount=0.85); split_tone(sh_hue=50, sh_amt=0.012, hi_hue=70, hi_amt=0.015, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); hue_shift(centre=142, width=40, shift=-10); density(k=0.04)
L11 Acros       : bw_mix(wr=0.45, wg=0.45, wb=0.1); contrast(amount=1.15, pivot=0.43, hi=0.85, lo=0.06); toe(strength=0.25, range=0.25); softclip(hi=0.88, lo=0.0)
L12 Vivid       : contrast(amount=1.12, pivot=0.43, hi=0.85, lo=0.06); vibrance(amount=1.25); hue_lum(centre=264, width=45, mult=0.9); hue_sat(centre=142, width=40, mult=1.1); hue_shift(centre=142, width=40, shift=6); density(k=0.14); softclip(hi=0.88, lo=0.0)
L13 Airy        : exposure(ev=0.12); lift_blacks(amount=0.03); contrast(amount=0.92, pivot=0.5, hi=0.85, lo=0.06); shoulder(start=0.7, k=0.15); saturation(amount=0.9); split_tone(sh_hue=230, sh_amt=0.006, hi_hue=25, hi_amt=0.012, sh_range=(0.0, 0.55), hi_range=(0.45, 1.0)); hue_sat(centre=142, width=40, mult=0.9)
```
Put the recipes in `tools/bnc_looks.py` as data (list of (name, kwargs)),
with a `describe(look)` helper that renders the recipe as plain English
(e.g. "Contrast 1.18 around pivot 0.43", "Shadows toned toward cyan (195°)
by 0.012, highlights toward warm yellow (75°) by 0.010"). Also give every
look a one-line `intent` and a `use_for` string (the planner will edit).

## 7. Output files

`.cube` writer:
```
TITLE "<title>"
# BNC Grade v1.0 — <description line>
# Input: <input space> | Output: Rec.709 Gamma 2.4
LUT_3D_SIZE <N>
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
<r g b> lines, red index fastest, then green, then blue; "%.6f" each; outputs clipped to [0,1]
```
Default N = 33 for everything (`--size 65` allowed for technical LUTs).
Directory layout (relative to `color-grading/luts/`):
```
01_technical/BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube
01_technical/BNC_Base_FLog2-FGamut_to_Rec709-G24.cube
01_technical/BNC_Base_FLog-FGamut_to_Rec709-G24.cube
02_looks/BNC_L01_Clean.cube … BNC_L13_Airy.cube           (Rec.709 → Rec.709)
03_combined_slog3/BNC_SLog3_L01_Clean.cube … L13           (S-Log3 → base → look)
```
Combined LUTs are computed by evaluating base then look on the same lattice
input (no intermediate LUT sampling).

CLI: `python3 tools/build_luts.py [--out luts] [--size 33] [--prefix BNC] [--only technical|looks|combined]`.
Print a one-line summary per file (name, size, min, max, grey-axis check).

## 8. `tools/lut_apply.py` (shared helper)

* `read_cube(path)` → (N, array (N,N,N,3) indexed [b,g,r] or documented order, title).
* `apply_lut(img_float, lut)` using **tetrahedral** interpolation (what
  Resolve uses), vectorised; img in [0,1], shape (...,3).
* `apply_lut_trilinear` also provided for comparison.

## 9. `tools/verify_luts.py`

For every .cube under `luts/` (or paths given):
1. Parse; assert size, count, finite, in [0,1].
2. Grey axis: sample the LUT on r=g=b=i/(N-1); assert non-decreasing
   luminance; assert max channel spread ≤ 0.004 for technical LUTs and for
   looks whose recipe has no split_tone/tint/white_balance (report the
   spread for all).
3. Technical LUTs: reference values from section 3.3 (evaluate the LUT
   with tetrahedral interpolation at those inputs). Also compare the LUT
   output to the analytic pipeline on (a) 20,000 random codes over the whole
   cube (fail if > 0.035 -- most of the cube is physically unreachable, e.g.
   one channel below the log black level while the others sit 5 stops over
   grey), (b) a 1,001-point grey ramp (fail if > 0.005) and (c) the 24
   ColorChecker patches at every half stop from -6 to +6, encoded into the
   camera's log space (fail if > 0.01). (c) is the region real footage
   lives in and is what proves 33 points is enough.
4. Looks: assert black (0,0,0) → luminance ≤ lift_blacks (or ≤ 0.002 if none);
   white (1,1,1) → luminance ≥ 0.85 and ≤ 1.0; grey-axis monotone.
5. Print a table (file, size, grey spread, max error, PASS/FAIL) and exit
   non-zero on any failure.

## 10. `tools/render_previews.py`

Inputs: `lookbook/samples/*.png|jpg` (sRGB 8-bit). Outputs under
`lookbook/previews/`:
* `<sample>__original.jpg`
* `<sample>__L01_Clean.jpg` … for every look (Rec.709 look LUT applied to the sRGB image).
* Synthetic S-Log3 demo for each sample: convert sRGB → linear (power 2.2
  decode) → assume display-linear ≈ scene-linear scaled so that the image
  mean maps sensibly (scale = 0.18 / mean(Y) clipped to [0.5, 2.0]) →
  Rec.709 → S-Gamut3.Cine matrix → S-Log3 encode → save
  `<sample>__slog3.jpg` (the flat log image), then apply the technical LUT
  → `<sample>__base709.jpg`, and each combined LUT → `<sample>__SLog3_L02_Print2383.jpg` etc.
* Charts (synthesised, 1200×300 px): a 24-patch ColorChecker-style strip
  (use the published sRGB values of the X-Rite ColorChecker 2005:
  dark skin (115,82,68), light skin (194,150,130), blue sky (98,122,157),
  foliage (87,108,67), blue flower (133,128,177), bluish green (103,189,170),
  orange (214,126,44), purplish blue (80,91,166), moderate red (193,90,99),
  purple (94,60,108), yellow green (157,188,64), orange yellow (224,163,46),
  blue (56,61,150), green (70,148,73), red (175,54,60), yellow (231,199,31),
  magenta (187,86,149), cyan (8,133,161), white (243,243,242),
  neutral 8 (200,200,200), neutral 6.5 (160,160,160), neutral 5 (122,122,122),
  neutral 3.5 (85,85,85), black (52,52,52)), a 0→1 grey ramp, and a
  hue/saturation wheel; render each through every look LUT as
  `chart__<look>.png` and `chart__original.png`.
* Also write `lookbook/previews/index.json` listing what was rendered.
* Resize previews so the long edge ≤ 720 px; JPEG quality 85.

## 11. Definition of done for the implementer

* `python3 tools/build_luts.py` builds all 29 files in < 3 minutes.
* `python3 tools/verify_luts.py` passes.
* `python3 tools/render_previews.py` produces the previews.
* `python3 -m pytest` is NOT available; write `tools/test_pipeline.py` as a
  plain script with asserts for every "assert"/"reference value" in this
  spec and make it exit 0.
* Code is documented: every op has a docstring that says what it does in
  grading terms and how to reproduce it manually in Resolve
  (one line, e.g. "Resolve: Contrast/Pivot in Primaries").
