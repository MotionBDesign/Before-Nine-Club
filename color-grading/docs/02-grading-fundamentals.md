# Grading Fundamentals

This document is about the mechanics: the order you work in, the scopes you read, the tools you reach for and when, and the mistakes that trip up almost everyone in their first year. Read this alongside `01-colour-theory-for-grading.md` — theory tells you *why* a skin tone should sit on a particular line, this tells you *how* to get it there and verify it's actually there.

## Correction vs grading, and why order matters

**Colour correction** is the technical pass: matching cameras, fixing white balance, getting exposure onto reasonable levels, making the footage look "normal" and consistent. **Colour grading** is the creative pass on top: pushing a mood, a palette, a contrast character. Correction fixes; grading stylises. In practice the two blur together in a single node tree, but the distinction still matters because of what happens when you skip the order:

If you apply a creative grade — a strong teal/orange push, a heavy S-curve, a punchy LUT — to footage that hasn't been corrected first, you don't get "correction + style," you get whatever is wrong with the shot *amplified* by the stylistic push. A slightly warm white balance becomes a very warm white balance once a warm-highlight look sits on top of it. This is the single most common reason a beginner's grade looks inconsistent shot to shot: the creative look was built on top of an uncorrected (and therefore different) starting point for each clip.

A practical order of operations, in the order the *decisions* should be made (your software's actual node/effect order may differ — see the note on signal flow below):

1. **Normalise** — get the camera's native colour space into your working space. For your FX30/X-T5 footage this is applying the correct colour space transform (S-Log3/S-Gamut3.Cine or F-Log2/F-Gamut into your timeline's working colour space), not a creative LUT.
2. **Balance** — white balance and exposure, shot by shot, judged against scopes, so every clip starts from the same neutral baseline.
3. **Primary correction** — contrast, overall saturation, the broad shape of the image.
4. **Secondaries** — qualifiers and windows: skin isolation, sky replacement, selective saturation, anything targeted at part of the frame rather than the whole thing.
5. **Look** — the creative grade: palette, split-tone, film emulation, the stuff that makes it *yours*.
6. **Output transform** — the final conversion to your delivery colour space (typically Rec.709 gamma 2.4 for web/client delivery).

One nuance: this describes how the *signal* is processed, not necessarily the order you *work* in. You might apply a reference LUT early just to see a reasonable image while you work, while the signal chain still processes it last. Applications also differ in which direction they compute — Resolve flows left-to-right through its node tree, Premiere and After Effects flow top-down through their effect/layer stack. Know which direction your tool computes in, because "on top" and "first" don't always mean the same thing.

## Reading the scopes

Trust the scopes over your eyes, always — your eyes adapt to a monitor, a room's ambient light, and to whatever you were looking at a moment ago (see simultaneous contrast and the Hunt effect in the companion theory doc). Scopes don't adapt to anything.

### Waveform (luma)

The waveform plots brightness only, left-to-right matched to the image, bottom-to-top matched to black-to-white. It tells you everything about the tonal/contrast structure of a shot and nothing about colour. This is your primary tool for setting exposure and contrast, and for spotting clipping — a flat line pinned to the top or bottom of the scope means detail has been permanently lost at that level.

### RGB parade

The same idea as the waveform, but split into three side-by-side waveforms — one per colour channel. Where the plain waveform tells you brightness, the parade tells you *colour balance*: if you look at a neutral grey or white object and the three channels aren't stacked at the same height, the image isn't white-balanced. This is the primary tool for correcting white balance and spotting a colour cast, and for confirming that a "neutral" element in the frame is actually neutral rather than just looking neutral on a possibly-miscalibrated display.

### Vectorscope

Plots hue as angle and saturation as distance from centre, with no luminance information at all. Targets marked R, G, B, Cy, Mg, Yl show where fully saturated primaries and secondaries should fall, with (typically) two boxes per target — the inner box is the 75% saturation reference, the outer is 100%. The diagonal skin-tone line runs between the red and yellow targets. Use the vectorscope to judge overall saturation level (how far traces sit from the centre), hue accuracy (which direction traces point), and skin tone specifically (does the cluster sit on or near the skin-tone line).

