# Influences and How They Grade

This is the research base for BNC Grade: what working colourists actually do, in their own published tools, talks and writing, distilled into one reference and then turned into a single reusable pipeline. Dom shoots a Sony FX30 in S-Log3/S-Gamut3.Cine and a Fujifilm X-T5 for stills, and grades in DaVinci Resolve, Photoshop and After Effects — every example below is chosen with that kit in mind.

## What the best graders have in common

Across every colourist and educator below, the same handful of habits keep showing up, whether the job is a Netflix series or a 15-second reel.

1. **Normalise every camera into one working space, first.** A Color Space Transform (or Resolve's colour-managed timeline) converts each source's actual input colour space and gamma into DaVinci Wide Gamut / DaVinci Intermediate before anything creative happens, so a cinema camera, an iPhone and a GoPro can all sit under the same look. Gustavo Rossi's GR PowerGrade Pro is built this way — "colour-managed input means every camera lands on the same neutral base before the look goes on" — and Juan Melara's whole camera-to-Alexa product line exists to do the same job per manufacturer.
2. **Correction and look are two different jobs, done in that order.** Technical correction — white balance, exposure, matching shots to a neutral baseline — comes first and is objective; creative grading comes after and is subjective. Skip the first and the second only amplifies the problem.
3. **Looks are built as a pipeline, not one move.** Cullen Kelly's Contour tool enforces an explicit order — Curve, Split, Saturation, Split Saturation, Density, Hue — each stage building on the last rather than fighting it.
4. **Exposure and contrast are separated from colour and hue work.** Kelly is explicit that exposure and contrast aren't allowed once you're in "look development" — a look-development LUT should only ever move hue, because gamma and contrast were already decided in the primaries pass.
5. **They think subtractively, like film.** Saturating a colour and darkening it together — the way a redder apple reflects, and therefore absorbs, more light — reads as pigment density; pushing saturation up on its own reads as a digital boost. "Subtractive saturation" is taught widely enough (Kelly, Mixing Light) that it's closer to a shared professional habit than one person's trick.
6. **Windows and masks direct attention, not just fix problems.** Isolating a face, product or sky to brighten, cool or desaturate it independently is how a flat, single-layer image gets depth and a place for the eye to land — the explicit subject of Gustavo Rossi's "Power of Masking" content and any working colourist's power-windows habit.
7. **Skin is graded first.** Nearly every shot has it, viewers are extremely sensitive to it reading wrong, and getting it right — commonly checked against the vectorscope's skin-tone line — gives every other decision a stable anchor.
8. **Restraint beats polish.** Walter Volpatto grades mostly with printer-light-style offset moves plus "just a touch of saturation and contrast," and has spoken about how chasing a technically "perfect" grade can work against a film rather than for it.
9. **Blacks are never true zero.** Film's toe compresses shadow detail gently instead of clipping to nothing, and real analogue blacks carry almost no colour saturation — so digital grades lift the floor slightly and often tilt it cyan or green (film's habit) rather than leaving it at the blue a raw log image tends to sit at by default, without lifting so far it reads "milky."
10. **Everything is checked on scopes, then confirmed by eye.** Waveform, vectorscope and parade give an objective, un-adapting reference that human vision — which constantly self-adjusts to ambient light and whatever it just looked at — cannot supply on its own; a properly calibrated reference monitor is what confirms the read.
11. **They build the structure once and reuse it.** Darren Mostyn saves an empty, fully labelled node tree as a Gallery Still and starts every job from it; Walter Volpatto does the same with a structure he workshopped with fellow colourist Utzi; PowerGrades exist specifically so a colourist's *system*, not just one look, survives from project to project.
12. **The "look" lives in the prep, not the sensor.** Steve Yedlin's Display Prep Demo argues — and demonstrates, by applying one universal treatment across cameras without adjusting shot by shot — that a camera of sufficient quality is just a data-collection device; the perceived "look" is entirely a function of how that data is prepared afterward.
13. **They keep a mental (or literal) negative-to-print model, even starting from log.** A log image behaves like a scanned negative — flat, wide latitude, no baked-in style — and the actual "look" step is timing it as if toward a print stock's contrast curve and palette, which is why so many PowerGrade products (GR Cinema, Melara's print-film-emulation line) are built from *measured print-film response*, not guesswork.
14. **Colour contrast, not just brightness contrast, does a lot of the separating.** "Teal and orange" keeps reappearing not because it's a trend but because of physics: complementary hues sit at maximum contrast on the wheel, and because skin sits naturally in the orange range, cooling everything around a subject is a near-automatic way to separate them from the background.
15. **References are measured, not guessed.** Gustavo Rossi's v2 LUTs were built using 3D LUT Creator and Lattice against real Kodak Vision3 stock and real 2383 prints; Juan Melara profiled his own shot negative stock for FilmUnlimited; FilmConvert built its camera profiles from side-by-side test-chart shoots against 19 real stocks. Scanned, measured references beat eyeballed ones.

## Gustavo Rossi (@gustavorossiribeiro)

