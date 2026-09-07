# Resolve Workflow for the FX30

The FX30 is an easy camera to under-expose and an easy camera to grade badly, because S-Log3 rewards a completely different set of habits to a standard picture profile. This guide covers what the camera is actually doing to the signal, then two ways to set DaVinci Resolve up to undo it correctly, a node tree you can reuse on every job, how to apply BNC Grade's own `.cube` LUTs inside that tree, and a delivery checklist that avoids the two most common ways footage leaves Resolve looking wrong.

## 1. FX30 facts for graders

### Sensor and codec

The FX30 uses a 26MP APS-C ("Super 35mm") Exmor R CMOS sensor with a BIONZ XR processor, reading the full 6K sensor and oversampling down to 4K. It records 10-bit 4:2:2 in two XAVC flavours:

| Format | Resolution / frame rate | Bitrate | Chroma / bit depth |
|---|---|---|---|
| XAVC HS (H.265) | 4K 59.94p/50p | ~200 Mbps | 4:2:2 10-bit |
| XAVC HS (H.265) | 4K 119.88p/100p | ~280 Mbps | 4:2:2 10-bit |
| XAVC S-I (H.264, all-intra) | 4K 59.94p | ~600 Mbps | 4:2:2 10-bit |

XAVC S-I is the easier codec to grade hard — all-intra frames mean less compression artefacting shows up once you push contrast and saturation in a node tree, at the cost of much larger files than long-GOP XAVC HS.

### S-Log3, S-Gamut3.Cine, and dual base ISO

Shot in S-Log3, the FX30 records a logarithmic, scene-referred signal with 14+ stops of dynamic range in S-Gamut3.Cine, a colour space sized close to DCI-P3 with extra grading headroom. Crucially, the FX30 has **dual base ISO**: two points, ISO 800 and ISO 2500, where the sensor's read noise is lowest and dynamic range is highest simultaneously. Any ISO between or outside those two values is a compromise — you're either adding gain on top of a base that already has headroom to spare, or you're short of the clean point the sensor is built around. The practical rule: shoot at 800 in normal-to-bright light, jump straight to 2500 rather than creeping up through 1000, 1250, 1600 when light drops, and treat every other ISO value as a fallback, not a default.

### Cine EI mode

Cine EI (Cinema Exposure Index) locks the camera to native base ISO — on the FX30, you choose 800 or 2500 and the camera won't let you dial an arbitrary ISO on top of it. Instead, you set an **Exposure Index (EI)** value that shifts how the flat log image is *interpreted* for monitoring (via the camera's monitoring LUT and metadata) without touching the actual sensor gain. This means you always record at the sensor's cleanest, widest-latitude setting, and any "pull" or "push" you dial in EI is a monitoring/grading decision, not a noise-floor decision. Standard S-Log3 shooting mode, by contrast, lets you change ISO freely like a normal picture profile — simpler, but it gives up the guarantee that you're always at a clean base.

### Exposure practice

Log footage should look overexposed on the LCD — that's the image doing its job, not a mistake. Expose to the right (ETTR) using zebras or a waveform, not by eye.

| Reference | S-Log3 target |
|---|---|
| 18% grey card | ~41 IRE |
| Skin tone (varies by complexion) | roughly 45–55 IRE (sources give as wide as 45–65 IRE depending on how fair or deep the skin tone is) |
| Zebra clip warning | set to 94%+ |
| Recommended exposure push (ETTR) | roughly +1 to +1.7 stops over the camera's meter (up to +2 in low light at ISO 2500), backed off the moment zebras appear |

Steps for setting zebras on the FX30: Menu → Exposure/Color → Zebra Display → Zebra Level → select a custom slot (C1) → set Lower Limit to 94 (check the exact menu path in your firmware, as Sony reorganises this menu between models). Expose until the meter reads roughly 1–1.7 stops over, then watch for zebras — back off as soon as they appear on anything you need to hold detail in.

### Where S-Log3 clips

This is the figure with the least agreement across sources, so treat it as a range rather than a single number: reports for Sony's S-Log3 family put the practical white clip point anywhere from about 88 IRE to 94 IRE depending on camera model and EI setting, with the FX30-specific guidance found here recommending a 94% zebra as the warning threshold. S-Log3 black sits at code 95 of 1023 (about 3.5% on a full-range scale), so the waveform of a correctly exposed log clip never reaches zero — that is expected. Check the exact ceiling on a waveform for your specific camera and firmware rather than trusting a single published number — the safest working assumption is that detail above roughly 90 IRE is already at risk.

