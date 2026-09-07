# Exposure and Preserving Highlights

Everything else in this documentation set assumes you handed it a clean file to begin with. This guide is about making sure that's true: never blowing out a highlight you needed, and never losing quality chasing a highlight you didn't. It pulls together on-set discipline, a scene-referred post pipeline, and the specific tools in Resolve, Camera Raw and Photoshop that protect highlight detail without costing you the rest of the image.

## 1. On set

### Base ISO discipline

Both cameras in this kit reward staying at their designed sensitivity points rather than treating ISO as a free dial:

| Camera | Native/base points | Why they matter |
|---|---|---|
| FX30 (S-Log3) | Dual base ISO 800 and 2500 | These are the two points where read noise is lowest and dynamic range is highest simultaneously; anything in between or below is a compromise, not a "safer" middle ground |
| X-T5 (stills) | Base ISO 125; DR200 raises the floor to ISO 250, DR400 to ISO 500 | Using a Dynamic Range mode isn't free — it forces a higher minimum ISO because the mode works by deliberately underexposing and lifting |

**Rule of thumb:** on the FX30, shoot 800 in normal-to-bright light and jump straight to 2500 in low light rather than creeping through intermediate ISOs; on the X-T5, use DR100 unless highlights are genuinely at risk, since DR400's two-stop protection comes back as visibly more shadow noise once lifted.

### ETTR in log, with zebras and false colour

Log footage should look "too bright" on a plain monitor — that's correct exposure, not a mistake to correct in-camera. Expose to the right (ETTR) using tools, not the naked eye:

- **Zebras:** set the FX30's zebra warning to **94%+** (Menu → Exposure/Color → Zebra Display → a custom level slot → Lower Limit 94 — confirm the exact path in your firmware) and expose until the meter reads roughly **+1 to +1.7 stops** over its default reading (up to +2 in low light at ISO 2500), backing off the instant zebras appear on anything that needs to hold detail.
- **False colour:** apply the camera's own log-to-709 monitoring LUT first, then enable false colour *on top of that LUT'd view* — false colour IRE bands are calibrated against a roughly Rec.709-shaped signal, not raw log values, so reading false colour directly off unconverted log gives meaningless results. Expose so skin lands in the false-colour "skin tone" band on the monitor while the actual recorded file stays the full-range flat log.
- **Reference points to check against, in S-Log3 values:**

| Reference | Target |
|---|---|
| 18% grey card | ~41 IRE |
| Skin tone | roughly 45–55 IRE, wider (45–65 IRE) across fair-to-deep complexions |
| Highlight ceiling | zebra warning at 94%+; treat detail above ~90 IRE as at risk (reported clip points for the S-Log3 family range roughly 88–94 IRE depending on camera/EI — check the exact ceiling on your waveform) |

### ND filters

The FX30 has **no built-in ND filter** — unlike some other Sony Cinema Line bodies (FX6, FX9, Burano), which have an internal electronic variable ND, the FX30 requires an external ND (screw-in or variable/matte-box) on the lens, and the camera can be told what density is mounted so it's logged in metadata. Plan for this on set: without an external ND, you'll run out of aperture/shutter-speed room to hold your 1–1.7 stop ETTR push in bright daylight while keeping the shutter angle you want.

### Protecting highlights vs protecting shadows — the actual trade-off

This is a genuine trade-off, not a solved problem:

- Pushing exposure up (ETTR) protects **shadow** detail and noise floor, at the cost of highlight headroom.
- Pulling exposure down, or using a stronger DR mode on stills, protects **highlights**, at the cost of visibly more noise once shadows are lifted back in post.

The practical compromise used throughout this kit is **"expose for skin, protect the sky"**: set exposure so skin sits in its target IRE band (video) or isn't clipped (stills), let genuinely bright, high-contrast elements like open sky ride toward — but not past — the clip warning, and accept that a small, deliberately-blown sky is often the more honest and less damaging trade than underexposed, noisy skin. If the sky is central to the shot rather than a background element, that's what a graduated ND or an in-post highlight roll-off (Section 2) is for — not further underexposing the whole frame.

### The monitor LUT is for viewing only

