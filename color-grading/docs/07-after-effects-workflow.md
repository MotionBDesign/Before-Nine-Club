# After Effects Workflow

After Effects is rarely where BNC Grade's technical transform should happen from scratch, but it's very often where the graded footage ends up — composited with titles, motion graphics, or VFX. This guide covers how AE's colour management actually behaves, how to apply the project's `.cube` LUTs correctly inside it, a basic correction workflow for the times you do need to grade directly in AE, and how to round-trip cleanly with Resolve.

## 1. After Effects colour management

Recent After Effects versions (2024/2025/2026-era) manage colour through **OpenColorIO (OCIO)**, layered on top of the older, simpler colour management model. Two distinct systems exist, and knowing which one your project is in matters:

- **Legacy/basic colour management** — enabled by ticking a working colour space in **File → Project Settings → Color**. Options include working spaces like **HDTV (Rec. 709)**, which shares its primaries and gamut with sRGB (only the transfer curve differs), making it a solid general-purpose working space for anything ending up as broadcast/streaming video; a variant, "HDTV (Rec. 709) 16-235," is video-range-tagged. (One community report notes plain "HDTV (Rec. 709)" briefly went missing from the list in a recent version while the 16-235 variant remained — if you don't see the option you expect, check your exact build.)
- **OCIO Color Managed** — switch to this in the same Project Settings → Color panel. Once enabled, a **Display Color Space** menu appears (it's hidden under basic colour management), letting you pick an OCIO config and display transform — this is the route to ACES workflows and is the more powerful, more "Resolve-like" option if the project needs it, at the cost of more setup.

**Display Color Management** (Preferences) uses your monitor's own ICC profile so what you see on screen matches the working space accurately — keep your display calibrated and profiled if you're judging colour by eye in AE at all.

### Interpreting footage: telling AE what colour space log footage is actually in

By default, After Effects treats imported footage as already being in the project's working colour space (typically Rec.709), which is wrong for S-Log3/S-Gamut3.Cine — the flat log image gets displayed as if it were already a finished Rec.709 image, which reads as crushed, over-saturated, and wrong.

To fix it: right-click the footage in the Project panel → **Interpret Footage → Main**, then use the **Color Management** section (in some versions this is reached via a **More Options…** button) to set an input/override colour space. Adobe's log colour space list has been expanded over recent versions to include manufacturer log profiles directly in Interpret Footage, rather than requiring a LUT-based workaround — confirm in your version whether **S-Log3 / S-Gamut3.Cine** (and, for the X-T5 side of this project, **F-Log2**) appear directly in that dropdown; if they don't, the fallback is applying the project's technical LUT as an **Input LUT** in Lumetri instead of relying on an Interpret Footage override.

### Bit depth: 8, 16, 32 bpc

Project bit depth is set at the bottom of the Project panel (click the bpc indicator to cycle it).

| Depth | When to use |
|---|---|
| 8 bpc | Fine for finished, display-referred footage with no further heavy grading — default, fastest |
| 16 bpc | The safer default once you're doing real colour work — far less banding risk than 8-bit |
| 32 bpc (float) | Needed for HDR footage, or when you want values below black and above white to survive intermediate steps (highlight recovery, heavy compositing math) rather than being clipped at each stage |

**Linearize working space:** a separate option (File → Project Settings → Color → **Linearize Working Space**) converts the working colour space to scene-linear light internally. It's only appropriate at 16 or 32 bpc — never at 8-bit — and is mainly relevant when doing physically-based compositing (3D renders, heavy blending) where linear-light math is the actually-correct math; it's not something you need on for a straightforward grade-and-composite job with the project's LUTs.

## 2. Applying `.cube` LUTs in After Effects

There are two distinct mechanisms, and they are not interchangeable:

### Lumetri Color

- **Basic Correction → Input LUT** — apply the project's **technical LUT** here. This is meant to be the first transform in the stack, conceptually equivalent to Resolve's normalising CST: it takes the raw log signal and gets it into a workable, display-referred state before anything else touches it. Note: the Intensity/strength control is **not** available for Input LUT the way it is for Creative — an Input LUT applies at full strength.
- **Creative → Look → Intensity** — apply the project's **look LUT** here, not under Basic Correction. The Look dropdown loads a `.cube` (or other supported) file, and directly below it the **Intensity** slider runs roughly 0–200%, giving genuine strength control over the LUT itself (rather than a simple opacity blend against the original). For a subtler application of a strong look LUT, dialling Intensity down to somewhere around 50–75% generally reads as more integrated than reducing layer opacity would.
- This ordering matters: Basic Correction (including the Input LUT) is processed **before** Creative (including the Look LUT), which is exactly the log→709→look sequence the project's two LUT types are designed for.

### Apply Color LUT (Effect → Utility → Apply Color LUT)

A dedicated utility effect rather than part of Lumetri. It accepts `.cube` files directly (as well as `.3dl`, `.look`, and `.csp`), and works across 8-, 16- and 32-bpc projects. Use it when you want a LUT applied as its own standalone effect in the timeline — outside Lumetri entirely — for example, stacking multiple LUT passes explicitly, or applying a LUT on an adjustment layer where you don't want the rest of Lumetri's panel involved. It has no built-in intensity slider of its own; control strength through the layer's opacity, or by pre-blending with a duplicate ungraded layer underneath.

### Practical placement

| Goal | Where |
|---|---|
| Technical LUT (log → Rec.709) | Lumetri → Basic Correction → Input LUT, on the clip itself |
| Look LUT (creative grade) | Lumetri → Creative → Look, with Intensity to taste — on the clip, or on an adjustment layer above several clips that share a scene |
| Applying a LUT outside Lumetri, or stacking LUT passes | Apply Color LUT (Utility), on its own layer/effect instance |

**Where LUT files live:** there's no single fixed "AE LUT folder" the way Resolve has — Apply Color LUT and Lumetri's Input LUT/Look both browse to wherever you keep the project's `.cube` files (a project-local `/LUTs` folder is the simplest convention so relative paths survive a move to another machine).

**Effect order, adjustment layers, and selective grading:** effects run top-to-bottom in the Effect Controls stack, so a correction effect placed above a LUT effect on the same layer processes first. For selective grading, put the look LUT (or Lumetri) on an **adjustment layer** above the clips it should affect, and use a **mask** or **Roto Brush** on that adjustment layer (or on a duplicated, isolated copy of the clip) to confine the look to part of the frame — the same logic as a Resolve power window, just built from AE's masking tools instead.

## 3. Doing a basic correction in After Effects

For jobs where you're grading directly in AE rather than round-tripping from Resolve:

1. Apply **Lumetri Color** to the clip (or an adjustment layer above it).
2. **Basic Correction:** set white balance (WB Selector or Temperature/Tint), then Exposure, Contrast, Highlights, Shadows, Whites, Blacks — same logic as the Camera Raw pass in the stills workflow: recover highlight/shadow detail with the dedicated sliders before reaching for a global Exposure/Contrast push.
3. **Curves:** for shape-level tone and per-channel colour control beyond what the Basic sliders give you.
4. **Hue/Saturation** (a separate effect, or Lumetri's Creative/Color Wheels): for targeted hue shifts and saturation trims once basic correction and any LUT are in place.
5. **Check with Lumetri Scopes:** open the Scopes panel (waveform, parade, vectorscope, histogram available). The waveform/parade shows luminance and per-channel levels — use it to confirm you haven't crushed blacks or blown highlights; the vectorscope shows hue/saturation, useful for checking skin sits near the expected line and that nothing is over-saturating into an unrealistic corner.
6. **Clipping:** enabling **Clamp Signal** in the Scopes options restricts what the *scope display* shows to 0–1.0 (or 0–100 IRE) — it does not clip your actual footage or export, only the scope reading, so leave it off if you specifically want to see over-range values that exist in 16/32-bpc footage. Whether Lumetri itself clips at 1.0 depends on bit depth: at 8/16 bpc, values are hard-limited to the format's range; at 32 bpc float, values can legitimately go below 0 and above 1.0 and survive through further processing (which is the main practical argument for grading HDR or heavily-recovered footage at 32-bit).
7. **Levels** (the classic effect, still available) shows its own clipping indicators at the ends of its histogram and is a fast way to sanity-check black/white points on a clip that isn't otherwise going through Lumetri.

## 4. Round-tripping with Resolve

**Grade in Resolve, composite in AE** when the job is colour-critical and needs Resolve's node-based tools, scopes, and colour management depth — typical for anything where the LUT/CST work in Section 1 of the Resolve guide is doing real work. Bring the graded footage into AE as a high-quality intermediate:

| Intermediate | Notes |
|---|---|
| ProRes 422 HQ | Standard choice, broad compatibility, near-lossless at 4:2:2 |
| DNxHR HQX | Comparable quality, the non-Apple-ecosystem equivalent |

Export from Resolve tagged **Rec.709** (Gamma 2.4) to match, and set the AE project's working colour space to the same Rec.709 so what you composite against matches what was graded. Round-tripping ProRes/DNxHR between Resolve and AE has reported colour-shift pitfalls specifically around the **Rec.709-A** tag (see Section 5) — if titles or graphics look subtly different in contrast/gamma once composited back over the graded plate, that tag mismatch is the first thing to check, alongside confirming AE's Assume Working Gamma matches (2.4, to match Rec.709).

**Grade in AE instead** when the job is graphics-led and colour-light — a title sequence, a short social cut where Lumetri's Basic Correction plus the project's two LUTs (Input then Creative, per Section 2) is enough, and setting up a full Resolve round trip would be more overhead than the job needs.

**Keeping LUT application consistent across both apps** matters most when a single deliverable is partly graded in each: apply the *same* technical LUT (or the equivalent CST) and the *same* look LUT with the *same* relative intensity in both tools, rather than, say, a full-strength look LUT in Resolve and a half-strength one in AE — a strength or ordering mismatch between the two is what makes a composite look like two different colour decisions stitched together.

## 5. Delivering via Media Encoder

Sending a composition to Adobe Media Encoder from AE carries known gamma-tagging quirks worth checking before you rely on it:

- One reported issue: Media Encoder's H.264 output has been observed tagging/encoding with a **gamma 2.4** curve even when the AE project was set up and previewed at gamma 2.2 — meaning what you graded to and what got exported don't necessarily agree unless you deliberately match **Assume Working Gamma** (Project Settings → Color) to your intended delivery gamma.
- Community reports also describe **washed-out colour** appearing specifically after the AE → Media Encoder → H.264 export step, distinct from the same composition's Program Monitor preview — a strong argument for always spot-checking the actual rendered file, not just the AE viewer, before calling a delivery final.
- **The Mac/QuickTime gamma issue** described in the Resolve guide applies here too: a Rec.709 Gamma 2.4-tagged export can read lighter on macOS/QuickTime and several social platforms than it did in AE's own preview. If you're delivering through this pipeline, tag the final export **Rec.709-A** rather than plain Rec.709 for the same reason given in the Resolve delivery section — consistent, correct-looking playback specifically on Mac/QuickTime and most upload targets.

## 6. Checklist

1. Confirm Project Settings → Color working colour space (or OCIO config) matches the rest of the pipeline — Rec.709 Gamma 2.4 for standard SDR delivery.
2. Interpret Footage → Color: override log footage's colour space, or confirm the technical LUT is doing that job via Input LUT instead.
3. Working at 16 bpc minimum for anything beyond a straight pass-through; 32 bpc if highlight recovery or HDR math is involved.
4. Technical LUT on Basic Correction → Input LUT; look LUT on Creative → Look with Intensity set deliberately, not left at a default that doesn't match the rest of the project.
5. Scopes checked (waveform + vectorscope), not just the viewer, before calling a grade finished.
6. If round-tripping: ProRes 422 HQ/DNxHR intermediate, matching Rec.709 tagging in and out of Resolve.
7. Before final export: verify Assume Working Gamma and the Media Encoder output tag, and use Rec.709-A on the delivered file if Mac/QuickTime/social playback is a target.
8. Play the actual exported file, not the AE Program Monitor, as the last check.

## Sources

- [Managing color in After Effects — Adobe (official help)](https://helpx.adobe.com/after-effects/using/color-management.html)
- [Color Management Part 14: Combining OCIO and After Effects — Chris Zwar, ProVideo Coalition](https://www.provideocoalition.com/color-management-part-14-combining-ocio-and-after-effects/)
- [OpenColorIO and ACES color management — Adobe (official help)](https://helpx.adobe.com/after-effects/using/opencolorio-aces-color-management.html)
- [How to Use ACES in After Effects (& Why Color Spaces Matter) — ActionVFX](https://www.actionvfx.com/blog/how-to-use-aces-in-after-effects)
- [AE2024 display color space shortcut — Adobe Community](https://community.adobe.com/questions-529/ae2024-display-color-space-shortcut-55502)
- [HDTV Rec 709 working color space missing — Adobe Community](https://community.adobe.com/questions-529/hdtv-rec-709-working-color-space-missing-57458)
- [Using S-Log Footage in After Effects — Emerson College Technology & Media](https://support.emerson.edu/hc/en-us/articles/21709265632795-Using-S-Log-Footage-in-After-Effects)
- [DISCUSS: Log color spaces now available in interpret footage — Adobe Community](https://community.adobe.com/announcements-732/discuss-log-color-spaces-now-available-in-interpret-footage-312912)
- [Intensity greyed out on Lumetri Color — Adobe Community](https://community.adobe.com/questions-729/intensity-greyed-out-on-lumetri-color-1400683)
- [How to Use LUTs in Adobe After Effects — Bounce Color](https://www.bouncecolor.com/blogs/tutorials/how-to-use-luts-after-effects)
- [Apply Utility effects in After Effects — Adobe (official help)](https://helpx.adobe.com/sa_en/after-effects/using/utility-effects.html)
- [Color Management in After Effects — Emerson College Technology & Media](https://support.emerson.edu/hc/en-us/articles/21709271104539-Color-Management-in-After-Effects)
- [After Effects color basics — Adobe (official help, AU)](https://helpx.adobe.com/au/after-effects/using/color-basics.html)
- [When working in a linear, 32-bit floating point working space… — Creative COW](https://creativecow.net/forums/thread/when-working-in-a-linear-32-bit-floating-point-wor/)
- [Adobe After Effects — Color Management — RxLab Guide](https://rxlab.guide/colors/ae.html)
- [Color Grading Footage in After Effects with Lumetri — PremiumBeat](https://www.premiumbeat.com/blog/color-correcting-video-lumetri-scopes/)
- [Display Lumetri Scopes in Premiere — Adobe (official help)](https://helpx.adobe.com/premiere-pro/using/lumetri-scopes.html)
- [Lumetri Scopes: Clamp Signal – 8 Bit?! — Creative COW](https://creativecow.net/forums/thread/lumetri-scopes-clamp-signal-8-bitae/)
- [Adding a Rec 709-A Setting to After Effects — Adobe Community feature request](https://community.adobe.com/feature-requests-530/adding-a-rec-709-a-setting-to-after-effects-1214168)
- [Davinci Resolve – After Effects Round Trip Workflow — David de Juan](https://daviddejuan.com/2019/09/22/davinci-resolve-after-effects-round-trip-workflow/)
- [Washed out colors when exporting from Adobe Media Encoder — Adobe Community](https://community.adobe.com/questions-506/washed-out-colors-when-exporting-from-adobe-media-encoder-996520)
- [Bug report: H.264 output gamma hard-coded to 2.4 — Adobe Community](https://community.adobe.com/bug-reports-505/bug-report-h-264-output-gamma-hard-coded-to-2-4-and-also-other-codes-1213674)
- [HDTV (Rec. 709) vs Rec.709 Gamma 2.4 – Video Output — Creative COW](https://creativecow.net/forums/thread/hdtv-rec-709-vs-rec709-gamma-24-video-output/)
- [Fix Davinci Resolve Gamma / Color shift on iMac and Mac OS — Andrew Northover](https://www.andrewnorthover.com.au/blog/davinci-resolve-gamma-shift)