### Noise behaviour

There is more noise at ISO 2500 than at 800, but not dramatically more — the FX30's 6K-to-4K oversampling keeps the grain fine even when you add further gain in post. The camera has no in-body noise reduction for video, so all NR is a post-production decision (see Section 3 on node order, and the exposure guide for NR-before-grain sequencing).

### Classic mistakes

1. **Underexposing log.** This is the single most common error — because a correctly-exposed log image looks "too bright" on a plain LCD, people instinctively pull exposure down, which pushes shadow detail into the noise floor and throws away the dynamic range S-Log3 exists to capture.
2. **Wrong colour space interpretation.** Grading S-Gamut3.Cine as if it were Rec.709, or stacking a colour space transform on top of a camera-applied LUT on top of a project-level colour management setting, produces a "double transform" — crunchy, over-saturated, wrong-feeling colour before you've touched a single wheel.
3. **Treating Sony's monitoring "709" LUT as the finished grade.** It exists so you can see something plausible on set; it is not colour-managed for Resolve's timeline, has no creative intent, and applying a Rec.709 LUT directly to log without a proper log-to-709 transform first is what makes S-Log3 footage look "milky" — lifted blacks, flat saturation, plastic-looking skin.

## 2. Resolve setup — two ways

### Method A: DaVinci YRGB Color Managed (recommended default)