### Histogram

A simple bar chart of how many pixels exist at each brightness level, with no left-right spatial information. Good for a fast read on overall exposure and dynamic range — a histogram bunched hard to one side tells you the image is under- or over-exposed at a glance — but it can't tell you *where* in the frame a problem is, which is what the waveform is for.

### CIE chromaticity

Plots the full range of humanly visible colour as a horseshoe shape, with a triangle overlaid showing the gamut boundary of whatever colour space you're targeting (Rec.709, DCI-P3, Rec.2020). Less of an everyday grading tool and more a gamut-management tool: it shows you when part of your image's colour is actually outside your delivery gamut and about to be clipped or compressed by the output transform, which the other four scopes won't show you directly.

### Typical Rec.709 exposure targets

These are rule-of-thumb IRE targets, not hard law — they vary with camera, gamma curve, and creative intent, and different sources give slightly different numbers depending on convention (7.5 IRE setup vs not, for instance). Treat this table as a sane starting point to check yourself against, not a spec to hit exactly:

| Reference | Typical IRE (Rec.709) |
|---|---|
| 18% grey card | roughly 40-45 IRE |
| Caucasian skin, front-lit | roughly 55-70 IRE |
| Darker skin tones | proportionally lower — same hue on the vectorscope, lower position on the waveform |
| Diffuse white (e.g. a white shirt, a cloudy sky) | roughly 85-90 IRE |
| Specular highlight (sun glint, direct light source) | up to 100 IRE, and can legitimately clip |

The general shape to hold onto: mid grey sits well below halfway, skin sits a bit above mid grey, diffuse white sits close to (but not at) the top, and only actual specular highlights are allowed to touch 100.

## Primary tools

### Lift/gamma/gain vs offset/log wheels

Resolve's standard primary wheels — **Lift** (shadows), **Gamma** (midtones), **Gain** (highlights) — split the tonal range into three zones and let you push each independently. This is a display-referred way of thinking: useful once footage is already in (or close to) its final display space, because you're reasoning about "shadows," "mids" and "highlights" the way they'll actually appear on screen.

**Offset** (and its film-lab ancestor, printer lights/printer points) shifts the entire signal — shadows, mids, and highlights — by the same amount at once. Because it doesn't independently stretch different zones, offset preserves the existing contrast relationship between them; it's the log-space equivalent of exposure compensation rather than a contrast tool. In practice: use offset for white balance and gross exposure correction on log footage, before a display transform is applied, and reach for lift/gamma/gain once you're grading in (or close to) display-referred space, where "shadows vs highlights" is a meaningful creative distinction again.

### Contrast and pivot

The Contrast control applies a non-linear S-curve to the image — pushing contrast up steepens the curve through the midtones while bending off (rather than clipping) toward the shoulders and toes, which is why it's a safer first move than manually dragging curve points. **Pivot** sets the point the S-curve bends around: raise the pivot and contrast pushes mostly into the highlights, lower it and contrast pushes mostly into the shadows. This combination is usually a faster, more controlled way to shape overall contrast than hand-drawing a curve, and it's worth mastering before you reach for full manual curves.

### Curves

A direct, hand-drawn version of the same tonal remapping, usually per-channel (R, G, B, and a combined Luma/RGB curve). Curves give you total control, but per-channel RGB curves carry a real risk: because the same shaped curve is applied independently to each channel, a curve move meant to affect brightness can unintentionally shift *hue* as a side effect — one channel gets pulled more than the others at a given tonal range, and the ratio between channels (which is what defines hue) changes even though you never touched a hue control. If a shot looks warm because of excess red, it's generally cleaner to pull the red channel down than to add blue to compensate — adding a channel to "cancel" another is how you end up with murky, less saturated colour than intended.

### The HDR palette (Resolve)

