# Influences and How They Grade

This is the research base for BNC Grade: how the working colourists Dom looks up to actually build a look, drawn from their own tools, talks and writing, turned into one reusable pipeline. Dom shoots a Sony FX30 in S-Log3/S-Gamut3.Cine and a Fujifilm X-T5 for stills, and grades in DaVinci Resolve, Photoshop and After Effects — every example below is chosen with that kit in mind.

## What the best graders have in common

The same handful of habits recur across every colourist below, on jobs from a Netflix series to a 15-second reel.

1. **Normalise every camera into one working space, first.** A Color Space Transform (or Resolve's colour-managed timeline) puts each source into DaVinci Wide Gamut/Intermediate before any creative move, so a cinema camera, an iPhone and a GoPro sit under one look. GR PowerGrade Pro is built this way — "every camera lands on the same neutral base before the look goes on" — and Juan Melara's camera-to-Alexa line does the same job per manufacturer.
2. **Correction and look are separate jobs, in that order.** Technical correction — white balance, exposure, matching shots to neutral — is objective and comes first; creative grading is subjective and comes after. Skip the first and the second only amplifies the problem.
3. **Looks are a pipeline, not one move.** Cullen Kelly's Contour tool enforces an explicit order — Curve, Split, Saturation, Split Saturation, Density, Hue — each stage building on the last.
4. **Exposure and contrast stay out of the look stage.** Kelly is explicit: once you're in look development, exposure and contrast are off-limits — a look LUT should only shift hue, because gamma and contrast were already decided in primaries.
5. **They think subtractively, like film.** Saturating a colour while darkening it together — as a more saturated real-world surface reflects, and so looks, darker — reads as pigment density rather than a digital boost; it's taught widely enough (Kelly, Mixing Light) to count as shared practice, not one person's trick.
6. **Windows and masks direct attention, not just fix problems.** Isolating a face, product or sky to grade independently is how a flat image gets depth — the explicit subject of Gustavo Rossi's "Power of Masking" content and any working colourist's power-windows habit.
7. **Skin is graded first.** Nearly every shot has it and viewers are highly sensitive to it reading wrong; checking it against the vectorscope's skin-tone line anchors every other decision.
8. **Restraint beats polish.** Walter Volpatto grades mostly with printer-light offset moves plus "just a touch of saturation and contrast," and has spoken about a technically "perfect" grade working against a film rather than for it.
9. **Blacks are never true zero.** Film's toe compresses shadow gently instead of clipping, and carries almost no saturation — so digital grades lift the floor slightly, often tilting it cyan/green rather than the default blue of a raw log image, short of reading "milky."
10. **Scopes first, eyes to confirm.** Waveform, vectorscope and parade give an objective reference that human vision — which constantly adapts to ambient light and whatever it just looked at — can't supply alone; a calibrated reference monitor confirms the read.
11. **Structure is built once and reused.** Darren Mostyn saves an empty, labelled node tree as a Gallery Still and starts every job from it; Volpatto does the same with a structure he workshopped with fellow colourist Utzi; PowerGrades exist so a colourist's *system*, not one look, survives project to project.
12. **The look lives in the prep, not the sensor.** Steve Yedlin's Display Prep Demo argues — and demonstrates, applying one universal treatment across cameras with no shot-by-shot adjustment — that a camera of sufficient quality is just a data-collection device; the perceived "look" is entirely how that data is prepared afterward.

## Gustavo Rossi (@gustavorossiribeiro)

Gustavo Rossi is a Sydney-based colourist, videographer and photographer working as a remote colourist, teaching via Instagram as [@gustavorossiribeiro](https://www.instagram.com/gustavorossiribeiro/) and selling his GR Color system at gustavorossi.media. He's the influence Dom named directly, so this section sticks to documented facts about his products and content — Instagram itself isn't reachable from this research environment.

- **GR PowerGrade Pro** is a node structure "built on the principles of a real-world film pipeline" — Rossi says he spent hundreds of hours studying why the photochemical pipeline worked so reliably and rebuilt that logic in Resolve. It's two-tier: pre-built "preset" nodes for speed, full per-node control underneath for building from scratch. Native to Resolve, runs in free and Studio.
- **Normalisation:** the system is described as landing "every camera... on the same neutral base before the look goes on," explicitly including non-log, 8-bit phone and GoPro sources, not just cinema cameras — Rossi's own product description, but consistent with how Melara's camera-match line and Resolve's colour-managed timeline work.
- **GR Cinema and Kodak 2383 LUTs:** for the v2 update, Rossi says he used 3D LUT Creator and Lattice against original Kodak Vision3 stock and real 2383 prints, measuring the emulation directly rather than starting from someone else's LUT.
- **AI Presets** ship alongside the film-pipeline nodes and stock emulations, plus an included masterclass (reported as around two hours in some listings, a much longer multi-chapter walkthrough in others, depending on edition).
- **Masking and range:** his content includes a "Power of Masking in Color Grading" reel plus a separate "Food Grading Edition" reel — his teaching treats masking as its own topic, and his grading covers well beyond cinematic drama. Beyond their titles, exact techniques shown can't be confirmed from this environment.

**What to adopt:** build one documented system — "structure, stocks and reasoning" is Rossi's own framing — rather than a look to copy. Normalise every source (FX30 log, X-T5 stills, phone b-roll) into the same working space first, every time. Treat a print-emulation layer measured from real film as a starting PowerGrade layer, not a final button. Give masking its own deliberate pipeline step, which pays off directly in Dom's product- and food-adjacent motion work.

## Cullen Kelly

LA senior colourist — Netflix, HBO, Hulu, Microsoft, McDonald's, Sephora, Academy Award-nominated work — and full-time educator (YouTube, the podcast *The Color Code*, Mixing Light tutorials).

- **Subtractive saturation:** build a subtractive colour-balance tool by hand on the Color page — saturate a hue while dropping its luminance together, mirroring how a more saturated real surface reflects, and so looks, darker. Avoids the plastic look of Resolve's default saturation slider alone.
- **Look development has rules:** in "5 Levels of Look Development" (ResolveCon '24), Kelly bans exposure and contrast from look development — a look LUT should only shift hue.
- **Contour's build order:** his DCTL tool sequences **Curve → Split → Saturation → Split Saturation → Density → Hue**, each module building on the last, plus "preferential colour mapping" — nudging skin, sky and foliage toward idealised versions of themselves.
- **Voyager LUT Pack:** modular — foundation LUTs set tonality, modifier LUTs stack on top to bias shadow/highlight colour — built for DaVinci Wide Gamut inside a proper colour-managed pipeline.

**What to adopt:** Kelly's Contour order is a ready-made skeleton for BNC's look layer (see the recipe below) — curve, split tone, saturation, shadow/highlight saturation, density, hue, last. Keep exposure and contrast out of that stage entirely. Map skin, sky and foliage consciously on every FX30 grade.

## Juan Melara

Australian colourist (juanmelara.com.au) known for rebuilding classic print-film LUTs as fully editable, native Resolve PowerGrades rather than baked 3D LUTs.

- **Print film emulation (PFE) line:** Kodak 2383, Kodak 2393, and Fujifilm 3510/3513DI/3521XD, rebuilt as PowerGrades in standard YRGB and colour-managed/DaVinci Wide Gamut versions, each with Standard/Middle Grey/Rec.709 curve variants and a zero-black-level option. He calls 2383 "the gold standard of print film emulations, with natural skin tones and pleasing well balanced colours."
- **FilmUnlimited:** PowerGrades emulating Kodak 5207 (250D) and 5219 (500T) negative stock he personally shot and profiled (Nov 2018/Jan 2021), with accurate halation, grain and gate-weave emulation (grain needs Resolve Studio).
- **Camera-to-Alexa matching:** his match line (Canon2Alexa, Sony2Alexa, down to iPhone16Pro2Alexa) repeats one line across every product page — "the camera match transform... is where the Alexa look lives." The normalisation transform, not the final LUT, does the real work.

**What to adopt:** don't rely on one generic "film LUT" — the curve variant matters depending where it sits in your tree. Put any camera-match/normalisation transform at the very front, ahead of creative work. Model added texture from real, profiled film, not a generic overlay.

## Waqas Qazi

Founder of Qazi & Co, describing himself via his own marketing as the most-followed colourist online, 1M+ followers across platforms, 15 years with clients including Prime Video, Universal and Adidas.

- **Freelance Colorist Masterclass:** 300+ lessons covering Resolve technique and the business of freelancing, including a "grade 10x faster" module.
- **QazVerse:** his ecosystem — RapidGrade, a DCTL toolkit, LUTs, PowerGrades and courses — pitched as one consistent workflow.
- **Power windows, generally:** taught as standard Resolve technique — isolating regions to add depth and direct attention. A specifically named "relight" module, or a product titled "Zero to Hero," could not be confirmed under Qazi's name; treat any such workflow as general power-windows technique, not a verified unique method.

**What to adopt:** use power windows as a lighting tool, not just a fix-it tool — reshape perceived depth as part of the creative pass. Build one documented, reusable toolkit so speed improves without cutting quality.

## Darren Mostyn

Brighton (UK) colourist, 30+ years in broadcast, founder/senior colourist at Online Creative, a regular grader for the BBC, Amazon and Netflix, and a certified Resolve trainer.

- **"My Perfect Node Tree":** at ResolveCon '24, Mostyn presented a fixed, empty node-tree template — no grades baked in, saved as a Gallery Still — built once, reused as the literal starting point on every job.
- Also teaches scope-reading directly, pairing structural consistency with objective measurement rather than treating them separately.

**What to adopt:** build one blank, labelled BNC node-tree template, save it as a Gallery Still/PowerGrade, and apply it first on every project, so tree architecture is never a mid-grade decision.

## Walter Volpatto

Hollywood colourist (Company 3/EFILM lineage) — *Dunkirk*, *Star Wars: The Last Jedi*, *The Hateful Eight*, *Green Book*.

- **A fixed structure, arrived at independently:** developed over years, discussed with fellow colourist Utzi, shared at a 2019 LA Colorist Meetup — the same "solve it once" idea Mostyn teaches, reached separately.
- **Printer lights first:** grades mostly with log offset controls ("printer lights") plus "just a touch of saturation and contrast" — reading as an exposure/white-balance move, not a colour "fix."
- **Restraint over polish:** in "Why 'Perfect' Grading Ruins Movies" (CineTalk), his stated position is that a technically flawless grade can work against the film.

**What to adopt:** reach for offset/printer-light moves before saturation or contrast. Build and keep a fixed node structure — two top working colourists arriving at that independently is a strong signal it's genuine best practice, not house style.

## Steve Yedlin, ASC

Cinematographer (*Knives Out*, *Star Wars: The Last Jedi*, *Brick*), not a colourist by trade, but his public teaching is among the most cited work on how a film "look" is actually built.

- **The Display Prep Demo:** over 10+ years, Yedlin analysed film's response empirically and built methods so digital cameras could reproduce it — probability-based grain, halation, gate weave, tone-mapped colour via 3D geometry.
- **Core argument:** cameras of sufficient quality all capture enough data; the perceived "look" comes from how that data is prepared, not the sensor — "merely a data collection device." He deliberately applied one universal treatment across cameras with no shot-by-shot adjustment, to prove the point holds. (A widely shared line, "the look is not tied to the camera," is a paraphrase by an article author, not a verbatim Yedlin quote — though it reflects his stated position accurately.)

**What to adopt:** stop hunting for a "magic" camera setting or LUT — the FX30's S-Log3/S-Gamut3.Cine is enough data; the look is entirely what BNC does to it afterward. Build texture as a deliberate, modelled last stage. Test any BNC look across a range of shots before trusting it — if it needs per-shot rescue to read as filmic, the pipeline is the problem, not the footage.

## Dado Valentic

Award-winning colourist and colour scientist — 60+ features, hundreds of commercials, the colour science behind *Marco Polo* Season 2 (the first Netflix HDR production, Best TV Picture at the 2016 ASC Awards) — and founder/CEO of Colourlab Ai.

- **Colourlab Ai:** AI trained on cinematic footage colour-matches shots and suggests variations from one graded reference clip, syncing a whole timeline or hours of dailies in seconds to minutes, integrating with Resolve, Premiere and FCPX without re-rendering.
- **AI assists, doesn't replace:** by his own account, the AI generates a starting look and he finishes the rest of the sequence by hand, as he always has.
- **"How to see" over workflow:** in interviews he frames perceptual training as the real thing worth teaching, describing his own practice moving from grading-as-technique toward researching perceptual models, film emulation and AI-assisted colour.

**What to adopt:** use AI/automated matching (Resolve's own Color Match/Shot Match, or a dedicated tool) for fast multi-clip consistency, then finish by hand — match first, grade second. Treat critical viewing and memory-colour perception as the actual skill being built; software is only the delivery mechanism.

## Alexis Van Hurkman & Daria Fissoun — the standard teaching lineage

Two authors, not a duo, but their books sit on the same shelf as the field's reference texts.

- **Van Hurkman's *Color Correction Handbook*** covers the whole correction workflow — setup, primary contrast, primary colour, HSL qualification and hue curves, shapes/windows, memory colours (skin, sky, foliage), and a dedicated shot-matching and scene-balancing chapter — codifying "balance and match first, stylise after."
- **Fissoun's *Colorist Guide to DaVinci Resolve*** (versions 17 and 18) is Blackmagic Design's own official, free ~400-page training text. Fissoun is a London-based, CSI-certified colourist and Resolve trainer. Part I is explicitly built around primary and secondary technique and balancing/matching, before any creative look work — the Color page's own palette layout (Color Match/Wheels/Curves, then Qualifier/Window/Tracker/Magic Mask) enforces the same order structurally.

**What to adopt:** use the "memory colours" checklist — skin, sky, foliage — as a standing check on every grade; it's the same trio Kelly's colour mapping targets. Follow balance → primary → secondary → look everywhere in this document, because it's also what Blackmagic's own official training teaches.

## Film emulation, explained properly

**Negative vs print, in one paragraph.** A negative (camera) stock is flat, low-contrast and forgiving — wide exposure latitude, inverted tones, meant to be printed or scanned, not viewed directly. A print (release) stock is what that negative was historically printed onto photochemically, or what a "print film emulation" (PFE) LUT previews the response of. Contrast, saturation and colour bias — the actual look — get built in at the *print* stage, not the negative. A log image like S-Log3 behaves like a scanned negative: flat, no baked-in style. Grading it means timing it toward a print stock's response — why GR Cinema, Melara's PFE line and the Kodak 2383/2393 LUTs everyone reaches for are built from *print* stock, not negative stock.

**Contrast-curve anatomy.** Every stock's curve has a toe (gentle shadow compression), a straight midtone section, and a shoulder (gentle highlight compression) — why film never clips like an unprocessed digital sensor; tones fold instead of hitting a wall. Kodak 2383's toes are matched tightly across its three colour layers for neutral highlights, with a raised D-max giving an improved black, known for a soft, pleasing highlight rolloff. Kodak 2393 (Vision Premier) pushes further — roughly an 18-stop contrast ratio against 2383's 13, deeper and purer blacks, more saturation, about 0.1 higher print density — the punchier option. Fuji's 3510/3513 prints sit lower in contrast than either Kodak option, softer rolloff, gentler colour separation, more neutral, slightly green-leaning blacks — a quieter alternative to Kodak's warmth; 3513 is a touch more contrasty than 3510, with Fuji's characteristic clean blues.

**Shadow colour: cyan/green, not blue.** Real film carries almost no colour saturation in true blacks or highlights, part of why desaturating deep shadow reads as "filmic" in a digital grade. Where film shadow does carry a bias, it tends to sit cyan/green (most visible in the Fuji prints) rather than the blue-black a raw, ungraded digital log image defaults to — a small, high-leverage move: nudge shadows cyan/green instead of leaving them blue.

**Negative stocks, briefly:** Vision3 50D (5203, daylight, ISO 50) — the family's finest grain, clean and crisp, for bright exteriors. Vision3 250D (5207, daylight, ISO 250) — the general-purpose daylight negative, excellent highlight latitude. Vision3 500T (5219, tungsten, ISO 500) — outstanding skin tones, reduced shadow grain, roughly two stops of extended highlight latitude — the interiors/low-light/night stock. Portra 400 — warm, muted, natural skin, medium contrast, built on Vision3 technology and "made to be edited," the most flexible still option. Portra 800 — warmer and more saturated/contrastier than 400, older-generation stock, more punch straight off the negative. Fuji Eterna, the cine negative (not the still simulation of the same name) — very flat, low contrast and saturation with a cyan lean and lifted shadows, a grading starting point rather than a finished look.

**Texture.** *Halation* is light passing through the emulsion, reflecting off the film base, and re-exposing the emulsion from behind — a soft, often reddish-orange glow blooming from specular highlights and high-contrast edges (a bright window, a streetlamp at night); anti-halation backing on modern stocks suppresses it to varying degrees, so its visible strength is stock- and era-dependent. *Bloom* is a related but distinct, softer and more even glow from optical causes (lens flare/diffusion), not the emulsion's internal reflection. *Grain* is a physical texture from the film's silver-halide particles — random, organic, coarser on faster stock and in underexposed areas — versus *digital noise*, electronic sensor interference that tends to look more uniform and chroma-noisy in shadow; modern tools model grain per stock and exposure zone rather than overlaying a fixed texture. *Gate weave* is the mechanical micro-wobble of film through a camera or projector gate frame by frame — invisible once a scan is stabilised, but sometimes reintroduced deliberately (a little random translation and rotation) so an otherwise too-static digital image doesn't feel sterile.

**Tools, briefly:**
- **Resolve Film Look Creator** (Resolve 19, core tool free) — one ResolveFX combining halo/overlight, grain, flicker, gate weave and vignette, with Kodak/Fuji-inspired presets, a master Color Blend fade and swappable "Core Looks."
- **Dehancer** (OFX plugin suite) — 60+ film profiles, a dedicated print-film stage, physically modelled grain (8/16/35/65mm plus custom), 8 halation profiles, bloom, film damage/overscan and a LUT generator, built for DWG/ACES/Cineon pipelines.
- **FilmConvert Nitrate** — starts from a camera-specific profile, built by shooting test charts on each supported camera against 19 real stocks, so the same "stock" preset is tuned per source camera; grain is modelled per exposure/colour zone.
- **Filmbox** (Video Village) — colour rendering, halation, grain and gate weave together, switchable film format (8/16/35/VistaVision/65mm), and a switch between a contact-printed-negative look and a telecine-transfer look.

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

Fujifilm's in-camera Film Simulations are the digital descendants of Fuji's actual stock line — and because Dom shoots the X-T5 alongside the FX30, they're a ready-made, camera-native palette reference for steering video grades.

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

**The recipe culture.** A "film simulation recipe," in Fuji X Weekly founder Ritchie Roesch's usage, is a documented set of in-camera JPEG parameters — white balance shift, tone, colour, sharpness, grain, clarity — layered on a base simulation to reproduce a stock's feel straight out of camera. Fuji X Weekly hosts 400+ such recipes (the free app carries 100+), most loosely inspired by real film stocks (Kodachrome, Portra, Tri-X, Superia), and Classic Chrome bases more of the most-viewed recipes than any other simulation. The culture is built on remixing shared formulas, not guarding secret settings.

**Matching FX30 footage to X-T5 stills.** This is a synthesis of the principles above, not a published method for this exact camera pair — a process to test, not a proven recipe. Pick a target simulation (or recipe) as the project's reference palette. The X-T5 bakes its simulation into a JPEG while the FX30 shoots flat log, so they can't be matched with one universal LUT: normalise the FX30's S-Log3/S-Gamut3.Cine into the working space first, then shoot a grey card and a face in the same light on both cameras and read where the X-T5 JPEG's skin, sky and foliage land on the vectorscope and waveform against the ungraded FX30 plate. Push the FX30 grade's hue curves, split tone and density until those three memory-colours land in the same scope positions — effectively treating the X-T5 simulation as the "print" target and the FX30 log plate as the "negative" being timed to match it. A ready-made cross-camera LUT pack exists (Sony S-Log2/S-Gamut3.cine, shot on an A6300, matched against Fujifilm X-T3 simulations) — a rough proof of concept to check against, not a guaranteed match for the FX30's S-Log3 or the X-T5's newer sensor, so verify by eye and scope. Document the matched grade as its own reusable PowerGrade — the video-side equivalent of a Fuji recipe.

## The BNC look-building recipe

A synthesis of everything above, as one pipeline. Each step is its own node group so nothing gets remixed back together.

1. **Normalise.** Color Space Transform every source — FX30 log, X-T5 stills/log, any phone/GoPro b-roll — into DaVinci Wide Gamut + Intermediate at node one. *Why:* one look only works everywhere if everything starts from the same neutral base (GR PowerGrade Pro, Melara's camera-match line).
2. **Balance.** White balance, exposure and a shot-matching pass to a neutral target, before any styling; check skin against the vectorscope's skin-tone line here. *Why:* Van Hurkman, Fissoun and standard order-of-operations teaching all put this first and separate from styling; Kelly's rules forbid revisiting it later.
3. **Primaries.** Contrast/pivot shaping and lift/gamma/gain balance — not yet the look's colour. *Why:* the primaries stage in every teaching source here, and Kelly's "dial in the contrast curve" step, done before hue work starts.
4. **Secondaries / masks.** Power windows and qualifiers — skin lifted, background subdued, sky or product isolated. *Why:* Qazi's power-windows teaching and Rossi's "Power of Masking" content both treat this as distinct from any global move.
5. **Look layer**, its own sub-chain, closely following Kelly's Contour order:
   - **Palette** — split tone and hue shifts, preferential mapping on skin, sky and foliage.
   - **Subtractive saturation / density** — saturate while dropping luminance together, so colour reads as pigment density rather than a digital boost.
   - **Highlight rolloff** — a soft shoulder, not a hard clip, echoing the print stocks above.
   - **Black point** — lifted slightly off true zero, tilted cyan/green rather than digital's default blue-black, short of "milky."

   *Why this order:* contrast is finished in step 3, colour is a look-layer job — never remixed back into one node.
6. **Texture** (optional). Grain matched to the target format/ISO, halation on specular highlights only, a whisper of gate weave if genuinely needed — Resolve's Film Look Creator for a fast pass, or Dehancer/Filmbox/FilmConvert Nitrate for a modelled one. *Why:* texture is a deliberately modelled last stage everywhere in this document, Yedlin included — so it goes last, after everything that could re-grade it.
7. **Output transform.** Color Space Transform out of DaVinci Wide Gamut to the delivery space (Rec.709, P3, etc.) as the final node, so everything above stays in the wide working space until the last possible step.

**How this maps onto the BNC LUT pack.** The pack delivers the look layer as
display-referred `.cube` files (Rec.709 in, Rec.709 out), so in a LUT
pipeline the order is: balance and primaries in log → secondaries → base
LUT (the display transform) → look LUT → texture (see Tree 1 in
`05-resolve-workflow-fx30.md`). If you build a look by hand in a
colour-managed timeline, build it in DaVinci Wide Gamut / Intermediate before
the output transform exactly as described above. The recipes in
`08-lookbook.md` list every move in each look so you can do either.

**Numbers to check on scopes:**
- Vectorscope — skin sits on or near the skin-tone line (~11 o'clock, between R and YI), unless a deliberate lighting choice pulls it off.
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
- ["Power of Masking in Color Grading" reel — Instagram](https://www.instagram.com/gustavorossiribeiro/reel/C_y2Vj1txgo/)
- ["Food Grading Edition" reel — Instagram](https://www.instagram.com/gustavorossiribeiro/reel/C80Qoo8Sx3Q/)

**Cullen Kelly**
- [Cullen Kelly Color — official site](https://cullenkellycolor.com/)
- [Contour — Cullen Kelly Color](https://cullenkellycolor.com/contour)
- [Visual Math: Building a Subtractive Saturation Node Tree — Mixing Light](https://mixinglight.com/color-grading-tutorials/visual-math-building-a-subtractive-saturation-node-tree-in-davinci-resolve/)
- [Cullen Kelly: Exposure & Contrast Not Allowed In Look Development — The Daejeon Chronicles](https://daejeonchronicles.com/2024/09/08/exposure-contrast-not-allowed-in-look-development/)
- [5 Levels of Look Development in Color Grading — ResolveCon '24 (YouTube)](https://www.youtube.com/watch?v=R0CP-LcG36A)
- [CONTOUR: Great Looks For DaVinci Resolve — gfxplugin.com](https://blog.gfxplugin.com/post/contour/)
- [12.6 Voyager LUT Pack — procolor.ist](https://procolor.ist/voyager-lut-pack/)

**Juan Melara**
- [Juan Melara — official site](https://juanmelara.com.au/)
- [Kodak 2383 PowerGrade — Juan Melara](https://juanmelara.com.au/products/kodak-2383-powergrade)
- [Kodak 2393 PowerGrade — Juan Melara](https://juanmelara.com.au/products/kodak-2393-powergrade)
- [Sony2Alexa Usage Instructions — Juan Melara](https://juanmelara.com.au/sony2alexa-usage-instructions)
- [Juan Melara FilmUnlimited PowerGrades — memoja.co](https://memoja.co/downloads/juan-melara-filmunlimited-powergrades/)

**Waqas Qazi**
- [Waqas Qazi — official site](https://www.waqasqazi.com/)
- [QazVerse — Qazi's Grading Ecosystem for DaVinci Resolve](https://www.qazverse.com/)
- [Freelance Colorist Masterclass](https://www.freelancecoloristmasterclass.com/)
- [Waqas Qazi – The Freelance Colorist Masterclass Review — Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/cool-videos-films-projects-creative-work/waqas-qazi-the-freelance-colorist-masterclass-review/)

**Darren Mostyn**
- [My Perfect Node Tree for Color Grading — ResolveCon '24 (YouTube)](https://www.youtube.com/watch?v=wvPkoL8nx-I)
- [Darren Mostyn — iColorist / The International Colorist Academy](https://icolorist.com/tag/darren-mostyn/)
- [How Professional Colorists Read Scopes featuring Darren Mostyn (YouTube)](https://www.youtube.com/watch?v=vt1T9h_vAqY)

**Walter Volpatto**
- [Walter Volpatto — Wikipedia](https://en.wikipedia.org/wiki/Walter_Volpatto)
- [The Master - Color grading by Walter Volpatto — Lowepost](https://lowepost.com/casestudies/the-master-r13/)
- [Walter Volpatto Talks Node Structure — The Daejeon Chronicles](https://daejeonchronicles.com/2021/09/06/walter-volpatto-talks-resolve-node-structure/)
- [Why "Perfect" Grading Ruins Movies | CineTalk with Walter Volpatto (YouTube)](https://www.youtube.com/watch?v=PcFUgVjswxE)

**Steve Yedlin, ASC**
- [Display Prep Demo — Steve Yedlin, ASC](https://www.yedlin.net/DisplayPrepDemo/)
- [Display Prep Demo FAQ — yedlin.net](https://yedlin.net/NerdyFilmTechStuff/DispPrepDemoFAQ/index.html)
- [DP Steve Yedlin Blows the Lid Off Camera Resolution Myths — No Film School](https://nofilmschool.com/2017/08/yedlin-camera-resolution-myths)
- [Blackmagic Forum: Steve Yedlin Film Look Isn't Camera Related](https://forum.blackmagicdesign.com/viewtopic.php?t=107181&p=593054)

**Dado Valentic**
- [Colourlab Ai Emerges to Revolutionize Post Production](https://colourlab.ai/colourlab-ai-emerges-to-revolutionize-post-production/)
- [Colourlab – AI-assisted Color Grading: An Interview with Dado Valentic — Larry Jordan](https://larryjordan.com/articles/colourlab-ai-assisted-color-grading-an-interview-with-dado-valentic/)
- [About Dado Valentic — Color Grading Academy](https://www.colorgradingacademy.com/about)
- [Colorist Podcast EP 022: Dado Valentic — Mixing Light](https://mixinglight.com/color-grading-tutorials/colorist-podcast-ep-022-dado-valentic/)

**Alexis Van Hurkman & Daria Fissoun / Blackmagic training**
- [Color Correction Handbook — Alexis Van Hurkman (Amazon)](https://www.amazon.com/Color-Correction-Handbook-Professional-Techniques/dp/0321929667)
- [The Colorist Guide to DaVinci Resolve 18 — Blackmagic Design (PDF)](https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-18-Colorist-Guide.pdf)
- [The Colorist Guide to DaVinci Resolve 18 Released — CineD](https://www.cined.com/the-colorist-guide-to-davinci-resolve-18-released-free-400-page-educational-resource/)
- [Daria Fissoun — LinkedIn](https://uk.linkedin.com/in/daria-fissoun-5862864b)

**Film stocks**
- [KODAK VISION Color Print Film 2383/3383 — Kodak](https://www.kodak.com/en/motion/product/post/print-films/vision-color-2383-3383/)
- [Kodak 2383 LUT: A Guide to Cinematic Color Grading — Preset Curator](https://presetcurator.com/kodak-2383-lut/)
- [KODAK VISION Premier Color Print Film 2393 — cinematography.net (PDF)](https://www.cinematography.net/Files/VISPREM.PDF)
- [KODAK VISION3 500T Color Negative Film 5219/7219 — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/VISION3_5219_7219_Technical-data.pdf)
- [KODAK VISION3 250D Color Negative Film 5207/7207 Technical Data — Kodak (PDF)](https://www.kodak.com/content/products-brochures/Film/VISION3-250D-Technical-Data-EN.pdf)
- [Kodak Portra 400: A Classic For a Reason — Shoot It With Film](https://shootitwithfilm.com/kodak-portra-400-a-classic-for-a-reason/)
- [Kodak Portra 400 vs Portra 800 — PICTS Lab](https://www.pictslab.com/blog/kodak-portra-400-vs-portra-800)
- [Anyone know about Print film Fuji F-cp 3510? — Photrio forum](https://www.photrio.com/forum/threads/anyone-know-about-print-film-fuji-f-cp-3510.141110/)
- [Fuji Eterna Inspired Film Emulation Workflow — Seto Shop](https://seto.studio/blog/film-emulation-fuji-eterna-look)

**Halation, grain, gate weave, texture tools**
- [Chasing the Glow: Understanding Halation — CineD](https://www.cined.com/chasing-the-glow-understanding-halation-and-why-filmmakers-keep-coming-back-to-it/)
- [Gate weave — Dehancer Learn](https://www.dehancer.com/learn/article/gate-weave)
- [Film Grain vs. Digital Noise: What's the Difference? — anissadphotography.com](https://anissadphotography.com/film-grain-vs-digital-noise-differences/)
- [What's in Resolve's New Film Look Creator Plugin? — Frame.io Insider](https://blog.frame.io/2024/08/15/what-is-resolves-new-film-look-creator-plugin/)
- [Dehancer — Features](https://www.dehancer.com/features)
- [FilmConvert Nitrate — official product page](https://www.filmconvert.com/nitrate)
- [Understanding FilmConvert's New Nitrate Colour Grading Plugin — Jonny Elwyn](https://jonnyelwyn.co.uk/film-and-video-editing/understanding-filmconverts-new-nitrate-colour-grading-plugin/)
- [Video Village (Filmbox)](https://videovillage.com/)
- [Film Print Emulation Part 4: A Deep Dive Into Filmbox — Mixing Light](https://mixinglight.com/color-grading-tutorials/fpe-part-4-filmbox-ml1143/)
- [Film Emulation Part 1: Subtractive Grading — Color Finale Blog](https://colorfinale.com/blog/post/cf-subtractive-grading-10-24)

**Teal/orange, split tone, skin, scopes**
- [What is the 'Orange & Teal Look' and Why is it So Popular? — PetaPixel](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/)
- [What is Split Toning and How to Use it in Lightroom? — Northlandscapes](https://www.northlandscapes.com/articles/what-is-split-toning-and-how-to-use-it-in-lightroom)
- [The Secrets You Need to Know About Color Grading Skin Tones — No Film School](https://nofilmschool.com/color-grading-skin-tone-secrets)
- [The Skin Tone Line — Pixel Valley Studio](https://pixelvalleystudio.com/pmf-articles/the-skin-tone-line)
- [What is Mid-Grey? The importance of 18% Midtone Grey — CubieColor](https://www.cubiecolor.com/post/what-is-mid-grey-and-the-importance-of-18-midtone-grey-in-color-grading)
- [How to Read Scopes in Color Grading — cinapex](https://cinapex.pro/how-to-read-scopes-in-color-grading-complete-guide/)
- [The Best Order Of Operations For Color Grading — Noam Kroll](https://noamkroll.com/the-best-order-of-operations-for-color-grading-why-it-makes-all-the-difference/)
- [Why The "Milky Black" Look Is Overused — Noam Kroll](https://noamkroll.com/why-the-milky-black-look-is-now-the-most-overused-technique-in-amateur-cinematography/)

**DaVinci Resolve colour management, normalisation, PowerGrades**
- [How to Color Manage using Nodes in DaVinci Resolve — Frame.io Insider](https://blog.frame.io/2024/01/08/color-management-nodes-davinci-resolve/)
- [Color Management in DaVinci Resolve — MONONODES](https://mononodes.com/color-management-in-davinci-resolve/)
- [DaVinci Wide Gamut and DaVinci Intermediate — cinapex](https://cinapex.pro/davinci-wide-gamut-intermediate-workflow/)
- [Smartphone Meets Cinema Camera: Mastering the Mix — aaapresets.com](https://aaapresets.com/blogs/davinci-resolve-color-grading-gradient-tutorials/smartphone-meets-cinema-camera-mastering-the-mix-for-stunning-visuals-in-2025)
- [How to Use PowerGrades — MONONODES](https://mononodes.com/how-to-use-powergrades/)

**Fujifilm stills simulations and recipe culture**
- [Fujifilm Classic Chrome Film Simulation Recipes — Fuji X Weekly](https://fujixweekly.com/2019/01/06/fujifilm-classic-chrome-film-simulation-recipes/)
- [The Best Fujifilm Recipe for Each Film Simulation — Fuji X Weekly](https://fujixweekly.com/2026/04/16/the-best-fujifilm-recipe-for-each-film-simulation/)
- [NOSTALGIC Neg. — Fujifilm X Series & GFX](https://www.fujifilm-x.com/global/products/film-simulation/nostalgic-neg/)
- [Fujifilm Classic Neg: A Digital Film Simulation Review — FujiLove Magazine](https://fujilove.com/fujifilm-classic-neg-a-digital-film-simulation-review/)
- [Why You Should Use ETERNA for Movies — Fujifilm X Series & GFX](https://www.fujifilm-x.com/en-gb/learning-centre/why-you-should-use-eterna-for-movies/)
- [Fujifilm Velvia vs. Astia: How to Choose the Right Film Simulation — jmpeltier.com](https://www.jmpeltier.com/fujifilm-velvia-vs-astia/)
- [Fujifilm Brings Reala Ace Film Simulation to Four More Cameras — PetaPixel](https://petapixel.com/2024/06/27/fujifilm-brings-reala-ace-film-simulation-to-four-more-cameras/)
- [ETERNA Bleach Bypass — Fujifilm X Series & GFX](https://www.fujifilm-x.com/en-us/products/film-simulation/eterna-bleach-bypass/)
- [How to Create Film Simulation Recipes — Fuji X Weekly](https://fujixweekly.com/2023/12/21/how-to-create-film-simulation-recipes/)

**Sony/Fuji cross-camera matching**
- [Fujifilm Film Simulation LUTs for Sony S-Log2/S-Gamut3.cine — DPReview Forums](https://www.dpreview.com/forums/threads/fujifilm-film-simulation-luts-for-sony-s-log2-s-gamut3-cine.4437018/)
- [Can you get Fuji colors on Sony? — veresdenialex.com](https://www.veresdenialex.com/post/can-you-get-fuji-colors-on-sony)