1. Project Settings → Color Management → Color Science → **DaVinci YRGB Color Managed**.
2. Color Management Preset → **DaVinci Wide Gamut Intermediate**.
3. Timeline Color Space is set by the preset; confirm Output Color Space is **Rec.709 Gamma 2.4** for a standard SDR delivery (swap to Rec.2100 PQ/HLG only if you're actually delivering HDR).
4. Input colour space per clip: with RCM enabled, Resolve reads camera/container metadata to identify input colour space automatically where it's present; for clips it can't infer, or to force it, set Input Color Space / Input Gamma per clip in the Color page's Clip Attributes (or the Camera RAW panel for raw formats).

This keeps all your creative nodes working in DaVinci Wide Gamut / DaVinci Intermediate — a working space deliberately larger than anything your cameras can produce, so grading moves don't clip real image data before you've made a deliberate decision to let them.

### Method B: Manual Color Space Transform (CST) nodes

For more visible, node-by-node control, skip RCM and build the transform yourself with two CST nodes:

**First node (normalise into the working space):**
- Input Color Space: Sony S-Gamut3.Cine
- Input Gamma: Sony S-Log3
- Output Color Space: DaVinci Wide Gamut
- Output Gamma: DaVinci Intermediate

**Last node (deliver to Rec.709):**
- Input Color Space: DaVinci Wide Gamut
- Input Gamma: DaVinci Intermediate
- Output Color Space: Rec.709
- Output Gamma: Rec.709 Gamma 2.4

All creative grading happens on nodes between those two transforms, entirely in log/scene-referred data.

Two settings worth understanding on the CST node:

- **Tone Mapping** — "DaVinci" gives a smooth luminance roll-off in the shadows and highlights with controlled desaturation at the extremes, and is the setting to reach for with wide-gamut camera media like S-Log3; "Simple" compresses/expands the dynamic range with a simpler curve; "Luminance Mapping" behaves like DaVinci but is more accurate when everything on the timeline is already in a single standards-based space (e.g. mixing in Rec.709 source alongside your log footage).
- **Gamut Mapping / Saturation Mapping** — automates expansion or contraction of saturation so a large-gamut source (S-Gamut3.Cine) compresses into Rec.709 without hard clipping, aiming for a "pleasing, naturalistic" result rather than a mathematically literal one. This is the setting doing the actual highlight-desaturation work referenced throughout this documentation set.

Two further options exist on the CST and are worth knowing even if you leave them at default: **Use White Point Adaptation** applies a chromatic-adaptation transform so the white point of the input space is aligned to the output space's white point (only exposed when the Color Management preset is set to Custom) — leave it on unless you have a specific reason to view an unaltered white point. **Apply Forward/Inverse OOTF** (Opto-Optical Transfer Function, also called "system gamma") governs scene-referred vs display-referred conversion; the rule of thumb reported is to apply Forward OOTF when going from a large/scene-referred space to a display space, and Inverse OOTF for the reverse. Confirm these controls' exact wording and default state in your installed version, as Blackmagic has moved CST controls around across releases.

### CST vs the project's technical LUT — when to use which

Both do the same fundamental job (S-Log3/S-Gamut3.Cine → Rec.709 Gamma 2.4 with a filmic roll-off); they're not interchangeable in every situation:

- **Use the CST / RCM** as your default in Resolve. It's colour-managed, keeps intermediate math in a wide working space so later grading moves have somewhere to go, and lets you retune tone mapping and gamut mapping per clip if a shot needs it.
- **Use the project's technical LUT instead** when you need an exact, portable match to the same transform used elsewhere in the pipeline — e.g. previewing footage in an app with weaker colour management, handing footage to someone grading in a different tool, or matching a look built and tested in Photoshop/Camera Raw on stills, where a `.cube` LUT (not a CST setting) is the shared reference. The LUT is also simply faster to drop on for a quick turnaround where per-clip tone-mapping tuning isn't needed.

## 3. A node tree you can reuse

Two trees, pick one per project. Both follow the same order of decisions:
fix in log → shape → isolate → display transform → look → texture. The
important rule is where the display transform sits: everything **before** it is
scene-referred (log) and everything **after** it is display-referred, and the
look LUTs in this pack are display-referred, so they must come after it.

### Tree 1 — LUT pipeline (recommended with this pack)

Grade in S-Log3 "underneath" the technical LUT. The base LUT is the display
transform; the look LUT sits after it.

| # | Node name | Purpose | Tools |
|---|---|---|---|
| 00 | NR | Temporal/spatial noise reduction only if the clip needs it (Studio) | Motion Effects palette |
| 01 | Balance | Exposure and white balance while still in log: Offset wheel / printer lights. Put an 18% grey at about 41% on the waveform, level the parade on a neutral | Primaries → Offset, Log wheels |
| 02 | Primary | Contrast with the pivot at grey's log value (about 0.41), restraint on saturation | Primaries → Contrast / Pivot, Color Boost |
| 03 | Skin | HSL qualifier on skin, limited by a window; gentle hue and saturation trims | Qualifier, Power Window |
| 04 | Windows | Vignette, relight, sky, background desaturation | Power Windows + tracking |
| 05 | BASE LUT | `BNC_Base_SLog3-SGamut3Cine_to_Rec709-G24.cube` on its own node. This is the display transform | 3D LUT |
| 06 | Look | One of `BNC_L01…L13` on its own node. Lower the node's Key Output Gain (0.5–1.0) for a lighter dose | 3D LUT |
| 07 | Trim | Small display-referred trims after the look: lift/gamma/gain, soft clip | Primaries, Soft Clip |
| 08 | Texture | Grain, halation or glow, always last | Film Grain, Glow (ResolveFX) |

Do not put a CST and the base LUT on the same signal — that is a double
transform. Contrast in log behaves differently from display-referred contrast,
so keep node 02 gentle and do finishing contrast in node 07 if needed.

### Tree 2 — colour-managed (RCM or manual CST) with a LUT "sandwich"

If the project runs DaVinci YRGB Color Managed (DaVinci Wide Gamut /
Intermediate) or you normalise with a CST node, the clip nodes work in
DaVinci Intermediate (18% grey sits at about 34%) and the output transform
happens after every node. A Rec.709 look LUT still works if you sandwich it:

| # | Node name | Purpose |
|---|---|---|
| 00 | NR | as above |
| 01–04 | Balance, Primary, Skin, Windows | as above, in DaVinci Wide Gamut / Intermediate |
| 05 | CST → 709 | Color Space Transform: DaVinci Wide Gamut / DaVinci Intermediate → Rec.709 / Gamma 2.4, Tone Mapping "DaVinci", Gamut Mapping "Saturation Compression" |
| 06 | Look | `BNC_L..` look LUT |
| 07 | CST ← 709 | Color Space Transform: Rec.709 / Gamma 2.4 → DaVinci Wide Gamut / DaVinci Intermediate, tone mapping off, so the project's own output transform renders the look exactly as designed |
| 08 | Texture | grain / halation |

With manual CSTs (Method B) you can drop node 07: node 05 becomes your output
CST and the tree simply ends CST-out → Look → Trim → Texture.

### Saving as a PowerGrade and as a Grade

- **Gallery Stills** are project-specific. **PowerGrades** live in a Gallery album marked as a PowerGrade and are available in every project you open.
- To save this whole seven-node tree for reuse: build it once, then in the Gallery select (or create) a PowerGrade album, right-click the viewer, and **Grab Still** — with a PowerGrade album active this captures the entire node tree (nodes, windows, qualifiers, OFX, RAW settings), not just a flattened colour result the way a LUT would.
- To apply it to a new clip: **Apply Grade** replaces the clip's current node tree outright (best for a fresh, ungraded clip); **Append Node Graph** adds the PowerGrade's nodes onto the end of whatever's already on the clip.
- Saving as a reusable **"Grade"** (a single still in the Stills album rather than a PowerGrade) is the project-scoped equivalent — good for a look you want available across the shots in this one job without polluting your global PowerGrade library.

### Groups, and pre-clip/post-clip

Grouping clips (Color page, select clips → Group) exposes three grading contexts per group: **Group Pre-Clip**, **Clip**, and **Group Post-Clip**. A practical split for FX30 material: put the normalising CST (or per-clip exposure quirks) in Group Pre-Clip so every clip in the group is brought to the same working space; do individual balancing (exposure, WB, shadow recovery) on the **Clip** level since every shot differs; put the shared creative grade — the actual look — in **Group Post-Clip**, so one adjustment updates every clip in the scene at once. Combine this with **Shared Nodes** (right-click a node → Add Shared Node) when you want one node's settings to update simultaneously across multiple groups, which is the fastest way to apply or revise the technical LUT/CST across an entire multi-scene timeline in one move.

## 4. Applying BNC Grade's `.cube` LUTs

**LUT folder locations:**

| Platform | Path |
|---|---|
| macOS | `Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/` |
| Windows | `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\LUT` (ProgramData is hidden by default — enable hidden items in File Explorer) |

The quickest way to reach the right folder without hunting for it: **Project Settings → Color Management → Open LUT Folder**. Drop the project's `.cube` files (or a subfolder for them) in there.

After adding files, Resolve won't see them until you refresh: on the Color page, open the **LUTs** panel, right-click in the browser and choose **Refresh LUT List** (sometimes labelled **Update Lists** in Project Settings). Do this every time you add or replace a LUT file on disk.

**Placement and strength:**

- Put a LUT on its **own node** — never share a node between a LUT and other grading tools. This keeps the LUT toggleable, gradeable in isolation, and lets you reduce its strength predictably.
- To preview a LUT before committing, right-click it in the LUT browser for a preview option, or drag it directly onto a node to try it live.
- To apply the project's **technical** LUT, put it on its own node *after* the log corrections (node 05 in Tree 1) and never together with a CST on the same signal — that would be a double transform.
- To apply the project's **look** LUT, it must land on already display-referred (Rec.709-ish) data — i.e., after the technical LUT/CST, matching node 05 in the tree above.
- To reduce a LUT's strength rather than applying it at full intensity: double-click the node to open it, open the **Key** palette, and lower **Key Output → Gain**. This blends the node's output back toward its input. Because Key Output Gain affects the *whole* node, keep the LUT alone on its node (see above) — otherwise any exposure or window adjustments sharing that node fade along with the LUT, which is rarely what you want.
- **Timeline node vs clip node:** a LUT applied on a timeline-level node affects every clip on that timeline uniformly (useful for a technical/output LUT that should be identical everywhere); a LUT applied on an individual clip's node tree affects only that clip (the right place for a creative look LUT you might want to swap or intensity-trim per shot).

## 5. Resolve features worth using on this project

- **Film Look Creator** (from Resolve 19) — a dedicated ResolveFX for building filmic looks with slider-based control and built-in film-stock-style presets; available in free Resolve with more depth in Studio. Useful as a starting point for the "Look" node if you want a filmic base before layering BNC Grade's own LUT, or as an alternative to it.
- **Color Slice** (from Resolve 20, included in the free version) — part of the newer selective-colour toolset; useful for isolating and shifting a specific colour range without building a full qualifier/window setup.
- **Magic Mask** (updated in Resolve 20) — AI-based subject/object matting, now a single unified mode with point-based selection; a fast way to build the mask for node 03/04 (skin, subject relight) without manual keying, though it's a Studio-only AI feature.
- **Depth Map / background defocus** — Resolve's Depth Map effect (Studio) generates an AI depth matte from a single clip with no tracking required; feeding that matte into a blur is the standard way to defocus a background or separate foreground/background grading, which is the practical route to the "Defocus Background" workflow.

## 6. Delivery

Set the timeline/output colour space to **Rec.709 Gamma 2.4** for standard SDR delivery.

**The QuickTime/Mac gamma shift:** macOS applies a non-2.4 system gamma (effectively close to 1.96 on modern displays), so a file tagged as plain Rec.709 Gamma 2.4 can look lighter/washed out in QuickTime, other Mac apps, and sometimes after upload, compared to how it graded in Resolve. The commonly reported fix is to deliver with the **Rec.709-A** gamma tag instead of a plain Rec.709 tag — keep your timeline working space at Gamma 2.4, but set the *export/output* colour space tag to Rec.709-A so the file's embedded NCLC tag matches what QuickTime/ColorSync expects, producing consistent results from Resolve → QuickTime → most upload platforms.

**Data levels:** Resolve works internally at full range. On export, the Advanced Settings panel of the Deliver page has a **Data Levels** option: Auto, Video, or Full. Use Video (legal, 16–235 in 8-bit terms) for broadcast-style or client-facing masters expected to play on calibrated video gear; use Full for most modern web/social delivery where the platform re-encodes anyway. When in doubt, Auto generally matches the codec's own convention — but check the result on a scope after export if the codec is one you don't deliver often.

**Codec choice:**

| Use case | Codec |
|---|---|
| Client review, social platforms, general web delivery | H.264 (high bitrate, e.g. ~40 Mbps for 4K) — near-universal playback, manageable file size |
| Archive master, further editing, VFX/AE round trip | ProRes 422 HQ or DNxHR HQX — near-lossless, the standard for anything that will be re-touched or re-encoded later |

Every re-encode of a delivery-grade H.264/H.265 file loses information; always keep a ProRes/DNxHR master and generate the compressed social/client versions from that master, not from a previously-compressed file.

### Delivery checklist

1. Timeline/output colour space: Rec.709 Gamma 2.4.
2. Export tag: Rec.709-A if this is going anywhere near a Mac/QuickTime/most social platforms; verify on a second machine if unsure.
3. Data levels set deliberately (Video vs Full), not left to guesswork.
4. ProRes 422 HQ or DNxHR HQX master rendered before any H.264 compression pass.
5. H.264/H.265 client and social exports generated from the ProRes master, at platform-appropriate bitrate.
6. Spot-check the final export's waveform/vectorscope, not just the Resolve viewer, to catch any gamma or levels shift introduced by the render.
7. Play the actual exported file (not the timeline) on a second device before sending.

## Sources

- [Sony FX30 – S-Log3 and Cine EI Modes Explained — CineD](https://www.cined.com/sony-fx30-s-log3-and-cine-ei-modes-explained/)
- [Chart of Sony Dual ISO Base Levels — XDCAM-USER.COM (Alister Chapman)](https://www.xdcam-user.com/2022/10/24/chart-of-sony-dual-iso-base-levels/)
- [ILME-FX30 Help Guide — Base ISO — Sony](https://helpguide.sony.net/ilc/2220/v1/en/contents/TP1000888939.html)
- [Sony FX30 Base ISO for S-Log3 & S-Cinetone — Keith Knittel](https://www.keithknittel.com/articles/sony-fx30-base-iso-for-s-log3-amp-s-cinetone)
- [ILME-FX30 Help Guide — Log shooting — Sony](https://helpguide.sony.net/ilc/2220/v1/en/contents/TP1000888943.html)
- [How to use S-Log3 & Cine EI with the Sony FX30 — Newsshooter](https://www.newsshooter.com/2022/10/03/how-to-use-s-log3-cine-ei-with-the-sony-fx30/)
- [How To EASILY Film In SLOG3 With The Sony FX30 — whoismatt.com](https://whoismatt.com/how-to-easily-film-in-slog3-with-the-sony-fx30/)
- [Stop Overexposing S-Log3 — Gamut.io](https://gamut.io/stop-overexposing-s-log3/)
- [Sony Cinema Line: How Correctly Expose S-Log3 — Sony Cine](https://sony-cinematography.com/articles/how-correctly-expose-s-log3-a7s-iii-fx3-fx6-fx9/)
- [FS7: Slog3 clipping level — DVXuser.com](https://www.dvxuser.com/threads/slog3-clipping-level.336695/)
- [The Sensation of White — Art Adams, ProVideo Coalition](https://www.provideocoalition.com/the-sensation-of-white/)
- [Sony ILME-FX30 Digital Cinema Camera — B&H Photo](https://www.bhphotovideo.com/c/product/1729317-REG/sony_ilme_fx30_fx30_digital_cinema_camera.html)
- [Sony FX30 Specifications — DPReview](https://www.dpreview.com/products/sony/slrs/sony_fx30/specifications)
- [Testing the Sony ILME-FX30 — XDCAM-USER.COM (Alister Chapman)](https://www.xdcam-user.com/2022/12/06/testing-the-sony-ilme-fx30/)
- [Sony Filmmaker's Guide to S-LOG3 — Newsshooter](https://www.newsshooter.com/2025/11/27/sony-filmmakers-guide-to-s-log3/)
- [Technical Summary for S-Gamut3.Cine/S-Log3 and S-Gamut3/S-Log3 — Sony](https://pro.sony/s3/cms-static-content/uploadfile/06/1237494271406.pdf)
- [Why Applying a LUT Directly to S-Log3 Looks Flat — Positiva Films](https://positivafilms.com/posts/why-s-log3-lut-looks-flat-cst-node.html)
- [S-Log3 color correction: from flat log to Rec.709, step by step — Basecut](https://basecut.app/guides/s-log3-color-correction)
- [Log vs Rec.709: The One Mistake That Ruins Every LUT You Apply — Filmit.io](https://filmit.io/blog/log-vs-rec709-lut-mistake/)
- [ILME-FX30 Help Guide — ND Filter — Sony](https://helpguide.sony.net/ilc/2220/v1/en/contents/TP1002071062.html)
- [Color Grade S-Log3 In Davinci Resolve — Color Culture](https://colorculture.org/color-grade-s-log3-in-davinci-resolve-step-by-step-guide/)
- [The Essential Guide to Color Space Transform (CST) in DaVinci Resolve — AAA Presets](https://aaapresets.com/en-mx/blogs/davinci-resolve-color-grading-gradient-tutorials/unlocking-cinematic-magic-the-essential-guide-to-color-space-transform-cst-in-davinci-resolve-in-2025)
- [DaVinci Wide Gamut pipeline — Dehancer](https://www.dehancer.com/learn/article/davinci-wide-gamut-pipeline)
- [Should You Use Resolve Color Management or CSTs? — Frame.io Insider](https://blog.frame.io/2024/10/07/should-you-use-resolve-color-management-or-color-space-transforms-csts/)
- [Best Color Space for DaVinci Resolve — Miracamp](https://www.miracamp.com/learn/davinci-resolve/best-color-space)
- [DaVinci Resolve 17 Wide Gamut Intermediate — Blackmagic Design (official information note)](https://documents.blackmagicdesign.com/InformationNotes/DaVinci_Resolve_17_Wide_Gamut_Intermediate.pdf)
- [Use a Cheat Sheet for DaVinci Resolve Color Management Setup — Frame.io Insider](https://blog.frame.io/2023/12/04/color-management-cheat-sheet-davinci-resolve/)
- [How to Color Manage using Nodes in DaVinci Resolve — Frame.io Insider](https://blog.frame.io/2024/01/08/color-management-nodes-davinci-resolve/)
- [Color Space Transform [CSt] — DaVinci Resolve 18 Manual mirror](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part2262.htm)
- [Tone Mapping — DaVinci Resolve 18 Manual mirror](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part3169.htm)
- [Use White Point Adaptation — DaVinci Resolve 18 Manual mirror](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part302.htm)
- [Color Space Transform OOTF — Lowepost forum](https://lowepost.com/forums/topic/7394-color-space-transform-ootf/)
- [How To Install LUTs in DaVinci Resolve — Mastin Labs](https://mastinlabs.com/blogs/photoism/how-to-install-luts-in-davinci-resolve)
- [Davinci Resolve LUT Folder Location — Mac & PC — aramk.us](https://aramk.us/davinci-resolve-lut-folder-location/)
- [Where can I change the intensity of a LUT? — Blackmagic Forum](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=160091)
- [How can I change the strength/opacity of 3D LUTs in DaVinci Resolve? — Lutify.me](https://lutify.me/docs/how-can-i-change-the-strength-opacity-of-the-3d-luts-in-davinci-resolve/)
- [3 Ways to Store and Share Grades in DaVinci Resolve — PremiumBeat](https://www.premiumbeat.com/blog/store-and-share-grades-in-davinci-resolve/)
- [DaVinci Resolve Powergrade and Gallery Explained — JayAreTV](https://jayaretv.com/color/davinci-resolve-powergrade-and-gallery-explained/)
- [Grouping and Timeline Filtering in DaVinci Resolve — Pond5 blog](https://blog.pond5.com/13574-resolve-grouping-and-timeline-filtering/)
- [Combining Shared Nodes and Group Grades in DaVinci Resolve — Mixing Light](https://mixinglight.com/color-grading-tutorials/combining-shared-nodes-groups-davinci-resolve/)
- [DaVinci Resolve 19: NAB 2024 Interview — CineD](https://www.cined.com/davinci-resolve-19-explained-film-look-creator-ai-powered-tools-and-more/)
- [Slider-by-Slider: Using Resolve's New Film Look Creator — Mixing Light](https://mixinglight.com/color-grading-tutorials/film-look-creator-resolvefx-overview-workflow/)
- [Blackmagic Design releases DaVinci Resolve 20.0 — CG Channel](https://www.cgchannel.com/2025/05/blackmagic-design-releases-davinci-resolve-20-0/)
- [Blackmagic Design DaVinci Resolve 20 Announced with 100 New Features — Newsshooter](https://www.newsshooter.com/2025/04/04/blackmagic-design-davinci-resolve-20-announced-with-100-new-features-including-ai-enhancements/)
- [Using the new Depth Map Feature in DaVinci Resolve 18 — Elements.tv](https://elements.tv/blog/using-the-new-depth-map-feature-in-davinci-resolve-18/)
- [How to Defocus Background in DaVinci Resolve — Hollyland Store](https://store.hollyland.com/blogs/creator-hub/defocus-background-in-davinci-resolve)
- [Fix Davinci Resolve Gamma / Color shift on iMac and Mac OS — Andrew Northover](https://www.andrewnorthover.com.au/blog/davinci-resolve-gamma-shift)
- [Avoiding Gamma Shift When Exporting from Resolve — Knut Erik Evensen](https://www.knuterikevensen.com/2021/06/22/avoiding-gamma-shift-when-exporting-from-resolve-17-2/)
- [Quicktime Gamma Shift Bug: What Is It and How to Combat It — CineD](https://www.cined.com/quicktime-gamma-shift-bug-what-is-it-and-how-to-combat-it/)
- [Monitoring — Data Levels "Full" or "Video"? — Blackmagic Forum](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=70650)
- [Tutorial: Legal and extended range in DaVinci Resolve — 709 Media Room](https://709mediaroom.com/en/tutorial-legal-and-extended-range-in-davinci-resolve/)
- [How to Export in DaVinci Resolve: Best Export Settings — Miracamp](https://www.miracamp.com/learn/davinci-resolve/export-settings)
- [Soft Clip Definition — DaVinci Resolve Explained — Tella](https://www.tella.com/definition/soft-clip)
- [Using Soft Clip Controls to Recover Highlights and Shadows — DVResolve.com](https://dvresolve.com/tutorial/using-soft-clip-controls-recover-highlights-shadows/)
- [Identifying the Input Color Space of Different Clips — DaVinci Resolve 18 Manual mirror](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part287.htm)
- [Proper node order for grain, NR, sharpening and 709 LUT — Blackmagic Forum](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=165668)
- [Why Noise Reduction Must Happen Before Color Grading In DaVinci Resolve — Tideon VFX](https://tideonvfx.com/why-noise-reduction-before-color-grading/)