Rather than three fixed zones (lift/gamma/gain), the HDR palette divides the image into multiple **zones** (commonly described as dark, shadow, light, and specular) based on the actual histogram of the shot, with adjustable start points, overlap, and falloff between zones. Each zone gets its own colour wheel and can be independently corrected, gained, and saturated. It's a finer-grained version of the same lift/gamma/gain idea — worth reaching for when three zones aren't enough precision, typically on HDR work or on a shot with an unusually complex tonal range.

### Saturation vs vibrance vs colour boost

- **Saturation** scales every colour's intensity by the same relative amount, regardless of how saturated it already is — push it and already-vivid colours (skin, red props) can go first, and go furthest into looking artificial.
- **Vibrance** (and Resolve's **Color Boost**, which works on the same principle) selectively saturates the *less*-saturated colours in the image first, largely leaving already-saturated colours alone — this has the practical effect of protecting skin tones, since skin usually isn't the most saturated thing in frame, while still bringing flat, muted colours to life.
- A common practical sequence: reach for vibrance/colour boost first to bring a flat, log-derived image to life without touching skin, then use plain saturation sparingly (if at all) on top only if the whole image still needs more punch.

### Hue vs Hue / Hue vs Sat / Lum vs Sat curves, and the Color Warper

Resolve's HSL curve tools let you target a specific hue range and change one other property of it, in isolation:

| Curve | What it does | Typical use |
|---|---|---|
| Hue vs Hue | Shifts a selected hue toward another hue | Turning an odd green in foliage more natural, subtly rotating skin |
| Hue vs Sat | Changes saturation of a selected hue only | Boosting a product colour, pulling down a distracting saturated background element |
| Hue vs Lum | Changes brightness of a selected hue only | Darkening a specific colour for richness, brightening one to draw the eye |
| Lum vs Sat | Changes saturation based on tonal range | Boosting midtone saturation while leaving shadows and highlights alone |
| Sat vs Sat | Remaps saturation based on existing saturation | Taming one over-saturated element without affecting the rest of the palette |

The **Color Warper** (Resolve 17+) is effectively these ideas combined into one visual, mesh-based interface — you select points on a saturation/hue grid (or, in Chroma mode, directly on a perceptually-uniform chromaticity map) and drag them, rather than shaping separate curves. It's more intuitive for some people and worth trying once you're comfortable with what the HSL curves are individually doing — it's the same underlying idea with a different, more direct manipulation surface.

## Balancing and matching shots

The standard sequence, using a wipe or split-screen against a reference still (Resolve: grab a still with a right-click, then use Wipe from the Gallery) or against another clip in the timeline:

1. **Match neutral first.** Using the waveform and RGB parade, get the black point, midtones and white point of both clips lining up, and get any neutral object (wall, grey card, white shirt) sitting level across all three RGB channels. Do this before touching anything else — everything downstream depends on a matched baseline.
2. **Match skin next.** With neutrals aligned, compare skin tone position on the vectorscope between shots — it should sit at a similar spot on (or near) the skin-tone line, at a similar distance from centre (similar saturation) and similar position on the waveform (similar exposure).
3. **Match — or intentionally diverge — the look last.** Only once neutral and skin agree between shots should you evaluate whether the creative grade itself matches, or whether a deliberate difference (different location, different time of day) justifies keeping it different.

Use split-screen wipes throughout this process rather than cutting back and forth — comparing two frames simultaneously, side by side, removes the "my eyes just adapted to the last shot" problem entirely.

## Skin tone handling, in practice

- Keep skin on (or close to) the vectorscope skin-tone line as your default; treat deviation as something to justify, not something to ignore.
- Watch the yellow-to-magenta balance specifically — skin that drifts too far magenta reads as bruised or sunburnt; skin that drifts too far yellow (or gets desaturated) reads as sickly or jaundiced. As a rough reference, yellow commonly sits noticeably above magenta on Caucasian skin; the exact ratio varies by individual and lighting, but yellow dropping *below* magenta is a reliable sign something's wrong, short of a deliberate sunburn look.
- Don't chase saturation on skin — it's one of the fastest ways to make a face look artificial, because skin isn't naturally very saturated to begin with.
- When the background and the subject need genuinely different treatment (a cooler environment, a warmer subject), separate them with a window or a mask rather than trying to find one global setting that compromises between the two. File 3 covers this in depth.

## Common mistakes and fixes

| Mistake | What it looks like on scopes | Fix |
|---|---|---|
| Crushed blacks | Waveform flat-lines pinned to 0 | Raise lift/shadows until the waveform shows real detail again; check you actually meant to lose that shadow detail |
| Clipped whites | Waveform flat-lines pinned to 100 | Pull gain/highlights down, or use soft clip; verify against the parade that no single channel is clipping even if luma looks fine |
| Over-saturation | Vectorscope traces pushed hard toward the outer edge, skin cluster off the skin-tone line | Pull back, prefer vibrance/colour boost over blanket saturation, re-check skin specifically |
| Banding (8-bit / heavy pushes) | Visible stepping in smooth gradients — skies, lit walls, soft shadow falloff | Work in higher bit depth where possible, avoid extreme pushes on 8-bit sources, add a very slight dither/grain to break up banding when a hard push is unavoidable |
| Hue skew from per-channel curves | Colour appears to shift when only a brightness/contrast move was intended | Prefer Luma curves or contrast/pivot for pure tonal moves; use per-channel curves deliberately, and check the vectorscope afterward |
| Over-sharpening | Harsh edges, halos around high-contrast boundaries | Back off sharpening; it's a separate craft skill from colour and easy to overdo once you're already deep in a grade |
| Noise in lifted shadows | Grain/noise becomes obviously visible after raising shadows | Expose better at capture where possible; apply noise reduction *before* heavy shadow lifts, not after |
| LUT applied in the wrong colour space | Flat, washed-out, or oddly clipped/blown-out result even though the LUT is "correct" for the camera | Confirm the LUT's expected input space matches what you're actually feeding it — a log-in LUT fed a Rec.709 image (or vice versa) will misbehave badly |

## Using LUTs properly

A LUT (Look-Up Table) is a fixed mathematical transform: for a given input colour, it always produces the same output colour, with no awareness of your specific shot's exposure or white balance. Two consequences follow:

- **A LUT clips whatever falls outside its expected input domain.** Fed underexposed footage, a LUT built for well-exposed log will crush shadows toward black and can introduce noise/banding; fed overexposed footage, it blows out highlights and clips colour a slightly different exposure would have preserved.
- **This is why exposure and white-balance correction must happen before the LUT**, with creative pushes belonging before it (or on a separate node/layer) too. Feed it clean, corrected footage and it behaves predictably; feed it uncorrected footage and it amplifies whatever was wrong — the same problem as skipping correction before grading, above.

### Applying a LUT at reduced strength

Sometimes a LUT is close but slightly too strong. Rather than hunting for a different LUT, dial the existing one back:

- **Resolve:** put the LUT on its own node, open that node's Key palette, and lower the **Key Output Gain** — this blends the LUT's effect back toward the un-transformed image without touching the LUT itself. Because it affects the whole node, keep the LUT alone on its own node if you want to dial back only the LUT and not other corrections sharing that node.
- **Photoshop:** apply the LUT via a Color Lookup adjustment layer, then reduce that layer's opacity — full non-destructive control, and the opacity is available to change at any time later.
- **After Effects:** either reduce the opacity of the layer carrying the LUT effect (if it's on its own adjustment layer), or use the effect's own intensity/mix parameter if the specific LUT plugin exposes one.

### Technical LUTs, creative LUTs, and combined LUTs

- **Technical LUTs** do a mathematical, non-subjective job: converting one defined colour space/gamma to another — S-Log3/S-Gamut3.Cine to Rec.709, for instance. They're about accuracy, not aesthetics, and are the right tool for the "normalise" step.
- **Creative LUTs** apply a deliberate stylistic push — contrast shape, colour balance, split-toning — meant for footage that's *already* correctly exposed and colour-space-converted.
- **Combined/hybrid LUTs** do both in one transform (log-to-Rec.709 plus a creative look, baked together). Convenient, but less flexible: the technical conversion and the creative choice are fused, so you can't dial back one without the other, and they're less forgiving of exposure variance since there's no clean separation between "normal image" and "styled image."

### LUT sizes and interpolation

A LUT's size (17, 33, 65) describes the resolution of its internal sampling grid along each colour axis — a 33-point LUT samples 33³ points and interpolates everything between them. Roughly: 17-point is adequate for a fast on-set monitoring LUT, 33-point is the common working standard for grading, and 65-point offers the most precision at the cost of file size and (marginally) processing load — worth using for final, high-precision delivery work rather than as your everyday working LUT.

## Don't blow out: preserving highlight roll-off

A handful of related habits protect your highlights from clipping harshly:

- **Preserve the camera's native highlight roll-off** as long as possible — part of why grading log footage before an aggressive display transform matters: the sensor's own gentle highlight compression is still intact, and a hard Rec.709-style clip hasn't been baked in yet.
- **Work in 32-bit float** where your software supports it (Resolve does, internally, by default). "Brighter than white" and "darker than black" values stay retrievable even after a node makes them look clipped on screen — a later node can still recover them, provided nothing in between hard-clipped the signal to 8- or 10-bit integer range.
- **Place creative looks after a well-behaved technical/display transform**, not before it — pushing a strong look directly on log data risks clipping in ways that are hard to predict and hard to undo.
- **Never grade on top of a hard-clipped node.** Once values are genuinely clipped, not just "look clipped," no downstream correction brings that detail back.
- **Check the waveform for flat tops routinely** — a flat top is the definitive sign of clipping, more reliable than eyeballing the image.
- **Use soft clip** as a finishing touch, generally on the last node, to roll off extreme highlights and shadows gently rather than hitting a hard digital ceiling.

## A daily practice routine for learning

Colour grading is a perceptual skill, which means it's built through repetition against a reference (the scopes), not through reading alone. Twenty minutes, most days, beats a long session once a week. A few structured exercises:

- **Balance five clips to neutral.** Pick five different clips (different lighting, ideally different sources), and using only the waveform, parade, and offset/lift, get each one to a genuinely neutral starting point — no creative choices, just correction. Time yourself; getting faster at this is a real, measurable skill.
- **Match two clips.** Take two clips from different setups (or different cameras, if you have FX30 and X-T5 footage of comparable subjects) and match them to look like one continuous scene, using a wipe throughout. Judge success by scopes agreeing, not just by eye.
- **Build one look, then reproduce it manually without the LUT.** Apply a creative LUT you like to a clip, study what it's actually doing on the scopes (contrast shape, saturation level, hue shifts, where warmth sits), then remove the LUT and rebuild the same look by hand with primaries, curves, and hue curves. This is the single best exercise for actually *learning* grading rather than just collecting presets — it forces you to translate a look you can see into the specific tools that produce it.

## Sources

- [Color Correction vs Color Grading: What is the Difference? — Boris FX](https://borisfx.com/blog/color-correction-vs-color-grading/)
- [Color Correcting vs. Color Grading: Understanding Film Coloring — MasterClass](https://www.masterclass.com/articles/color-correcting-vs-color-grading)
- [The Best Order Of Operations For Color Grading & Why It Makes All The Difference — Noam Kroll](https://noamkroll.com/the-best-order-of-operations-for-color-grading-why-it-makes-all-the-difference/)
- [Order of Operations in Color Grading Explained — Coloura](https://coloura.co.uk/color-grading-order-of-operations/)
- [How to Use and Read the Four Primary Video Scopes — Frame.io](https://blog.frame.io/2017/09/27/introduction-to-video-scopes/)
- [Waveforms and vectorscopes explained — Videomaker](https://www.videomaker.com/how-to/editing/color-correction/waveforms-and-vectorscopes-explained/)
- [Learn How to Read Video Scopes — Larry Jordan](https://larryjordan.com/articles/learn-how-to-read-video-scopes/)
- [How to Read a Vectorscope and Why You Need One — StudioBinder](https://www.studiobinder.com/blog/what-is-a-vectorscope-definition/)
- [A Practical Guide to Reading Scopes in DaVinci Resolve — Colour Grade Agency](https://colourgrade.agency/learn-the-craft/reading-scopes-davinci-resolve/)
- [What is the correct IRE value of 18% grey for Rec709? — Canon Community](https://community.usa.canon.com/t5/Professional-Video/What-is-the-correct-IRE-value-of-18-grey-for-Rec709/td-p/375182)
- [18% Grey Translation To IRE Value — cinematography.net](https://www.cinematography.net/edited-pages/18GreyTranslationToIREValue.htm)
- [The Sensation of White — ProVideo Coalition](https://www.provideocoalition.com/the-sensation-of-white/)
- [How to Read Scopes in Color Grading: Complete Guide — cinapex](https://cinapex.pro/how-to-read-scopes-in-color-grading-complete-guide/)
- [CIE Chromaticity Diagram — Brent Bergherm Photography](https://brentbergherm.com/how-to/cie-chromaticity-diagram/)
- [Fixing White Balance With Offset and Gamma in DaVinci Resolve — Gamut.io](https://gamut.io/fixing-white-balance-with-offset-and-gamma-in-davinci-resolve/)
- [Understanding the Colour Wheels: Lift, Gamma, Gain & Offset in DaVinci Resolve — Learn the Craft](https://www.colourgrade.co.uk/blog/understanding-the-color-wheels-lift-gamma-gain-amp-offset-in-davinci-resolve)
- [Blackmagic Forum: Printer lights vs color wheels](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=60524)
- [Creating An S-Curve Using The Contrast & Pivot Controls — Mixing Light](https://mixinglight.com/color-grading-tutorials/creating-s-curve-using-contrast-pivot/)
- [How To Use Contrast And Pivot In DaVinci Resolve — Filmmaking Elements](https://filmmakingelements.com/how-to-use-contrast-and-pivot-in-davinci-resolve-very-easy/)
- [HDR Palette - Using Multiple Zones, Contrast, Presets, Global Control — Mixing Light](https://mixinglight.com/color-grading-tutorials/hdr-palette-zones-contrast-presets-global/)
- [Introducing the HDR Color Palette — DVResolve.com](https://dvresolve.com/tutorial/introducing-hdr-color-palette/)
- [Vibrance vs Saturation in Color Grading: Key Differences — SpotlightFX](https://spotlightfx.com/blog/vibrance-vs-saturation-in-color-grading-key-differences)
- [Understanding How Color Boost Works in DaVinci Resolve — Mixing Light](https://mixinglight.com/color-grading-tutorials/deconstructing-color-boost-in-davinci-resolve/)
- [Color Grading: Working with Hue vs. Curves in DaVinci Resolve — PremiumBeat](https://www.premiumbeat.com/blog/hue-vs-curves-davinci-resolve/)
- [The Do's And Don'ts of Color Correcting with Hue-vs-Sat Curves — Mixing Light](https://mixinglight.com/color-grading-tutorials/global-sat-vs-lum-curves-davinci-resolve/)
- [DaVinci Resolve Chroma Color Warper Explained — JayAreTV](https://jayaretv.com/color/davinci-resolve-chroma-color-warper-explained/)
- [Color Warper Tutorial Index — Mixing Light](https://mixinglight.com/tutorial-category/color-grading-controls/color-warper/)
- [How To Match Skintones Perfectly Using Qualifiers & Power Windows In DaVinci Resolve — Noam Kroll](https://noamkroll.com/how-to-match-skintones-perfectly-using-qualifiers-power-windows-in-davinci-resolve/)
- [Color Matching References in DaVinci Resolve — Creative Video Tips](https://creativevideotips.com/tutorials/match-reference-color-in-davinci-resolve)
- [Color Grading: Using DaVinci Resolve's Multiple Split Screens — PremiumBeat](https://www.premiumbeat.com/blog/using-resolves-multiple-split-screens/)
- [5 Tips for Getting Perfect Skin Tones in DaVinci Resolve — Frame.io](https://blog.frame.io/2020/10/05/skin-tones-in-davinci-resolve/)
- [Cinematic Color Grading Skin Tone: Stop Making It Orange — DIY Photography](https://www.diyphotography.net/cinematic-color-grading-skin-tone/)
- [How to Color Correct for Skin Tones — Eduardo Angel Visuals](https://eduardoangel.com/2014/05/07/color-correcting-skin-tones/)
- [5 Color Grading Mistakes to Avoid — 4K Shooters](https://www.4kshooters.net/2022/03/18/5-color-grading-mistakes-to-avoid/)
- [10 Beginner Mistakes to Avoid when Colour Grading — Editlounge](https://editlounge.com/post-production/colour-grading/beginner-mistakes/)
- [What are Crushed Shadows & Blown Highlights? — FilmDaft](https://filmdaft.com/crushed-shadows-and-blown-highlights-explained-with-examples/)
- [Understanding and Fixing Color Banding Issues in Photography — Kolari Vision](https://kolarivision.com/understanding-and-fixing-color-banding-issues-in-photography/)
- [What Causes Color Banding on Gradients and How Is It Related to Bit Depth? — KTCPlay](https://us.ktcplay.com/blogs/support-tips/color-banding-bit-depth-explained)
- [The misconception of RGB curves — ColorPerfect](https://www.colorperfect.com/misconception/of/common/RGB/curve/adjustments/in/digital/image/editing/)
- [A Beginner's Guide to Color Curves for Powerful Correction — Frame.io](https://blog.frame.io/2017/09/20/beginners-guide-to-color-curves/)
- [Understanding Nodes and Grading Underneath — Threads](https://www.threads.com/@creativrss/post/DWEY_-7Ea5P/understanding-nodes-and-grading-underneath-why-do-we-grade-underneath-a-lut-and)
- [What Is a LUT? How to Use Lookup Tables to Color Grade — Backstage](https://www.backstage.com/magazine/article/lut-color-grading-75738/)
- [Technical or Creative? Decoding the LUT Spectrum — Beverly Boy Productions](https://beverlyboy.com/film-technology/technical-or-creative-decoding-the-lut-spectrum/)
- [4 Things To Know About Working With LUTs — Mixing Light](https://mixinglight.com/color-grading-tutorials/4-things-to-know-about-working-with-luts/)
- [The Essential Guide to LUTs — Frame.io](https://blog.frame.io/2019/08/12/luts-101/)
- [33 vs 65-Point LUTs: Grid Size & Accuracy — alestemple.net](https://www.alestemple.net/blog/33-point-vs-65-point-luts-explained.html)
- [How can I change the strength/opacity of the 3D LUTs in DaVinci Resolve? — Lutify.me](https://lutify.me/docs/how-can-i-change-the-strength-opacity-of-the-3d-luts-in-davinci-resolve/)
- [Solutions to Resolve Part 3: Unexpected clipping when grading — ProVideo Coalition](https://www.provideocoalition.com/solutions-to-resolve-part-3-unexpected-clipping-when-grading/)
- [What Are the Limitations of LUTs When Color Correcting in 32-bit Float? — Mixing Light](https://mixinglight.com/color-grading-tutorials/luts-and-32-bit-float/)
- [Colorist Circuit Training Part 1 — Mixing Light](https://mixinglight.com/color-grading-tutorials/colorist-circuit-training-part-1/)
- [Color Grading For Beginners — Jason Buff Photography](https://www.jabustudio.com/post/color-grading-for-beginners)
