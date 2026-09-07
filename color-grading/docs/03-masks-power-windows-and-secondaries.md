# Masks, Power Windows, and Secondaries

Everything in the first two documents was global — corrections and looks applied to the whole frame. This document is about working on *part* of the frame: guiding the eye, relighting a face, separating a subject from its background, fixing one problem area, or applying a look selectively rather than uniformly. The underlying principle carries across every tool covered here: **primaries set the global tone, secondaries create depth and direction.** A grade that never leaves the primary wheels tends to look flat and uniform even when the colour itself is technically correct, because real light never falls on a scene evenly — faces catch more light than the shadows behind them, skies are brighter than foregrounds, and a good grade reintroduces some of that directionality on purpose.

## DaVinci Resolve

Resolve is the deepest tool of the three covered here for masking, and it's where you should do most tracked, moving secondary work — Photoshop and After Effects both have real strengths, covered below, but neither matches Resolve's combination of tracking, qualifiers, and node-based compositing for this specific job.

### Power Windows

A Power Window isolates a region of the frame so a correction applies only inside (or outside) it. Resolve gives you several shapes, each suited to a different problem:

| Shape | Best for |
|---|---|
| Circle / ellipse | Faces, round objects, radial vignettes |
| Linear (four-point) | Simple rectangular regions — a wall, a horizon split |
| Polygon | Irregular straight-edged objects — a doorway, a piece of signage |
| Gradient | Simulating a graduated filter — darkening a sky, balancing a bright top-of-frame |
| Curve (Bezier/PowerCurve) | Organic, irregular shapes — tracing a body or an object outline by hand |

Every window has a **softness** control that feathers its edge into a smooth transition rather than a hard cutout — with circle windows the softness applies to the whole shape uniformly, while polygon windows let you soften each corner independently. Softness is not optional polish; a window with no feather is very easy to spot, which defeats the purpose (see Craft rules, below).