Sony's built-in S-Log3 → Rec.709 monitoring LUT (and equivalents on other cameras) exists so you have something plausible to look at on set. It is not colour-managed for your grading software, carries no creative intent, and — as covered in the Resolve and After Effects guides — applying it (or a similarly "raw" Rec.709 LUT) directly as the *finished* grade, without a proper log-to-709 transform underneath it, is one of the most common mistakes in this whole workflow: blacks lift, saturation flattens, skin goes plastic.

## 2. In post — video

### Keep the pipeline scene-referred as long as possible

Scene-referred data represents scene light without having been squeezed into a display's limited range yet — your S-Log3/S-Gamut3.Cine footage is scene-referred until you deliberately transform it. Working scene-referred for as long as possible — grading underneath, or "before," the display transform — is what preserves highlight and shadow detail that would otherwise already be clipped away by an early, premature conversion to Rec.709. In practice:

- **Resolve:** use DaVinci YRGB Color Managed with the DaVinci Wide Gamut Intermediate preset (or manual CST nodes), so creative grading nodes operate in a working space deliberately larger than anything either camera can produce, before a final CST commits to Rec.709 Gamma 2.4.
- **After Effects:** work at 16 bpc minimum, 32 bpc float if you're doing serious highlight recovery or compositing math — 32-bit is what lets values legitimately exist below 0 and above 1.0 and survive intermediate steps instead of being clamped at each one.
- **Do exposure and white balance corrections before any LUT touches the image**, in both apps — a LUT (technical or creative) is a fixed, non-linear transform; feeding it already-wrong exposure or white balance bakes that error into the transform's non-linear response instead of a clean, linear correction.

### Use a real roll-off, not a hard clip

- In Resolve, this means the **DaVinci tone-mapping mode on a CST node** (a smooth luminance roll-off in shadows and highlights with controlled desaturation at the extremes) or the **project's technical LUT**, which is built with the same filmic roll-off — not Sony's own monitoring LUT, which has no such grading-grade roll-off design intent.
- **Soft clip vs hard clip:** a hard clip is a flat plateau where a channel simply stops at its ceiling — the classic "blown-out, banded-edge" highlight. A soft clip compresses values as they approach the ceiling instead of stopping abruptly, producing a gentler, more film-like highlight rendering. Resolve's Primaries/HDR palette Soft Clip (or "High Soft") controls do this deliberately, and it's the mechanism the technical LUT's own roll-off is emulating.
- **HDR palette highlight zones:** Resolve's HDR-oriented primary controls give zone-based exposure and colour adjustment specifically aimed at the highlight range, useful when a shot needs targeted highlight work beyond what the CST's global roll-off provides.

### Gamut mapping / saturation compression