Gustavo Rossi is a Sydney-based colourist, videographer and photographer who works as a remote colourist and posts colour-grading education on Instagram as [@gustavorossiribeiro](https://www.instagram.com/gustavorossiribeiro/), alongside a storefront at gustavorossi.media selling his GR Color system. He's the influence Dom named directly, so this section sticks to what's actually documented about his products and public content rather than any single reel — Instagram itself isn't reachable from this research environment.

**GR PowerGrade Pro.** His flagship product is described as a node structure "built on the principles of a real-world film pipeline" — Rossi says he spent hundreds of hours studying why the photochemical film pipeline worked so reliably for decades and rebuilt that logic inside DaVinci Resolve. The system is deliberately two-tier: pre-built "preset" nodes for a fast result, and full surgical per-node control underneath for anyone who wants to build a look from scratch. It's native to Resolve and runs in both the free and Studio versions.

**Normalisation.** GR PowerGrade Pro's colour management is described as landing "every camera... on the same neutral base before the look goes on," explicitly including non-cinema, non-log, 8-bit sources like phone and GoPro footage, not just cinema cameras. That's Rossi's own product description rather than an independently audited claim, but it matches exactly how Melara's camera-match line and Resolve's own colour-managed timeline work — consistent with standard high-end practice, not a marketing invention.

**GR Cinema and Kodak 2383 LUTs.** For the v2 update of his film LUTs, Rossi says he invested in 3D LUT Creator and Lattice and sourced original Kodak Vision3 stock and 2383 prints, measuring the GR Cinema look and the 2383 emulation directly from that material rather than starting from someone else's LUT.

**AI Presets.** The Pro tier also ships "AI Presets" — quick per-shot starting styles — alongside the film-pipeline nodes and stock emulations, plus an included masterclass (reported variously as around two hours, and elsewhere as a much longer, dozens-of-chapters walkthrough, depending on the product edition) where Rossi talks through the system on screen.

**Masking, and range of subject matter.** His Instagram content includes a "Power of Masking in Color Grading" reel and, separately, food-grading and underwater colour-correction reels — evidence that his public teaching covers masking as its own topic, and that he grades well outside "cinematic drama," into product/food and underwater work. Beyond their titles and stated subject, the exact techniques shown in any single reel can't be confirmed from this environment.

**What to adopt:**
- Treat "structure, stocks and reasoning" — Rossi's own framing of what GR Color sells — as the actual goal: build one documented system you understand, not a look you copy.
- Normalise everything (FX30 log, X-T5 stills, any phone b-roll) into the same working space as the very first move, every time.
- Build, or buy and then dissect, a print-emulation layer measured from real film response, and treat it as a starting LUT/PowerGrade layer inside the tree — not a one-click final button.
- Give masking its own deliberate step in the pipeline. Rossi treats it as a whole topic, not an afterthought, and Dom's product- and food-adjacent motion work is exactly where that pays off.

## Cullen Kelly

LA-based senior colourist with credits across film, TV and commercials for Netflix, HBO, Hulu, Microsoft, McDonald's and Sephora, plus Academy Award-nominated work; also a full-time educator via YouTube, the podcast *The Color Code*, and Mixing Light tutorials.

- **Subtractive saturation.** Kelly teaches building a subtractive colour-balance tool by hand on Resolve's Color page: saturating a hue while dropping its luminance at the same time, mirroring how a more saturated real-world surface reflects — and therefore looks — darker. It avoids the slightly plastic look of pushing Resolve's default saturation slider alone.
- **Look development has rules.** In his "5 Levels of Look Development" talk (ResolveCon '24) and related writing, Kelly draws a hard line: exposure and contrast are decided in primaries and are *not allowed* back into look development — a look-development LUT should only shift hue.
- **Contour's build order.** His paid DCTL tool, Contour, packages this philosophy into an explicit sequence — **Curve → Split → Saturation → Split Saturation → Density → Hue** — each module building on the one before it, plus "preferential colour mapping": nudging skin, sky and foliage (the classic memory colours) toward their idealised versions rather than their literal captured hue.
- **Voyager LUT Pack.** A modular 17-LUT set for DaVinci Wide Gamut: foundation LUTs set overall tonality, modifier LUTs stack on top to bias shadows or highlights toward a colour — designed to be combined rather than used as one-shot finished looks, and only accurate inside a proper colour-managed pipeline.

**What to adopt:** Kelly's Contour order is close to a ready-made skeleton for BNC's own look layer (see the recipe below) — contrast/curve shape, then split tone, then overall saturation, then shadow/highlight-specific saturation, then subtractive density, then hue remapping, last. Keep exposure and contrast strictly out of that stage; they're finished before it starts. Apply preferential colour mapping consciously to skin, sky and foliage on every FX30 grade.

## Juan Melara

Australian colourist (juanmelara.com.au) best known for rebuilding classic print-film LUTs as fully editable, native Resolve PowerGrades rather than baked 3D LUTs.

- **Print film emulation (PFE) line.** Melara rebuilt Kodak 2383, Kodak 2393, and Fujifilm 3510, 3513DI and 3521XD as PowerGrades, in both standard DaVinci YRGB and Resolve-colour-managed/DaVinci Wide Gamut versions. Each ships in Standard, Middle Grey and Rec.709 curve variants, some with a zero-black-level (0BL) option, and an "original" versus a richer, more saturation-controlled "Finished" variant of 2383 specifically. He describes 2383 as "the gold standard of print film emulations, with natural skin tones and pleasing well balanced colours."
- **FilmUnlimited.** A separate PowerGrade collection emulating Kodak 5207 (250D) and Kodak 5219 (500T) negative stock, built from film Melara personally shot and profiled in November 2018 and January 2021, with accurate halation, grain and gate-weave emulation layered in (grain requires Resolve Studio).
- **Camera-to-Alexa matching.** His camera-match line — Canon2Alexa, Sony2Alexa, and camera-specific tools down to iPhone16Pro2Alexa — is built around one stated principle repeated across every product page: "the camera match transform... is where the Alexa look lives." The normalisation transform, not the final LUT, is the part doing the real work of making footage match.

**What to adopt:** Don't rely on one generic "film LUT" — the curve variant you pick (Standard/Middle Grey/Rec.709/0BL) has to match where it sits in your node tree, so build or buy print emulations with that flexibility. Put any camera-matching/normalisation transform at the very front of the tree, ahead of creative work — Melara's entire product architecture is built on that being where cross-camera consistency actually lives. When adding texture, model it from real, profiled film rather than a generic overlay.

## Waqas Qazi

Founder of Qazi & Co, described in his own marketing as the most-followed colourist online with 1M+ followers across platforms and 15 years working with clients including Prime Video, Universal Studios and Adidas.

- **Freelance Colorist Masterclass.** A 300+ lesson course covering both DaVinci Resolve technique and the business side of freelancing, built to take a beginner up from the ground, including a dedicated "grade 10x faster" module.
- **QazVerse.** His umbrella ecosystem — RapidGrade, a DCTL toolkit, LUTs, PowerGrades and courses — pitched as one consistent workflow rather than separate products.
- **Power windows, generally.** Qazi teaches power windows as a standard part of the Resolve toolkit: isolating and adjusting specific regions (brightening a subject, subduing a background) to add depth and direct attention. A specifically named "relight" module, or a product literally titled "Zero to Hero," could not be confirmed under Qazi's name in public sources — treat any such workflow as a general power-windows/relighting technique rather than a verified, uniquely-Qazi method.

**What to adopt:** Use power windows as a lighting tool, not just a fix-it tool — deliberately reshaping perceived depth (subject up, surrounds down) as a normal part of the creative pass. Build one documented, reusable toolkit so grading speed improves without cutting quality, the same logic behind RapidGrade.

## Darren Mostyn

Brighton (UK)-based colourist with 30+ years in broadcast, founder/senior colourist at Online Creative, a regular grader for the BBC, Amazon and Netflix, and a certified DaVinci Resolve trainer.

- **"My Perfect Node Tree."** At ResolveCon '24, Mostyn presented a fixed, empty node-tree template — no actual grades baked in, saved as a Resolve Gallery Still — built once with "the most common potential blank nodes you would use," then reused as the literal starting point on every job.
- He's also taught scope-reading directly ("How Professional Colorists Read Scopes"), pairing structural consistency with objective measurement rather than treating them as separate skills.

**What to adopt:** Build one blank, well-labelled BNC node-tree template — structure with no look baked in — save it as a Gallery Still/PowerGrade, and apply it as the first move on every project, so tree architecture is never a mid-grade decision.

## Walter Volpatto

Hollywood colourist (Company 3/EFILM lineage) whose credits include *Dunkirk*, *Star Wars: The Last Jedi*, *The Hateful Eight* and *Green Book*.

- **A fixed node structure, arrived at independently.** Volpatto developed and refined his own fixed node structure over years, discussed it with fellow colourist Utzi, and shared it publicly at a 2019 Los Angeles Colorist Meetup — the same "solve the structure once" idea Mostyn teaches, reached by a different working colourist on a different continent.
- **Printer lights first.** He grades mostly using log offset controls ("printer lights") plus "just a touch of saturation and contrast" — printer-light-style moves approximate what a lab's printer-light timing would have done to a negative, so the correction reads as exposure/white-balance, not a colour "fix."
- **Restraint over polish.** In a CineTalk interview titled "Why 'Perfect' Grading Ruins Movies," his stated position is that chasing a technically flawless grade can work against the film rather than for it.

**What to adopt:** Reach for offset/printer-light moves before saturation or contrast tools as the first correction. Build, and keep, a fixed node structure — the fact that two of the most credentialed working colourists in this document arrived at that habit independently is a strong signal it's genuinely best practice, not house style.

## Steve Yedlin, ASC

Cinematographer (*Knives Out*, *Star Wars: The Last Jedi*, *Brick*) rather than a colourist by trade, but his public teaching is some of the most cited material on how a film "look" is actually built.

- **The Display Prep Demo.** Over 10+ years, Yedlin empirically analysed film's response characteristics and built mathematical methods so digital cameras could coherently reproduce them — adding probability-based grain, halation, gate weave and tone-mapped colour rendition through 3D geometry, viewable in full-raster lossless files at yedlin.net.
- **The core argument.** Cameras of sufficient quality all capture enough data; what reads as a camera's inherent "look" comes from how that data is prepared for viewing, not the sensor. He advises treating a camera "merely as a data collection device." In the demo he deliberately did not adapt the preparation to individual shots — one universal treatment, to prove the point holds without per-shot rescue. (A widely shared line, "the look is not tied to the camera," is a paraphrase by an article author rather than a verbatim Yedlin quote, though it reflects his stated position accurately.)

**What to adopt:** Stop hunting for a "magic" camera setting or LUT — the FX30's S-Log3/S-Gamut3.Cine is enough data; the look is entirely what BNC does to it afterward. Build texture (grain, halation, weave) as a deliberate, modelled last stage rather than a random overlay. Test any BNC look across a range of shots before trusting it — if it needs per-shot rescue to read as filmic, the pipeline is the problem, not the footage.

## Dado Valentic

Award-winning colourist and colour scientist with 60+ features and hundreds of commercials to his name, credited with the colour science behind *Marco Polo* Season 2 — the first Netflix HDR production, awarded Best TV Picture at the 2016 ASC Awards — and founder/CEO of Colourlab Ai.

- **Colourlab Ai.** AI models trained on cinematic footage colour-match shots and suggest variations from a single graded reference clip, syncing an entire edited timeline or hours of dailies in seconds to minutes; it integrates with Resolve, Premiere and FCPX through a colour-metadata layer so matches apply without re-rendering.
- **AI assists, it doesn't replace.** By his own account, the AI generates a reference/starting look and he finishes the rest of the sequence by hand, as he always has.
- **"How to see" over workflow.** In interviews, Valentic frames the most valuable thing to teach as perceptual training — how to see — rather than a preset or fixed workflow, and describes his own practice moving from grading-as-technique toward researching perceptual models, film emulation and AI-assisted colour.

**What to adopt:** Use automated/AI matching (Resolve's own Color Match/Shot Match, or a dedicated tool) to get multi-clip consistency fast, then finish by hand — match first, grade second. Treat critical viewing and memory-colour perception as the actual skill under construction, with software only as the delivery mechanism.

## Alexis Van Hurkman & Daria Fissoun — the standard teaching lineage

Two authors, not a duo, but their books sit on the same shelf as the field's reference texts.

- **Van Hurkman's *Color Correction Handbook*** (Peachpit/Pearson) is a widely used general text covering the whole correction workflow: setup, primary contrast, primary colour, HSL qualification and hue curves, shapes/windows, animating grades, memory colours (skin, sky, foliage), and a dedicated shot-matching and scene-balancing chapter — codifying the "balance and match first, stylise after" order that recurs through every source in this document.
- **Fissoun's *Colorist Guide to DaVinci Resolve*** (versions 17 and 18) is Blackmagic Design's own official, free training text — around 400 pages of hands-on exercises. Fissoun is a London-based, CSI-certified colourist and Resolve trainer. Part I of the guide is explicitly structured around primary and secondary grading technique, balancing and matching media, *before* any creative look work begins — the Color page's own palette layout (Color Match/Color Wheels/Curves for primaries, then Qualifier/Window/Tracker/Magic Mask for secondaries) enforces the same order structurally.

**What to adopt:** Use the "memory colours" checklist — skin, sky, foliage — as a standing reality check on every grade; it's the same trio Kelly's preferential colour mapping targets. Follow the balance → primary → secondary → look order everywhere in this document, because it's also the order Blackmagic's own official training teaches.

## Film emulation, explained properly

**Negative vs print, in one paragraph.** A negative (camera) stock is designed to be flat, low-contrast and forgiving — huge exposure latitude, inverted tones and colours, meant to be printed or scanned rather than viewed directly. A print (release) stock is what that negative was historically printed onto photochemically, or what a digital "print film emulation" (PFE) LUT previews the response of. Contrast, saturation and colour bias — the actual "look" — get built in at the *print* stage, not the negative stage. A log image such as S-Log3 behaves like a scanned negative: flat, wide latitude, no baked-in style. Grading it is timing it toward a print stock's response, which is exactly why GR Cinema, Melara's PFE line and the Kodak 2383/2393 LUTs everyone reaches for are built from *print* stock, not negative stock.

**The contrast-curve anatomy.** Every stock's sensitometric curve has a toe (gentle shadow compression), a straight-line midtone section, and a shoulder (gentle highlight compression) — that toe and shoulder are why film never clips the way an unprocessed digital sensor does; tones fold gently instead of hitting a wall. Kodak 2383's toes are matched tightly across its three colour layers for neutral highlights on projection, with a raised D-max giving an improved on-screen black, and it's known for a soft, pleasing highlight rolloff. Kodak 2393 (Vision Premier) pushes further — roughly an 18-stop contrast ratio against 2383's 13, deeper and purer blacks, more saturation, about 0.1 higher print density — the "punchier" option of the two. Fuji's 3510/3513 prints sit lower in contrast than either Kodak option, with a softer rolloff, gentler colour separation, textured shadows and more neutral, slightly green-leaning blacks — a quieter alternative to Kodak's warmer richness; 3513 is a touch more contrasty than 3510, with Fuji's characteristic clean blues.

**Shadow colour: cyan/green, not blue.** Real analogue film carries almost no colour saturation in true blacks or true highlights, which is part of why desaturating deep shadow reads as "filmic" in a digital grade. Where a colour bias does show up in film shadow, it tends to sit on the cyan/green side — most visible in the Fuji print stocks — rather than the blue-black a raw, ungraded digital log image tends to default to. It's a small, high-leverage move: nudge shadows cyan/green instead of leaving them blue.

**Negative stocks and their palettes**, for reference: Vision3 50D (5203, daylight, ISO 50) — the family's finest grain, clean and crisp, for bright exteriors. Vision3 250D (5207, daylight, ISO 250) — the general-purpose daylight negative, excellent highlight latitude. Vision3 500T (5219, tungsten, ISO 500) — outstanding skin tones; Dye Layering Technology reduces shadow grain, Sub-Micron technology adds roughly two stops of highlight latitude — the interiors/low-light/night stock. Portra 400 — warm, muted, natural skin, medium contrast, built on Vision3 technology and "made to be edited," the most flexible still option. Portra 800 — warmer and more saturated/contrastier than 400, older-generation stock, more punch straight off the negative. Fuji Eterna, the cine negative (not the still simulation of the same name) — very flat, low contrast, low saturation with a cyan lean and lifted shadows, built as a grading starting point rather than a finished look.

**Texture.** *Halation* is light passing through the emulsion, reflecting off the film base or pressure plate, and re-exposing the emulsion from behind — a soft, often reddish-orange glow blooming from specular highlights and high-contrast edges (a bright window, a streetlamp at night); anti-halation backing on modern stocks suppresses it to varying degrees, so its visible strength is stock- and era-dependent. *Bloom* is a related but distinct, softer and more even glow from optical causes (lens flare/diffusion) rather than the emulsion's internal reflection. *Grain* is a physical texture from the film's silver-halide particles — random, organic, coarser on faster stock and in underexposed areas — as opposed to *digital noise*, which is electronic sensor interference that tends to look more uniform and chroma-noisy in shadow; modern tools model grain probabilistically per stock and exposure zone rather than overlaying a fixed texture. *Gate weave* is the mechanical micro-wobble of film moving through a camera or projector gate frame by frame — invisible once a scan is stabilised, but sometimes reintroduced deliberately (a little random X/Y translation plus slight rotation) to keep an otherwise too-static digital image from feeling sterile.

**Tools, briefly:**
- **Resolve Film Look Creator** (built into Resolve 19, core tool ships free) — one ResolveFX combining halo/overlight, grain, flicker, gate weave and vignette, with Kodak/Fuji-inspired presets, a master Color Blend fade and swappable "Core Looks" (primaries sets) as its headline controls.
- **Dehancer** (OFX plugin suite) — the most complete standalone system: 60+ film profiles, a dedicated print-film stage, physically modelled grain (8/16/35/65mm plus custom), 8 halation profiles, bloom, film damage/overscan and a LUT generator, built to sit inside DWG/ACES/Cineon pipelines.
- **FilmConvert Nitrate** — starts from a camera-specific profile, built by shooting test charts on each supported camera and comparing against 19 real stocks shot on the same charts, so the same "stock" preset is tuned differently per source camera; grain is modelled per exposure/colour zone.
- **Filmbox** (Video Village) — models "the holistic reproduction of photochemical motion picture imaging": colour rendering, halation, grain and gate weave together, switchable film format (8/16/35/VistaVision/65mm), and a switch between a contact-printed-negative look and a telecine-transfer look.

| Stock | Type | Palette | Contrast | Best for |
|---|---|---|---|---|
| Kodak 2383 | Print | Warm, rich colour, soft highlight rolloff | High-ish; ~13-stop range, gentle shoulder | General-purpose "classic" cinematic finish |
| Kodak 2393 (Vision Premier) | Print | Cleaner, more saturated, deeper blacks | Higher; ~18-stop range | Punchier, high-end DI-style masters |
| Fuji 3510 | Print | Natural skin, green-leaning neutrals, quiet | Low/normal, soft rolloff | Naturalistic drama, dialogue, documentary |
| Fuji 3513 | Print | Slightly richer than 3510, clean blues | Just above 3510 | Same uses as 3510, with a touch more punch |
| Vision3 50D (5203) | Negative | Clean, accurate, very fine grain | Low (flat negative), wide latitude | Bright daylight exteriors |
| Vision3 250D (5207) | Negative | Natural daylight palette | Low (flat negative), excellent highlight latitude | General daylight base |
| Vision3 500T (5219) | Negative | Outstanding skin tones, tungsten-balanced | Low (flat negative), extended highlight latitude | Interiors, night, low light |
| Portra 400 | Negative (still) | Warm, muted, natural skin | Medium | Flexible daylight base — a good X-T5 anchor |
| Portra 800 | Negative (still) | Warmer, more saturated than 400 | Medium–high | Low-light stills, more punch |
| Fuji Eterna (cine) | Negative/sim | Flat, cyan-leaning, low saturation | Very low | Grading starting point, not a finish |

## Stills-specific influences: the Fujifilm X-T5 palette

Fujifilm's in-camera Film Simulations are the digital descendants of Fuji's actual stock line, and because Dom shoots the X-T5 alongside the FX30, they're a ready-made, camera-native palette reference for steering video grades.

| Simulation | Character |
|---|---|
| Provia (Standard) | Faithful and neutral — true blues, natural greens, neutral skin; the un-styled baseline every other simulation is judged against |
| Velvia | High contrast and saturation, built for landscapes; can push skin warm/orange and clip highlights and shadows together in contrasty scenes |
| Astia | Softer than Velvia, gentler contrast, highlights resist blowing out, skin renders flatteringly — a strong portrait default |
| Classic Chrome | Muted and desaturated, Kodachrome/Ektachrome-inspired; the base for the majority of Fuji X Weekly's most popular recipes |
| Classic Negative | Harder tonality and higher saturation than Classic Chrome, warm highlights, cool shadows; Superia-negative inspired — more punch, still filmic |
| Nostalgic Neg | Warm amber highlights, a magenta cast through the midtones, gently lifted shadows; inspired by 1970s "New Color" photography (Eggleston, Shore, Sternfeld) |
| Eterna | Very flat, low contrast and saturation, a cyan-leaning shift, lifted shadows; a cinema simulation built as a grading start point, not a finished still look |
| Eterna Bleach Bypass | High contrast, the lowest saturation of any colour simulation, gritty and almost metallic; a digital take on skip-bleach film processing |
| Reala Ace | Added to the X-T5 by firmware in 2024: natural colour, moderate contrast, harder highlights and softer shadows than Provia; based on Fuji's Reala 100 negative |
| Acros | Black-and-white: smooth gradation, deep blacks, pleasing highlight rolloff, algorithmic grain linked to ISO and exposure |

**The recipe culture.** A "film simulation recipe," in Fuji X Weekly founder Ritchie Roesch's usage, is simply a documented set of in-camera JPEG parameters — white balance shift, highlight/shadow tone, colour, sharpness, grain effect, clarity — layered onto a base simulation to reproduce a specific stock's feel straight out of camera. Fuji X Weekly now hosts 400+ such recipes (the free app carries 100+), most at least loosely inspired by real film stocks (Kodachrome, Portra, Tri-X, Superia and more), and Classic Chrome is the base for more of the most-viewed recipes than any other simulation. The culture is explicitly built on remixing shared formulas rather than guarding secret settings.

**Matching FX30 footage to X-T5 stills.** This is a synthesis of the principles above, not a single person's published method for this exact camera pair — treat it as a starting process to test, not a proven recipe. Pick a target simulation (or a specific Fuji X Weekly recipe) as the project's reference palette. Because the X-T5 bakes its simulation into a JPEG while the FX30 shoots flat log, they can't be matched with one universal LUT: normalise the FX30's S-Log3/S-Gamut3.Cine into the working space first (principle 1, above), then shoot a grey card and a face in the same light on both cameras and read where the X-T5 JPEG's skin, sky and foliage land on the vectorscope and waveform against the ungraded FX30 plate. Push the FX30 grade's hue curves, split tone and density until those three memory-colour references land in the same scope positions as the X-T5 JPEG — effectively treating the X-T5 simulation as the "print" target and the FX30 log plate as the "negative" being timed to match it, the same negative-to-print logic covered above. Ready-made cross-camera LUT packs exist — one found in research was built matching Sony S-Log2/S-Gamut3.cine, shot on an A6300, against Fujifilm X-T3 simulations — useful as a rough proof of concept to check against, but not a guaranteed match for the FX30's S-Log3 or the X-T5's newer sensor, so verify by eye and scope rather than trusting it outright. Finally, document the matched FX30 grade as its own reusable PowerGrade — the video-side equivalent of a Fuji recipe.

## The BNC look-building recipe

A synthesis of everything above, as one pipeline. Each step is its own node group so nothing gets remixed back together.

1. **Normalise.** Color Space Transform every source — FX30 S-Log3/S-Gamut3.Cine, X-T5 stills or log, any phone/GoPro b-roll — into DaVinci Wide Gamut + DaVinci Intermediate at node one. *Why:* the whole point of principle 1 above, and the explicit architecture behind GR PowerGrade Pro and Melara's camera-match line — one look only works everywhere if everything starts from the same neutral base.
2. **Balance.** White balance, exposure and a shot-matching pass to a neutral target, before any styling. Check skin against the vectorscope's skin-tone line here. *Why:* Van Hurkman's Handbook, Fissoun's official Resolve guide and standard order-of-operations teaching all put this first and keep it separate from styling; Kelly's rules explicitly forbid revisiting exposure/contrast later.
3. **Primaries.** Contrast and pivot shaping — the technical/creative contrast curve, not yet the look's colour — plus lift/gamma/gain balance. *Why:* this is the primaries stage in every teaching source here, and Kelly's "dial in the contrast curve" step of look development, done before any hue work starts.
4. **Secondaries / masks.** Power windows and qualifiers — skin lifted, background subdued, sky or product isolated as needed. *Why:* Qazi's power-windows teaching and Rossi's "Power of Masking" content both treat this as a distinct step for directing the eye, separate from any global move.
5. **Look layer**, built as its own sub-chain, closely following Kelly's Contour build order:
   - **Palette** — split tone and hue shifts: warm/cool bias in shadows vs highlights, preferential colour mapping on skin, sky and foliage.
   - **Subtractive saturation / density** — saturate while dropping luminance together, so colour reads as pigment density rather than a digital boost.
   - **Highlight rolloff** — a soft shoulder (rolling/soft-clip contrast) instead of a hard clip, echoing the print stocks' shoulder behaviour above.
   - **Black point** — lifted slightly off true zero, tilted cyan/green rather than left at digital's default blue-black, stopping well short of "milky."

   *Why this order:* contrast is finished in step 3 and colour is a look-layer job — they're never remixed back into one node, matching both Kelly's proven module order and the negative-to-print logic above.
6. **Texture** (optional). Grain matched to the target format/ISO, halation on specular highlights only, a whisper of gate weave if it's genuinely needed — via Resolve's Film Look Creator for a fast pass, or Dehancer/Filmbox/FilmConvert Nitrate for a modelled one. *Why:* every emulation tool above, and Yedlin's demo, treat texture as a deliberately modelled last stage, not a random overlay — it goes last so nothing upstream re-grades it.
7. **Output transform.** Color Space Transform out of DaVinci Wide Gamut to the actual delivery space (Rec.709, P3, etc.) as the final node, so everything above stays in the wide working space until the last possible step.

**How this maps onto the BNC LUT pack.** The pack delivers the look layer as
display-referred `.cube` files (Rec.709 in, Rec.709 out), so in a LUT
pipeline the order is: balance and primaries in log → secondaries → base
LUT (the display transform) → look LUT → texture (see Tree 1 in
`05-resolve-workflow-fx30.md`). If you build a look by hand in a
colour-managed timeline, build it in DaVinci Wide Gamut / Intermediate before
the output transform exactly as described above. The recipes in
`08-lookbook.md` list every move in each look so you can do either.

**Numbers to check on scopes:**
- Vectorscope — skin sits on or near the skin-tone line (~11 o'clock, between R and YI) unless a deliberate lighting choice pulls it off.
- Waveform — the black point is lifted slightly off 0%, never pinned to true zero and never lifted so far it reads milky.
- Waveform — highlights roll off before hard 100%: a soft curve into the ceiling, not a flat clipped line.
- Vectorscope — the overall saturation trace stays inside the gamut graticule at delivery; nothing pegged at the edge.
- Parade (RGB) — shadows read as one intentional, even tint (the chosen cyan/green or split-tone bias), not an uneven, accidental cast between channels.

## Sources

**Gustavo Rossi**
- [GR Color · Color Grading System for DaVinci Resolve](https://gustavorossi.media/)
- [Gustavo Rossi (@gustavorossiribeiro) — Instagram](https://www.instagram.com/gustavorossiribeiro/)
- [GR PowerGrade Pro — Gustavo Rossi (Gumroad)](https://gustavorossimedia.gumroad.com/l/powergrade)
- [GR Film LUTs v2 — Gustavo Rossi (Gumroad)](https://gustavorossimedia.gumroad.com/l/filmluts)
- [Film LUTs and PowerGrade by Gustavo Rossi — memoja.co](https://memoja.co/downloads/film-luts-and-powergrade-by-gustavo-rossi/)
- [Gustavo Rossi storefront](https://store.gustavorossi.media/)
- ["Power of Masking in Color Grading" reel — Instagram](https://www.instagram.com/gustavorossiribeiro/reel/C_y2Vj1txgo/)
- ["Food Grading Edition" reel — Instagram](https://www.instagram.com/gustavorossiribeiro/reel/C80Qoo8Sx3Q/)
- ["Underwater Color Correction" reel — Instagram](https://www.instagram.com/gustavorossiribeiro/reel/C8HMto1yCvW/)

**Cullen Kelly**
- [Cullen Kelly Color](https://cullenkellycolor.com/)
- [Contour — Cullen Kelly Color](https://cullenkellycolor.com/contour)
- [Toolkit — Cullen Kelly Color](https://cullenkellycolor.com/toolkit/all)
- [Visual Math: Building a Subtractive Saturation Node Tree in DaVinci Resolve — Mixing Light](https://mixinglight.com/color-grading-tutorials/visual-math-building-a-subtractive-saturation-node-tree-in-davinci-resolve/)
- [Upgrade Your Toolkit Part 3: Subtractive Color — Mixing Light](https://mixinglight.com/color-grading-tutorials/upgrade-toolkit-part-3-subtractive-color/)
- [Look Development Part 2: Dialing In The Contrast Curve — Mixing Light](https://mixinglight.com/color-grading-tutorials/look-development-part-2-dialing-in-the-contrast-curve/)
- [Look Development Part 3: Sweetening The Color Palette — Mixing Light](https://mixinglight.com/color-grading-tutorials/look-development-part-3-sweetening-the-color-palette/)
- [Cullen Kelly: Exposure & Contrast Not Allowed In Look Development — The Daejeon Chronicles](https://daejeonchronicles.com/2024/09/08/exposure-contrast-not-allowed-in-look-development/)
- [How To Work With Cullen Kelly's LUTs in DaVinci Resolve Studio 19 — The Daejeon Chronicles](https://daejeonchronicles.com/2024/06/24/how-to-work-with-cullen-kellys-luts-in-davinci-resolve-studio-19/)
- [5 Levels of Look Development in Color Grading — Cullen Kelly, ResolveCon '24 (YouTube)](https://www.youtube.com/watch?v=R0CP-LcG36A)
- [12.6 Voyager LUT Pack — procolor.ist](https://procolor.ist/voyager-lut-pack/)
- [CONTOUR: Great Looks For DaVinci Resolve — gfxplugin.com](https://blog.gfxplugin.com/post/contour/)
- [How a Pro Colorist Maximizes Color Separation — Frame.io Insider](https://blog.frame.io/2024/10/21/how-a-pro-colorist-maximizes-color-separation/)

**Juan Melara**
- [Juan Melara — official site](https://juanmelara.com.au/)
- [Print Film Emulation in 2021 — Juan Melara](https://juanmelara.com.au/blog/print-film-emulation-luts-for-download)
- [Kodak 2383 PowerGrade — Juan Melara](https://juanmelara.com.au/products/kodak-2383-powergrade)
- [Kodak 2393 PowerGrade — Juan Melara](https://juanmelara.com.au/products/kodak-2393-powergrade)
- [Canon2Alexa Usage Instructions — Juan Melara](https://juanmelara.com.au/canon2alexa-usage-instructions)
- [Sony2Alexa Usage Instructions — Juan Melara](https://juanmelara.com.au/sony2alexa-usage-instructions)
- [X-H2SFuji2Alexa Usage Instructions — Juan Melara](https://juanmelara.com.au/x-h2sfuji2alexa-usage-instructions)
- [Juan Melara FilmUnlimited PowerGrades — memoja.co](https://memoja.co/downloads/juan-melara-filmunlimited-powergrades/)

**Waqas Qazi**
- [Waqas Qazi — official site](https://www.waqasqazi.com/)
- [QazVerse — Qazi's Grading Ecosystem for DaVinci Resolve](https://www.qazverse.com/)
- [Freelance Colorist Masterclass](https://www.freelancecoloristmasterclass.com/)
- [5 Easy Techniques for Better Color Grading — Qazi & Co](https://waqasqazi.com/blog/5-easy-techniques-for-better-color-grading)
- [Qazi's Toolkit — DaVinci Resolve DCTL Tools](https://www.qazistoolkit.com/)
- [Waqas Qazi – The Freelance Colorist Masterclass Review — Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/cool-videos-films-projects-creative-work/waqas-qazi-the-freelance-colorist-masterclass-review/)

**Darren Mostyn**
- [My Perfect Node Tree for Color Grading — Darren Mostyn, ResolveCon '24 (YouTube)](https://www.youtube.com/watch?v=wvPkoL8nx-I)
- [Darren Mostyn — iColorist / The International Colorist Academy](https://icolorist.com/tag/darren-mostyn/)
- [OmniScope Featured Artist: Darren Mostyn — timeinpixels.com](https://timeinpixels.com/blog/featured-artist-darren-mostyn)
- [How Professional Colorists Read Scopes featuring Darren Mostyn (YouTube)](https://www.youtube.com/watch?v=vt1T9h_vAqY)
- [Introducing our jury member: Darren Mostyn — Dehancer Blog](https://blog.dehancer.com/2026/02/09/introducing-our-jury-member-darren-mostyn-3/)

**Walter Volpatto**
- [Walter Volpatto — Wikipedia](https://en.wikipedia.org/wiki/Walter_Volpatto)
- [The Master - Color grading by Walter Volpatto — Lowepost](https://lowepost.com/casestudies/the-master-r13/)
- [Feature Film Colour Grading with Colorist Walter Volpatto — Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/cool-videos-films-projects-creative-work/feature-film-colour-grading-with-colorist-walter-volpatto/)
- [Walter Volpatto Talks Node Structure — The Daejeon Chronicles](https://daejeonchronicles.com/2021/09/06/walter-volpatto-talks-resolve-node-structure/)
- [Why "Perfect" Grading Ruins Movies | CineTalk with Walter Volpatto (YouTube)](https://www.youtube.com/watch?v=PcFUgVjswxE)
- [How The Last Jedi & Dunkirk's Colorist Subtly Manipulated Your Feelings — The Credits](https://www.motionpictures.org/2018/03/last-jedi-dunkirks-colorist-subtly-manipulated-feelings/)

**Steve Yedlin, ASC**
- [Display Prep Demo — Steve Yedlin, ASC](https://www.yedlin.net/DisplayPrepDemo/)
- [Display Prep Demo FAQ — yedlin.net](https://yedlin.net/NerdyFilmTechStuff/DispPrepDemoFAQ/index.html)
- [Emulating Film Aesthetics: Steve Yedlin — Martin R. McGowan, Medium](https://martinrmcgowan.medium.com/emulating-film-aesthetics-9de6b7b503d6)
- [Is the secret of emulating film all in the display prep? — RedShark News](https://www.redsharknews.com/production/item/3184-is-the-secret-of-emulating-film-all-in-the-display-prep)
- [DP Steve Yedlin Blows the Lid Off Camera Resolution Myths — No Film School](https://nofilmschool.com/2017/08/yedlin-camera-resolution-myths)
- [Blackmagic Forum: Steve Yedlin Film Look Isn't Camera Related](https://forum.blackmagicdesign.com/viewtopic.php?t=107181&p=593054)

**Dado Valentic**
- [Colourlab Ai Emerges to Revolutionize Post Production](https://colourlab.ai/colourlab-ai-emerges-to-revolutionize-post-production/)
- [Colourlab – AI-assisted Color Grading: An Interview with Dado Valentic — Larry Jordan](https://larryjordan.com/articles/colourlab-ai-assisted-color-grading-an-interview-with-dado-valentic/)
- [Colorist Podcast EP 022: Dado Valentic — Mixing Light](https://mixinglight.com/color-grading-tutorials/colorist-podcast-ep-022-dado-valentic/)
- [About Dado Valentic — Color Grading Academy](https://www.colorgradingacademy.com/about)
- [Interview with Dado Valentic: inside the mind of a colorist — pix.online](https://pix.online/news/Interview-with-Dado-Valentic-inside-the-mind-of-a-colorist)
- [Color Grading in the Age of AI: A Conversation with Dado Valentic — podcast.jasonbowdach.com](https://podcast.jasonbowdach.com/color-grading-in-the-age-of-ai-a-conversation-with-dado-valentic/)

**Alexis Van Hurkman & Daria Fissoun / Blackmagic training**
- [Color Correction Handbook — Alexis Van Hurkman (Amazon)](https://www.amazon.com/Color-Correction-Handbook-Professional-Techniques/dp/0321929667)
- [Color Correction Handbook sample pages — Pearson](https://ptgmedia.pearsoncmg.com/images/9780321929662/samplepages/0321929667.pdf)
- [The Colorist Guide to DaVinci Resolve 18 — Blackmagic Design (PDF)](https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-18-Colorist-Guide.pdf)
- [The Colorist Guide to DaVinci Resolve 18 Released — CineD](https://www.cined.com/the-colorist-guide-to-davinci-resolve-18-released-free-400-page-educational-resource/)
- [Daria Fissoun — LinkedIn](https://uk.linkedin.com/in/daria-fissoun-5862864b)
- [From Training to AI Upscaling: A Cup with Colorist & Trainer Daria Fissoun — podcast.jasonbowdach.com](https://podcast.jasonbowdach.com/from-training-to-ai-upscaling-a-cup-with-colorist-trainer-daria-fissoun/)
- [The Colorist Guide - DaVinci Resolve 18 (palette/chapter structure) — Quizlet](https://quizlet.com/796111444/the-colorist-guide-davinci-resolve-18-flash-cards/)

**Film stocks**
- [KODAK VISION Color Print Film 2383/3383 — Kodak](https://www.kodak.com/en/motion/product/post/print-films/vision-color-2383-3383/)
- [KODAK VISION Color Print Film 2383/3383 data sheet — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/KODAK-VISION-Color-Print-Film-2383-3383-data-sheet.pdf)
- [Kodak 2383 LUT: A Guide to Cinematic Color Grading — Preset Curator](https://presetcurator.com/kodak-2383-lut/)
- [KODAK VISION Premier Color Print Film 2393 — cinematography.net (PDF)](https://www.cinematography.net/Files/VISPREM.PDF)
- [KODAK VISION3 500T Color Negative Film 5219/7219 — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/VISION3_5219_7219_Technical-data.pdf)
- [VISION3 500T Color Negative Film 5219/7219 — Kodak](https://www.kodak.com/en/motion/product/camera-films/500t-5219-7219/)
- [KODAK VISION3 250D Color Negative Film 5207/7207 Technical Data — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/VISION3-250D-Technical-Data-EN.pdf)
- [KODAK VISION3 50D Color Negative Film 5203/7203 Technical Data — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/VISION3_50D_5203_TI-2657_Technical-Data_EN.pdf)
- [Kodak Portra 400: A Classic For a Reason — Shoot It With Film](https://shootitwithfilm.com/kodak-portra-400-a-classic-for-a-reason/)
- [Kodak Portra 400 vs Portra 800: Differences and Authentic Emulations — PICTS Lab](https://www.pictslab.com/blog/kodak-portra-400-vs-portra-800)
- [Anyone know about Print film Fuji F-cp 3510? — Photrio forum](https://www.photrio.com/forum/threads/anyone-know-about-print-film-fuji-f-cp-3510.141110/)
- [Fuji Eterna Inspired Film Emulation Workflow — Seto Shop](https://seto.studio/blog/film-emulation-fuji-eterna-look)

**Halation, grain, gate weave, texture tools**
- [Chasing the Glow: Understanding Halation — CineD](https://www.cined.com/chasing-the-glow-understanding-halation-and-why-filmmakers-keep-coming-back-to-it/)
- [Film Emulation Part 2: Halation — Color Finale Blog](https://colorfinale.com/blog/post/cf-halation-11-24)
- [Gate weave — Dehancer Learn](https://www.dehancer.com/learn/article/gate-weave)
- [Film Grain vs. Digital Noise: What's the Difference? — anissadphotography.com](https://anissadphotography.com/film-grain-vs-digital-noise-differences/)
- [What's in Resolve's New Film Look Creator Plugin? — Frame.io Insider](https://blog.frame.io/2024/08/15/what-is-resolves-new-film-look-creator-plugin/)
- [Slider-by-Slider: Using Resolve's New Film Look Creator — Mixing Light](https://mixinglight.com/color-grading-tutorials/film-look-creator-resolvefx-overview-workflow/)
- [Dehancer — Features](https://www.dehancer.com/features)
- [Dehancer Pro for DaVinci Resolve](https://www.dehancer.com/shop/davinci_resolve/pro)
- [Review: Dehancer Film Emulation Plugin — ProVideo Coalition](https://www.provideocoalition.com/review-dehancer-film-emulation-plugin/)
- [FilmConvert Nitrate — official product page](https://www.filmconvert.com/nitrate)
- [Review: FilmConvert Nitrate for film stock emulation — postPerspective](https://postperspective.com/review-filmconvert-nitrate-for-film-stock-emulation/)
- [Understanding FilmConvert's New Nitrate Colour Grading Plugin — Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/understanding-filmconverts-new-nitrate-colour-grading-plugin/)
- [Video Village (Filmbox)](https://videovillage.com/)
- [Film Print Emulation Part 4: A Deep Dive Into Filmbox — Mixing Light](https://mixinglight.com/color-grading-tutorials/fpe-part-4-filmbox-ml1143/)
- [Review: Video Village's Filmbox Pro — postPerspective](https://postperspective.com/review-video-villages-filmbox-pro-film-emulation-ofx-plugin/)
- [Film Emulation Part 1: Subtractive Grading — Color Finale Blog](https://colorfinale.com/blog/post/cf-subtractive-grading-10-24)

**Teal/orange, split tone, skin, scopes, contrast**
- [What is the 'Orange & Teal Look' and Why is it So Popular? — PetaPixel](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/)
- [What is the Teal-Orange Look? — Beverly Boy Productions](https://beverlyboy.com/filmmaking/what-is-teal-orange-look/)
- [What is Split Toning and How to Use it in Lightroom? — Northlandscapes](https://www.northlandscapes.com/articles/what-is-split-toning-and-how-to-use-it-in-lightroom)
- [The Secrets You Need to Know About Color Grading Skin Tones — No Film School](https://nofilmschool.com/color-grading-skin-tone-secrets)
- [The Skin Tone Line — Pixel Valley Studio](https://pixelvalleystudio.com/pmf-articles/the-skin-tone-line)
- [What is Mid-Grey? And the importance of 18% Midtone Grey — CubieColor](https://www.cubiecolor.com/post/what-is-mid-grey-and-the-importance-of-18-midtone-grey-in-color-grading)
- [What Is Contrast Ratio and How Does It Affect Color Grading? — Frame.io Insider](https://blog.frame.io/2023/07/24/how-professional-colorists-look-at-image-contrast-ratio/)
- [How to Read Scopes in Color Grading — cinapex](https://cinapex.pro/how-to-read-scopes-in-color-grading-complete-guide/)
- [Understanding Video Scopes: Waveform and Vectorscope — Studio Supplies](https://studio-supplies.com/blogs/guides/understanding-video-scopes-waveform-vectorscope)
- [The Best Order Of Operations For Color Grading — Noam Kroll](https://noamkroll.com/the-best-order-of-operations-for-color-grading-why-it-makes-all-the-difference/)
- [Why The "Milky Black" Look Is Overused — Noam Kroll](https://noamkroll.com/why-the-milky-black-look-is-now-the-most-overused-technique-in-amateur-cinematography/)

**DaVinci Resolve colour management / normalisation / PowerGrades**
- [How to Color Manage using Nodes in DaVinci Resolve — Frame.io Insider](https://blog.frame.io/2024/01/08/color-management-nodes-davinci-resolve/)
- [Color Management in DaVinci Resolve — MONONODES](https://mononodes.com/color-management-in-davinci-resolve/)
- [DaVinci Resolve Color Management: RCM vs CST & LUT Order](https://davinciresolveclub.com/davinci-resolve-color-management-rcm-cst/)
- [DaVinci Wide Gamut and DaVinci Intermediate — cinapex](https://cinapex.pro/davinci-wide-gamut-intermediate-workflow/)
- [Resolve Color Management vs ACES — Frame.io Insider](https://blog.frame.io/2024/02/12/davinci-resolve-color-management-vs-aces-which-should-you-choose/)
- [Smartphone Meets Cinema Camera: Mastering the Mix — aaapresets.com](https://aaapresets.com/blogs/davinci-resolve-color-grading-gradient-tutorials/smartphone-meets-cinema-camera-mastering-the-mix-for-stunning-visuals-in-2025)
- [How to Use PowerGrades — MONONODES](https://mononodes.com/how-to-use-powergrades/)
- [PowerGrades in DaVinci Resolve: Complete Guide — PixelTools](https://pixeltoolspost.com/blogs/resolve/powergrades)

**Fujifilm stills simulations and recipe culture**
- [Fujifilm Classic Chrome Film Simulation Recipes — Fuji X Weekly](https://fujixweekly.com/2019/01/06/fujifilm-classic-chrome-film-simulation-recipes/)
- [The Best Fujifilm Recipe for Each Film Simulation — Fuji X Weekly](https://fujixweekly.com/2026/04/16/the-best-fujifilm-recipe-for-each-film-simulation/)
- [NOSTALGIC Neg. — Fujifilm X Series & GFX](https://www.fujifilm-x.com/global/products/film-simulation/nostalgic-neg/)
- [Nostalgic Negative makes your photos feel like memories — Fuji X Weekly](https://fujixweekly.com/2025/09/11/nostalgic-negative-makes-your-photos-feel-like-memories/)
- [Fujifilm Classic Neg: A Digital Film Simulation Review — FujiLove Magazine](https://fujilove.com/fujifilm-classic-neg-a-digital-film-simulation-review/)
- [The Classic Negative Film Simulation on the Fujifilm X-T5 — jamiechancetravels.com](https://jamiechancetravels.com/blog/the-classic-negative-film-simulation-on-the-fujifilm-x-t5/)
- [Why You Should Use ETERNA for Movies — Fujifilm X Series & GFX](https://www.fujifilm-x.com/en-gb/learning-centre/why-you-should-use-eterna-for-movies/)
- [Fujifilm Velvia vs. Astia: How to Choose the Right Film Simulation — jmpeltier.com](https://www.jmpeltier.com/fujifilm-velvia-vs-astia/)
- [Fujifilm Film Simulation Comparisons: More Than A Gimmick — jmpeltier.com](https://www.jmpeltier.com/fujifilm-film-simulation-differences/)
- [Fujifilm Brings Reala Ace Film Simulation to Four More Cameras — PetaPixel](https://petapixel.com/2024/06/27/fujifilm-brings-reala-ace-film-simulation-to-four-more-cameras/)
- [Reala Ace Film Simulation Deep Dive — X-Alchemy](https://x-alchemy.app/academy/reala-ace-deep-dive)
- [ETERNA Bleach Bypass — Fujifilm X Series & GFX](https://www.fujifilm-x.com/en-us/products/film-simulation/eterna-bleach-bypass/)
- [A Look at Fujifilm's ETERNA Bleach Bypass Film Simulation — Dan Bailey](https://danbaileyphoto.com/blog/a-look-at-fujifilms-eterna-bleach-bypass-film-simulation/)
- [How to Create Film Simulation Recipes — Fuji X Weekly](https://fujixweekly.com/2023/12/21/how-to-create-film-simulation-recipes/)
- [Film Simulation Recipes — Fuji X Weekly](https://fujixweekly.com/recipes/)
- [25 Most Popular Film Simulation Recipes of 2025 (So Far) — Fuji X Weekly](https://fujixweekly.com/2025/06/30/25-most-popular-film-simulation-recipes-of-2025-so-far/)

**Sony/Fuji cross-camera matching**
- [Fujifilm Film Simulation LUTs for Sony S-Log2/S-Gamut3.cine — DPReview Forums](https://www.dpreview.com/forums/threads/fujifilm-film-simulation-luts-for-sony-s-log2-s-gamut3-cine.4437018/)
- [Can you get Fuji colors on Sony? — veresdenialex.com](https://www.veresdenialex.com/post/can-you-get-fuji-colors-on-sony)