To affect *outside* a window rather than inside it, you invert the key on that node (Resolve exposes this as an "outside" toggle on the node's key controls) — useful for vignettes and for any correction meant to touch everything except an isolated subject.

### Window tracking

A window drawn on frame one is useless by frame ninety unless it moves with whatever it's isolating. Resolve offers two tracking approaches:

- **Cloud tracker** (the default) automatically finds a cluster of trackable points inside the window and follows the aggregate motion of that cloud — the window then moves, resizes, rotates and skews to match. This is the fast, "just track it" option and handles most simple cases well.
- **Point tracker** lets you manually place one or more crosshairs on specific high-contrast features you choose, rather than letting Resolve pick automatically. Slower to set up, but more reliable on difficult footage — motion blur, low contrast, or a feature the cloud tracker keeps losing.

Resolve 19 added **IntelliTrack** (Studio version only), an AI-assisted tracker that complements the existing cloud/point tools on especially difficult shots. Whichever tracker you use, complex motion — hair, hands crossing a face, someone turning away from camera — will still need manual **keyframing** on top of the automatic track; when an object passes in front of your tracked window, there's no automatic fix, and hand keyframing through the occlusion is the only reliable answer.

### Combining windows with qualifiers

A window isolates by *position*; a qualifier isolates by *colour or luminance*. Combined on the same node (or across nodes), they let you do things neither can do alone — for example, a window around a background plus a qualifier keying only the sky within it, so a tree overlapping the horizon inside your window is excluded automatically.

- **HSL qualifier** — a general-purpose keyer selecting by hue, saturation and luma together; not restricted to any particular colour, so it can key skin, sky, foliage, or anything else you sample.
- **RGB qualifier** — selects based on the red, green and blue channel values directly.
- **LUM (luminance) qualifier** — selects purely by brightness, ignoring colour entirely; useful for isolating a tonal range (say, only the brightest part of a window) regardless of what colour occupies it.
- **3D keyer** — lets you sample by drawing directly over the image, adding to or subtracting from a three-dimensional colour-space selection as you go; flips between HSL and YUV sampling. It's a faster, more visual way to pull a precise key than dialling in HSL ranges by hand.

### Matte finesse, and the key mixer

Once a qualifier or window produces a matte, Resolve's **matte finesse** controls refine it: Pre-Filter smooths the image before selection; **Clean Black** removes stray white speckling in what should be solid black (background) areas; **Clean White** fills unwanted holes in what should be solid white (selected) areas; **Blur Radius** softens the matte's edge, with an In/Out Ratio controlling how that blur is distributed; **Morph (Shrink/Grow)** dilates or erodes the matte boundary; **Denoise** cleans up noisy matte edges. Together these turn a rough, noisy key into a clean, usable matte.

The **Key Mixer** lets you combine multiple keys/mattes from different nodes — union, subtract, intersect — which is how you build a compound matte (skin, minus eyes and teeth, say) from several simpler keys rather than trying to pull one perfect key in a single pass.

### Magic Mask

Magic Mask uses Resolve's AI to generate a matte for a person or an object without manual keying or a traditional tracked window at all — you draw a rough stroke, and it segments and tracks the subject automatically, including through some motion and rotation that would defeat a Power Window. In DaVinci Resolve 21 (2026), Person and Object modes were merged into a single unified AI mode with a genuinely improved underlying model, particularly on occlusions (something passing in front of your subject) and depth handling. The update also added a "Render in Place" caching option that locks a tracked Magic Mask into a travelling-matte node linked back to your active node — this matters in practice because Magic Mask tracking is one of the more GPU-intensive operations on the Color page, and previously any change meant a slow, frustrating re-track of the whole clip. Magic Mask 2's refinement workflow uses positive and negative (subtractive) clicks plus a tracked click list, so you can correct the AI's guess frame by frame rather than starting over. Resolve 21 also extended native AI masking (Magic Mask included) to photo files, useful for your X-T5 stills work directly inside Resolve.

Magic Mask is extremely fast for a first pass on a clean subject, but it's not infallible — on tricky occlusions, fast motion, or low contrast against the background it can drift, and it's still worth checking against a highlight/matte view (below) rather than trusting it blind.

### Recipes

A handful of combinations come up constantly enough to be worth knowing by name:

- **Vignette** — a large, heavily feathered circle or gradient window, outside-keyed, with a small reduction in exposure and/or saturation. Subtle is the goal; a vignette that's visible as a vignette has usually gone too far.
- **Face relight** — a soft ellipse window over the face (tracked, feathered generously), a slight gain increase and a slight warm push, mimicking a bounce card or fill light that wasn't quite there on set.
- **Sky window** — a gradient window over the top of frame combined with a qualifier keying blue/sky tones specifically, so the correction holds to the sky even where the horizon isn't a straight line.
- **Background desaturation** — an outside-keyed window around the subject (or a Magic Mask on the subject, inverted) with saturation pulled down behind them, pushing focus forward without a depth-of-field trick.
- **Dodge and burn** — multiple small, soft windows, some raising exposure slightly (dodge), others lowering it slightly (burn), placed to reinforce the existing lighting direction in a shot rather than fight it. Effective dodge and burn starts with reading the shot's actual light direction and shadow falloff, not with an arbitrary pattern.
- **Isolating and cooling shadows** — a LUM qualifier restricted to the lower part of the tonal range, pushed cooler, leaving mids and highlights untouched — a controlled, luminance-based version of the teal/orange split-tone from the theory document.

## Photoshop

Photoshop's masking strengths are in stills work (your X-T5 files) and in building a look that survives revision — its non-destructive layer model is arguably the most mature of the three tools here.

### Layer masks and luminosity masks

A basic **layer mask** is a greyscale map painted directly onto a layer or adjustment layer: white reveals, black conceals, grey creates partial, blended visibility. **Luminosity masks** take this further, building a mask directly from the image's own brightness values so an adjustment lands more strongly on highlights (or shadows, or midtones) automatically. Two ways to build one:

- **Channel method** — Cmd/Ctrl-click the RGB composite channel in the Channels panel to load luminosity as a selection, save it as a new alpha channel, then invert, intersect or subtract to narrow the range (highlights only, shadows only, and so on). Faster to build, but produces an 8-bit mask.
- **Calculations method** — use Image > Calculations to blend channels together mathematically, producing a more precise 16-bit mask. Slower to set up, but noticeably more accurate for fine luminosity-range work.

**Blend If** (in the Layer Style dialog) achieves a related result — restricting a layer's visibility to a tonal range — without baking anything down, and its sliders stay live and adjustable at any time, which a painted or channel-based mask doesn't offer once you move on. The trade-off is that a luminosity mask, once built, is more precise and easier to layer with paint or selections; Blend If is faster to iterate but coarser.

### Select Subject, Select Sky, and Color Range

**Select Subject** uses Adobe's AI to automatically select the main subject of a photo with a single click — a strong starting point for a mask you'll then refine by hand. **Select Sky** does the same specifically for sky regions, useful before a gradient or colour adjustment intended only for the sky. **Color Range** builds a selection from sampled colour or tone rather than subject recognition — pick a colour with the eyedropper, use Localized Color Clusters to keep the selection spatially sensible, and adjust Fuzziness to control how tightly the selection holds to the sampled colour. Color Range is the tool of choice when what you need selected is defined by *colour* rather than by *what object it is* — a specific wardrobe colour, or a colour cast confined to one part of frame.

### Camera Raw masking

Camera Raw's Masking panel (shared with Lightroom) offers AI-driven **Subject**, **Sky**, **Background**, and **People** masks, alongside more manual options: a **luminance range** mask, a **colour range** mask, and **radial/linear gradient** and **brush** masks for hand-drawn work. Every mask type supports **subtract** and **intersect** operations, so you can combine several — Subject minus a brush stroke over the hands, say, or Sky intersected with a luminance range to grab only the brighter part of the sky. Recent updates added Edge and Feather Refinement sliders across the AI mask types (Sky, Subject, Background, Landscape, People), plus local Color Grading controls usable directly within a mask — meaning split-toning and hue/saturation pushes can now be confined to a mask region without leaving Camera Raw for full Photoshop layer work.

### Applying a look through a mask, non-destructively

A **Color Lookup adjustment layer** applies a LUT the same non-destructive way any adjustment layer works — full reversibility, and (when applied to a Smart Object or a properly configured document) full 16-bit-per-channel fidelity retained underneath it. Paint or build a mask on that adjustment layer to confine the look to part of the frame — a Color Lookup layer masked to the sky only, for instance, layered independently from a second Color Lookup masked to skin. For maximum flexibility, convert your working layer to a **Smart Object** first: filters and adjustments applied to a Smart Object become non-destructive Smart Filters with their own mask, scaling and transforms stay reversible, and the whole stack can be revisited and changed later without having baked anything down.

## After Effects

After Effects' masking tools overlap with Resolve's conceptually — masks, tracking, keying — but the tool exists inside a compositing application first and a grading application second, which shapes where it's strong and where it isn't.

**Masks** in After Effects are Bezier shapes drawn directly on a layer, with **Mask Feather** softening the edge and **Mask Expansion** growing or shrinking the mask boundary independently of where the feather is centred — together these behave much like Resolve's softness plus shrink/grow controls.

**Roto Brush 3** ("Next-Gen Roto Brush") is After Effects' AI-driven rotoscoping tool, and a meaningful step up from earlier versions specifically on hard cases — overlapping limbs, hair, semi-transparent edges. Workflow-wise: open the clip in the **Layer panel** (not the Composition panel — Roto Brush behaves far more predictably there), draw strokes through the *centre* of your subject to mark foreground rather than tracing its outline, and Alt/Option-drag to mark background. The tool then propagates and tracks that segmentation across the surrounding frames.

**Track mattes** use one layer's alpha or luminance to cut a hole in another — Alpha Matte for transparency-based cutouts, Luma Matte for brightness-based ones. This is the standard way to combine a Roto Brush (or hand-drawn) matte with a colour adjustment sitting on a separate layer.

For grading through a mask, the common pattern is a **Lumetri Color** effect (or a LUT) applied to an **adjustment layer**, with a mask — hand-drawn, tracked, or a track matte — confining where that adjustment layer's effect actually lands. For anything more complex than a simple tracked shape, **Mocha AE** (bundled with After Effects) does planar tracking — tracking a textured surface rather than a point or a cloud of points — and its results can be exported as native After Effects masks or applied directly as an alpha matte, making it the better choice than After Effects' built-in tracker for a difficult moving window (a phone screen, a sign, a face turning through profile).

Bit depth matters here the same way it does in Resolve: **16-bit or 32-bit per channel** reduces the banding and quantisation artefacts that heavy grading and feathered masks can otherwise introduce, at the cost of slower previews than 8-bit — 16-bit is usually enough for grading work, with 32-bit float reserved for the heaviest pushes or HDR-adjacent work.

**Honestly: Resolve is the better tool for tracked secondaries.** Its qualifiers, node-based key combination, and tracking are purpose-built for exactly this job, and it's simply faster to get a clean, tracked, feathered window in Resolve than to assemble the equivalent from masks, track mattes and Mocha in After Effects. Reach for After Effects instead when the grade has to *live inside a composite* — sitting between layers of text, VFX elements, or motion graphics where the grading and the compositing genuinely can't be separated into different applications without breaking the pipeline.

## Craft rules

A handful of habits separate secondary work that reads as intentional from secondary work that reads as a mistake:

- **Feather generously.** A hard-edged window is one of the fastest ways to make a correction visible as a correction — when in doubt, add more softness than feels necessary and check again.
- **Avoid haloing.** A bright or saturated edge glowing around a masked subject is usually over-tightened matte finesse or a mask that's slightly too small for its subject; back off shrink/grow and check the edge in isolation.
- **Keep windows moving with the subject.** Tracking drift — a window that's a few pixels behind the face it's meant to cover — is far more visible on a moving shot than a static frame suggests; check the full duration of the shot, not just the frame you built the window on.
- **Keep it invisible.** The single best test of any secondary: if the audience can see the mask, it failed. A viewer should feel that a face is a little brighter, never notice *why*.
- **Work on a few frames, then scrub.** Build a window or matte on one frame, then scrub through the whole shot before refining further — many problems (drift, edge breakup, an occlusion you didn't account for) only show up in motion.
- **Use a highlight or matte view to check edges.** Every tool covered here has a way to see the raw mask in isolation (Resolve's Highlight toggle or matte view, After Effects' matte preview) — use it before trusting a key or a Magic Mask by eye alone; problems that are subtle on the graded image are usually obvious on the raw matte.

## A short exercise list

- **Vignette from scratch.** Build a feathered, outside-keyed window vignette on one clip by hand, no preset. Check it against the waveform to confirm it's actually doing something, not just placebo.
- **Track a face through a turn.** Pick a shot where the subject turns their head significantly, and get a tracked window to hold on their face through the whole motion — expect to need manual keyframes, not just an automatic track.
- **Build one dodge-and-burn pass.** Take a flatly lit shot and add three or four small windows to reinforce a light direction that isn't really there, then compare before/after side by side.
- **Recreate one AI mask by hand.** Run Magic Mask (or Select Subject) on a clip or still, then try building an equivalent mask manually with qualifiers or luminosity masks — a useful check on what the AI tool is actually doing, and good practice for the cases where it doesn't work.
- **Match a masked look across two tools.** Take one still from the X-T5, mask a selective grade in Camera Raw, then reproduce the same selective look with a hand-built layer mask in full Photoshop — a good way to feel the difference between the AI-assisted and manual paths.

## Sources

- [DaVinci Resolve Power Windows Explained — JayAreTV](https://jayaretv.com/color/davinci-resolve-power-windows-explained/)
- [Power Windows Definition — DaVinci Resolve Explained (Tella)](https://www.tella.com/definition/power-windows)
- [Unlock Pro-Level Editing: DaVinci Resolve Power Windows! — Eduardo Oroz](https://eduardooroz.co/power-window-davinci-resolve/)
- [Mastering DaVinci Resolve's Cloud and Point Trackers for Power Windows and OpenFX — Mixing Light](https://mixinglight.com/color-grading-tutorials/mastering-davinci-resolves-cloud-and-point-trackers/)
- [Cloud Tracker Workflows — DaVinci Resolve Manual (SteakUnderwater)](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part2874.htm)
- [Tracking a Window Using the Point Tracker — DaVinci Resolve Manual (SteakUnderwater)](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part2878.htm)
- [In-depth with DaVinci Resolve 19's IntelliTrack and ColorSlice features — RedShark News](https://www.redsharknews.com/in-depth-with-davinci-resolve-19s-intellitrack-and-colorslice-features)
- [First Look at the DaVinci Resolve 3D Keyer — Mixing Light](https://mixinglight.com/color-grading-tutorials/first-look-at-the-davinci-resolve-3d-keyer/)
- [Basic Qualification Using the 3D Qualifier — DaVinci Resolve Manual (SteakUnderwater)](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part2808.htm)
- [The Complete Guide to Qualifier and Secondary Correction in DaVinci Resolve — cinapex](https://cinapex.pro/davinci-resolve-qualifier-secondary-correction/)
- [Matte Finesse Controls Definition — DaVinci Resolve Explained (Tella)](https://www.tella.com/definition/matte-finesse-controls)
- [Matte Finesse Controls — DaVinci Resolve Manual (SteakUnderwater)](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part2819.htm)
- [DaVinci Resolve AI Magic Mask v2 Explained — JayAreTV](https://jayaretv.com/color/davinci-resolve-ai-magic-mask-2-explained/)
- [DaVinci Resolve 21 is Now a Lightroom Alternative — PetaPixel](https://petapixel.com/2026/04/13/davinci-resolve-21-is-now-a-lightroom-alternative-raw-editing-tethering-masking-and-more/)
- [DaVinci Resolve Magic Mask: Resolve 21 Guide — DaVinci Resolve Club](https://davinciresolveclub.com/davinci-resolve-magic-mask/)
- [Using Relight — DaVinci Resolve Manual (SteakUnderwater)](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part3278.htm)
- [How to make vignettes in DaVinci Resolve (4 Ways) — Filmmaking Elements](https://filmmakingelements.com/how-to-make-vignettes-in-davinci-resolve/)
- [Dodge&Burn Video: AI Skin Retouching Plugin for DaVinci Resolve & Premiere Pro — retouch4me](https://retouch4.me/dodgeburn-video)
- [Better Window Tracking: Combining Tracking With Manual Keyframes — Mixing Light](https://mixinglight.com/color-grading-tutorials/better-window-tracking-combining-tracking-with-manual-keyframes/)
- [Tracking Power Windows: Tips and Tricks in DaVinci Resolve — Mixing Light](https://mixinglight.com/color-grading-tutorials/tracking-techniques/)
- [COMPLETE GUIDE TO LUMINOSITY MASKS — Julia Anna Gospodarou](https://www.juliaannagospodarou.com/complete-guide-luminosity-masks/)
- [How to use Luminosity Masks in Photoshop tutorial — PhotoshopCAFE](https://photoshopcafe.com/how-to-use-luminosity-masks-in-photoshop-tutorial/)
- [Blend If vs Luminosity Masks — Stephen Bay Photography](https://stephenbayphotography.com/blog/blend-if-vs-luminosity-masks/)
- [3 Ways to Make a Sky Selection Using Photoshop — Digital Photography School](https://digital-photography-school.com/3-ways-make-sky-selection-photoshop/)
- [Select color range in Photoshop — Adobe Help](https://helpx.adobe.com/photoshop/desktop/make-selections/freehand-selections/select-a-color-range-in-photoshop.html)
- [Apply Masking for local adjustments in Camera Raw — Adobe Help](https://helpx.adobe.com/camera-raw/using/masking.html)
- [Camera Raw Just Got Better: Masking Refinements, Local Color Grading & Extended White Balance — Julieanne Kost](https://jkost.com/blog/2026/05/camera-raw-just-got-better-masking-refinements-local-color-grading-extended-white-balance.html)
- [AI Masking in Adobe Camera RAW — PHLEARN](https://phlearn.com/tutorial/10-days-of-ai-in-photoshop-and-lightroom-day-4/)
- [Use Photoshop's Color Lookup Adjustment Layer to Quickly Apply Consistent Color Grades](https://lifetips.alibaba.com/tech-efficiency/use-photoshops-color-lookup-adjustment-layer-to-quickly)
- [Use layer masks for targeted adjustments in Photoshop — Adobe Help](https://helpx.adobe.com/photoshop/desktop/create-manage-layers/color-adjustment-fill-layers/use-layer-masks-to-target-adjustment-or-fill-layers.html)
- [Nondestructive editing in Photoshop — Adobe Help](https://helpx.adobe.com/photoshop/using/nondestructive-editing.html)
- [Use Next-Gen Roto Brush 3 — Adobe Help](https://helpx.adobe.com/after-effects/desktop/using/video/roto-brush-refine-matte-video.html)
- [How to Use Roto Brush 3 and Content-Aware Fill in After Effects — Vagon](https://vagon.io/blog/how-to-use-roto-brush-3-and-content-aware-fill-in-after-effects)
- [Using Track Matte in After Effects — Boris FX](https://borisfx.com/blog/using-track-matte-in-after-effects/)
- [Mocha AE: Academy Award-Winning Planar Tracking and VFX — Boris FX](https://borisfx.com/products/mocha-ae-cc-mocha-for-after-effects/)
- [Use alpha channels, masks, and mattes in After Effects — Adobe Help](https://helpx.adobe.com/after-effects/using/alpha-channels-masks-mattes.html)
- [Working in 8 bit vs 16/32bit? — Creative COW](https://creativecow.net/forums/thread/working-in-8-bit-vs-1632bitae/)
- [DaVinci Resolve vs Adobe After Effects: a comparison — Evercast](https://www.evercast.us/blog/davinci-resolve-vs-after-effects)
- [DaVinci Resolve vs After Effects | Which Video Editing Software Wins? — SelectHub](https://www.selecthub.com/video-editing-software/davinci-resolve-vs-after-effects/)
- [Masking and Keying Tutorial Index — Mixing Light](https://mixinglight.com/tutorial-category/technique/masking-and-keying/)