When a wide-gamut source (S-Gamut3.Cine) compresses into Rec.709, colours near the edge of the source gamut have nowhere to go without either clipping or being pulled inward. **Saturation/gamut mapping** (the setting on Resolve's CST) automates that pull-in so it happens smoothly rather than as a hard clip — this is the mechanism responsible for very saturated, very bright colours (neon signage, some skies, strong practicals) looking gently desaturated after the transform rather than clipped to a flat, oversaturated plateau. This is expected, correct behaviour, not a fault to grade away.

### Checking with scopes, properly

- **Waveform:** watch for flat tops — a section of the waveform trace that goes perfectly horizontal at the top is a hard clip, with zero recoverable detail above it. A trace that curves and compresses as it approaches the ceiling (rather than slamming flat) indicates the roll-off is doing its job.
- **CIE/vectorscope-style chromaticity scopes:** useful for seeing whether a saturated highlight (a bright sky, a coloured light source) sits inside or outside the target gamut boundary (e.g. the Rec.709 triangle) before gamut mapping pulls it back in — if you can see a cluster of values sitting right on or past the boundary line, that's exactly the region the CST's saturation compression is working on.

### Dealing with highlights that are already clipped

Sometimes the highlight is genuinely gone before it reached you — no roll-off, soft clip, or gamut mapping setting recovers detail that was never recorded. The standard moves for making a hard-clipped highlight read as intentional rather than broken:

1. **Desaturate toward white** as the value approaches the clip point, rather than leaving a flat, saturated colour plateau — a blown highlight that fades to neutral white reads as "bright," where a blown highlight that stays saturated reads as "wrong."
2. **Add a soft roll-off via curves** even though there's no real data to recover — shaping the curve so the approach to white is gradual rather than a hard step disguises the edge.
3. **Blur or glow the clipped edge slightly** (a touch of bloom/halation) to blend the hard boundary between "detail" and "flat white" — this is also, not coincidentally, part of why deliberate halation/glow as a look choice (Section 06 of the node tree in the Resolve guide) tends to make clipped highlights look more forgivable, not less.

None of this is a substitute for exposing correctly on set — it's damage control for the shots where you didn't.

### Noise reduction before grain

Apply noise reduction **early** — right after the normalising CST/input transform, before any creative grading, LUT, or added grain — not at the end of the chain. Grading noisy data means every qualifier, key, and window downstream is working with a dirtier signal, and removing noise last generally requires much more aggressive settings (and more detail loss) than removing it first. Grain, by contrast, belongs at the very **end** of the node tree/effect stack — it needs to sit on top of the finished image uniformly, and adding it before other corrections means those corrections end up inconsistently grading the grain itself.

## 3. In post — stills

### Raw highlight recovery has real limits

A raw file typically holds some genuine extra highlight information above the JPEG's clip point, but that headroom is finite — once a channel is truly saturated at the sensor level, no amount of pulling the Highlights or Whites slider brings back detail that was never captured. Recovery sliders work by rebalancing what data exists across channels (a channel that isn't fully clipped can sometimes reconstruct detail lost in a channel that is); they cannot invent detail from a fully-clipped file.

### DR modes are your on-set insurance, not a post-production fix

DR200/DR400 on the X-T5 protect highlights by exposing lower and lifting the result — that protection has to happen at capture time; choosing "more highlight recovery" in Camera Raw after the fact only works within whatever headroom the actual exposure (DR mode included) left you.

### Whites/Highlights sliders and clipping warnings, used together

Work with the clipping warning triangles on (top corners of the histogram, or **O** for overexposed/highlight clipping) so you can see exactly what's clipping while you pull **Highlights** down for local recovery and **Whites** down to reset the overall clip point — stop as soon as the red overlay clears from anything you need to hold, rather than continuing to pull past that point "for safety," which just flattens contrast you didn't need to give up.

### 16-bit, and avoiding banding in skies

Work in **16-bit** through the whole pipeline (Camera Raw's native processing is effectively higher than 8-bit regardless; the risk is opening into an 8-bit Photoshop document and doing large tonal moves there). Even in 16-bit, a large smooth gradient — a clear sky is the classic case — can still show banding once heavily graded, because most displays are themselves only 8-bit: the fix is to deliberately break up the smoothness, either by enabling **dither** on any gradient tool used, or by adding a very small amount of **noise/grain** over the affected area (a small Gaussian, monochromatic noise layer is the common approach) — the noise doesn't need to be visible as "grain" to a casual viewer, it just needs to be enough to prevent the display from posterising the gradient into visible steps.

### Sharpening last

Apply sharpening as the final step, after all tonal and colour work (including any look LUT) — sharpening earlier in the process gets re-processed by every subsequent tonal move, which can exaggerate haloing or noise that a later step then has to fight.

## 4. Delivery

### Legal vs full range

| Range | Also called | Values (8-bit terms) | Typical use |
|---|---|---|---|
| Video/legal range | Limited, SMPTE | 16–235 | Broadcast, most video delivery — headroom above/below is reserved so codecs don't clip extremes during compression |
| Full range | PC levels | 0–255 | Computer displays, many modern web/social pipelines |

Misalignment between how a file is tagged and how the receiving device interprets it produces washed-out or crushed results even though the underlying pixel data never changed — the fix is always to check the actual **flag/tag**, not to re-grade the image to compensate for a guess.

### Video-levels flags and gamma tags

These are metadata, not pixels: NLEs, QC software, players and hardware decoders all read range and gamma flags (e.g. NCLC tags in QuickTime) to decide how to interpret and display the data — so the same underlying file can appear correct on one system and wrong on another purely because of what it's tagged, not what it contains. Set data levels deliberately on every export (Resolve's Deliver page: Auto/Video/Full under Advanced Settings) rather than leaving it to a default you haven't checked.

### The QuickTime/Mac gamma shift

macOS applies a system gamma that doesn't match a plain Rec.709 Gamma 2.4 tag, so files tagged that way can look lighter/washed out specifically in QuickTime, other Mac software, and after some platform re-encodes. The commonly reported fix, used in both the Resolve and After Effects guides in this set, is to tag the **delivered file** as **Rec.709-A** rather than plain Rec.709 — this doesn't change your timeline working space or grade, only the export/output tag, and it's what produces consistent results specifically when Mac/QuickTime/most social platforms are in the viewing chain.

### Checking on a phone

Most of this project's final audience will watch on a phone, in a bright room, on a small, high-contrast, often over-saturated display — none of which matches a calibrated grading monitor in a dim room. Before calling a delivery final, play the **actual exported file** (not the NLE's viewer) on a real phone, ideally outdoors or under normal indoor lighting rather than in the grading suite — this is where an over-subtle roll-off, a highlight that read as "protected" on the grading display, or a gamma-tag mismatch actually shows up.

## One-page checklist

**On set**
1. FX30: ISO 800 or 2500 only, ETTR about +1 to +1.7 stops, zebras at 94%+.
2. X-T5: DR100 default; DR200/DR400 only when a highlight is genuinely at risk, and only with the higher minimum ISO in mind.
3. External ND on hand for the FX30 — there's no built-in one.
4. Expose for skin (~41 IRE grey, ~45–55 IRE skin in S-Log3), let non-critical highlights ride toward — not past — the clip warning.
5. Treat any on-camera monitoring LUT as a viewing aid only, never the final grade.

**Post — video**
6. Correct exposure/WB before any LUT touches the footage.
7. Use a display transform with a real roll-off (CST tone mapping, or the project's technical LUT) — never a raw monitoring LUT as the finished grade.
8. Watch for flat tops on the waveform; treat them as unrecoverable.
9. Noise reduction early in the chain; grain last.
10. For already-clipped highlights: desaturate toward white, soften the roll-off, consider a touch of blur/glow on the edge.

**Post — stills**
11. Recognise raw highlight recovery's real limit — it rebalances existing data, it doesn't invent detail.
12. Work in 16-bit throughout; add dither/noise to any banding-prone gradient (skies especially).
13. Sharpen last, after the look LUT.

**Delivery**
14. Set data levels (Video/Full) deliberately on every export.
15. Tag the delivered file Rec.709-A if Mac/QuickTime/social platforms are in the viewing chain.
16. Play the actual exported file on a real phone before calling it final.

## Sources

- [Sony FX30 – S-Log3 and Cine EI Modes Explained — CineD](https://www.cined.com/sony-fx30-s-log3-and-cine-ei-modes-explained/)
- [How To EASILY Film In SLOG3 With The Sony FX30 — whoismatt.com](https://whoismatt.com/how-to-easily-film-in-slog3-with-the-sony-fx30/)
- [Stop Overexposing S-Log3 — Gamut.io](https://gamut.io/stop-overexposing-s-log3/)
- [Sony Cinema Line: How Correctly Expose S-Log3 — Sony Cine](https://sony-cinematography.com/articles/how-correctly-expose-s-log3-a7s-iii-fx3-fx6-fx9/)
- [Sony Filmmaker's Guide to S-LOG3 — Newsshooter](https://www.newsshooter.com/2025/11/27/sony-filmmakers-guide-to-s-log3/)
- [False Color in Video: How to Read IRE Levels and Expose Footage Correctly — Pixflow](https://pixflow.net/blog/false-color-video-exposure/)
- [What is a False Color Chart? The Cinematographer's Guide to Perfect Exposure — Hollyland](https://www.hollyland.com/blog/tips/what-is-a-false-color-chart)
- [FS7: Slog3 clipping level — DVXuser.com](https://www.dvxuser.com/threads/slog3-clipping-level.336695/)
- [ILME-FX30 Help Guide — ND Filter — Sony (official)](https://helpguide.sony.net/ilc/2220/v1/en/contents/TP1002071062.html)
- [Fujifilm Dynamic Range Explained: What DR100, DR200, and DR400 Really Do — J.M. Peltier](https://www.jmpeltier.com/fujifilm-dynamic-range-settings/)
- [Fujifilm DR100 vs DR200 vs DR400: Which to Use — X-Alchemy](https://x-alchemy.app/academy/dynamic-range-guide)
- [Why Applying a LUT Directly to S-Log3 Looks Flat — Positiva Films](https://positivafilms.com/posts/why-s-log3-lut-looks-flat-cst-node.html)
- [Scene Referred vs. Display Referred Part II — The Daejeon Chronicles](https://daejeonchronicles.com/2022/12/31/scene-referred-vs-display-referred/)
- [DaVinci Wide Gamut pipeline — Dehancer](https://www.dehancer.com/learn/article/davinci-wide-gamut-pipeline)
- [Tone Mapping — DaVinci Resolve 18 Manual mirror](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part3169.htm)
- [Soft Clip Definition — DaVinci Resolve Explained — Tella](https://www.tella.com/definition/soft-clip)
- [Using Soft Clip Controls to Recover Highlights and Shadows — DVResolve.com](https://dvresolve.com/tutorial/using-soft-clip-controls-recover-highlights-shadows/)
- [How to Recover Highlights in Video – FAQ — Stocksy Support](https://support.stocksy.com/hc/en-us/articles/16259337429268-How-to-Recover-Highlights-in-Video)
- [Sculpting Clipped Highlights - Roll-offs, Tints, Glows, and Streaks — Mixing Light](https://mixinglight.com/color-grading-tutorials/sculpting-clipped-highlights/)
- [What Causes Clipping in HDR Highlights and How Can You Detect It? — KTCPlay](https://us.ktcplay.com/blogs/support-tips/hdr-highlight-clipping-causes-detection/)
- [Monitor Clipping: How to Spot & Fix Lost Highlight Detail — KTCPlay](https://us.ktcplay.com/blogs/support-tips/how-to-detect-monitor-highlight-clipping)
- [Proper node order for grain, NR, sharpening and 709 LUT — Blackmagic Forum](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=165668)
- [Why Noise Reduction Must Happen Before Color Grading In DaVinci Resolve — Tideon VFX](https://tideonvfx.com/why-noise-reduction-before-color-grading/)
- [Quick Tip: Denoise your Footage the Right Way — CineD](https://www.cined.com/quick-tip-denoise-footage/)
- [Highlight Clipping in Adobe Photoshop Camera Raw (and Why You Should Care) — Layers Magazine](https://layersmagazine.com/highlight-clipping-in-adobe-photoshop-camera-raw-and-why-you-should-care.html)
- [Preventing banding in backdrops — Damien Symonds](https://www.damiensymonds.net/preventing-banding-in-backdrops/)
- [5 ways to remove banding in Photoshop — LSP Actions](https://www.lsp-actions.com/blogs/lsp-actions-blog/remove-banding-photoshop)
- [Understanding Video Range vs. Full Range Levels — Portrait Displays](https://www.portrait.com/resource-center/understanding-video-range-vs-full-range-levels/)
- [Full Levels and Video Levels Explained! — The Post Process](https://www.thepostprocess.com/2019/09/24/how-to-deal-with-levels-full-vs-video/)
- [Guide to Broadcast Safe Levels and SDR Legalization — Aspect](https://aspect.inc/blog/post-production/guide-to-broadcast-safe-levels-and-sdr-legalization)
- [How To Color Grade Full Range for Data Level Broadcast Delivery? — Mixing Light](https://mixinglight.com/color-grading-tutorials/full-range-broadcast-delivery/)
- [Tutorial: Legal and extended range in DaVinci Resolve — 709 Media Room](https://709mediaroom.com/en/tutorial-legal-and-extended-range-in-davinci-resolve/)
- [Fix Davinci Resolve Gamma / Color shift on iMac and Mac OS — Andrew Northover](https://www.andrewnorthover.com.au/blog/davinci-resolve-gamma-shift)
- [Quicktime Gamma Shift Bug: What Is It and How to Combat It — CineD](https://www.cined.com/quicktime-gamma-shift-bug-what-is-it-and-how-to-combat-it/)
