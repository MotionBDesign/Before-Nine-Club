# Colour Theory for Grading

Before you touch a colour wheel in DaVinci Resolve or drop a Color Lookup layer into Photoshop, it helps to know what you're actually manipulating. Colour grading tools split an image into hue, saturation and luminance because that's how human vision actually separates colour information — and because splitting them apart is the only way to make a targeted, repeatable change instead of a lucky guess. This document covers the theory that explains *why* the tools are shaped the way they are, so the rest of your learning (scopes, primaries, secondaries) has something to hang off.

## The three attributes: hue, saturation, luminance

Every colour a grading tool shows you breaks down into three independent properties:

- **Hue** — the colour family itself: red, orange, yellow, green, blue, magenta. On a colour wheel this is the angle, measured in degrees from 0-360°.
- **Saturation** — the intensity or purity of that hue. Fully saturated colour looks vivid; desaturated colour drifts toward grey. At 0% saturation, hue becomes meaningless — every colour converges on the same neutral grey.
- **Luminance** (or lightness/value) — how light or dark the colour is, independent of what hue it is. A colour at 0% luminance is black regardless of its hue; at 100% it's white.

The reason grading software (and human vision) treats these as separate channels rather than one blob of "colour" is that each one does a different job in an image, and each one causes a different kind of problem when it's wrong. A hue shift makes skin look jaundiced or sunburnt. A saturation problem makes an image look either lifeless or radioactive. A luminance problem is really an exposure and contrast problem. Because DaVinci Resolve's HSL qualifier, Hue vs Hue/Sat/Lum curves, and the Color Warper all operate on one or two of these three axes at a time, understanding which axis you're actually trying to change is the difference between a precise correction and collateral damage to the rest of the image.

## Colour wheels: the painter's wheel vs the grading wheel

There are two colour wheels in common use, and they don't agree with each other, which causes real confusion.

**RYB (red-yellow-blue)** is the traditional painter's wheel, built on subtractive pigment mixing. Pigments absorb light rather than emit it, so mixing pigments together removes light and the result gets darker — mix all three RYB primaries and you get a muddy brown, not white. This is the wheel taught in art class, and it's the one most "colour theory" content on the internet (and most human intuition about "opposite" colours) is quietly built on.

**RGB** is the wheel your monitor, camera sensor and vectorscope actually use. It's additive: red, green and blue *light* combine, and more of each adds brightness, with all three at full intensity producing white. Resolve's vectorscope is essentially an RGB/YUV colour wheel with targets marked on it — when you're reading a vectorscope, you're reading additive colour space, not the RYB wheel from art school.

The practical takeaway: when someone talks about "complementary colours" in a grading context, they mean opposite hues on the RGB/vectorscope wheel (cyan and red, or blue and yellow, or green and magenta), not the red/green, blue/orange, yellow/purple pairs from the RYB wheel. In practice, though, colourists still use the RYB-derived vocabulary — "orange and teal," "blue and orange" — because it's how the industry talks, even though the actual grading tools sample RGB.

### Harmony types and what they mean for a grade

| Harmony | Colour-wheel relationship | Grading use |
|---|---|---|
| Complementary | Two hues directly opposite (180°) | Maximum contrast — the basis of teal/orange; used to separate subject from background |
| Analogous | Hues adjacent to each other (roughly 30° apart) | Harmonious, low-tension palettes — good for calm, cohesive scenes |
| Triadic | Three hues evenly spaced (120° apart) | Vibrant but balanced — used sparingly, since three strong hues can fight for attention |
| Split-complementary | A base hue plus the two hues adjacent to its complement | High contrast with less tension than a straight complementary pair — a gentler alternative to teal/orange |

Teal and orange is the complementary pair colourists reach for constantly, and there's a specific reason it works beyond "opposite colours look nice together": human skin sits in the orange-yellow range, so pushing a background toward teal automatically separates a subject from their environment without touching the subject directly. It also happens to mimic a very common real-world lighting condition — warm sunlight against a blue sky or blue shade — so the eye reads it as natural even when it's been pushed hard. The mechanism is genuinely just complementary contrast: warm highlights and cool shadows (or a warm subject against a cool environment) are doing the same "maximum contrast" job that any complementary pair does, teal/orange is just the specific pair that lines up with skin and sky.

## Itten's seven colour contrasts

Johannes Itten, a Bauhaus colour theorist, catalogued seven distinct ways colours can contrast with each other. You don't need to memorise Itten to grade well, but the list is a genuinely useful checklist when a shot feels flat and you're not sure why — it gives you seven different *kinds* of visual interest to check for, only one of which is "make it more colourful."

| Contrast | What it is | Grading example |
|---|---|---|
| Hue | Pure, saturated hues placed side by side | Primary-colour title sequences, saturated production design |
| Light-dark | Contrast in value, independent of colour | Contrast/pivot work, your waveform's shape from black to white |
| Cold-warm | Temperature difference (e.g. orange vs blue) | Teal/orange, warm key light vs cool fill or background |
| Complementary | Opposite hues on the wheel | Split-toning: warm highlights, cool shadows (or vice versa) |
| Simultaneous | Colours perceptually shift each other by proximity | Why a neutral grey looks tinted next to a strongly coloured wall — see below |
| Saturation | Pure hue vs a greyed-down version of the same hue | Isolating a saturated subject against a desaturated background |
| Extension (proportion) | Balance of colour based on how much area each hue occupies | A small patch of intense red can visually balance a large field of muted green — useful when deciding how much of the frame to push |

The one most relevant to everyday grading decisions is cold-warm, because it's the axis your white balance and split-tone controls live on, and complementary/simultaneous, because they explain why a background colour choice changes how a foreground colour reads even when you haven't touched the foreground.

## Memory colours and the vectorscope skin-tone line

**Memory colours** are the colours viewers carry an internal, expected version of — chiefly skin, sky, and foliage, with neutral grey as a fourth reference that has no "memory" of its own but acts as your anchor. These three dominate because they appear in nearly every image and because the eye is unusually well-calibrated to judge them: you don't consciously know what a correct violet is, but you know immediately when skin looks wrong. Interestingly, viewers actually prefer skies and foliage pushed slightly more saturated than reality, and skin pushed slightly yellower than a strict colorimetric match — which is part of why "accurate" grades sometimes look flatter than "pleasing" ones, and why memory colours are a target to aim near, not a hard rule to obey exactly.

Skin is the memory colour that matters most because faces carry the emotional weight of almost every shot, and this is where the **vectorscope skin-tone line** earns its place as one of the first things you learn to read. It's the diagonal line running between the red and yellow targets on the vectorscope (sometimes labelled the "I-line," a holdover from NTSC). Regardless of a person's ethnicity, their skin tone traces sit along roughly this same line — melanin mostly changes *saturation and luminance* (how far the trace sits from centre, and how bright it is), while the *hue angle* stays remarkably consistent because it's driven by haemoglobin in the blood under the skin, which is common to everyone. In practice, this means the skin-tone line isn't a beauty target for one skin tone — it's a diagnostic line for all of them: if your skin trace is rotated off that line, you have a white-balance or hue problem, not a "make it darker/lighter" problem.

Two caveats worth keeping in mind:

- The line is a guide, not law. Deliberately warm or cool lighting (sunset, tungsten practical, deep shade) will legitimately rotate skin off the line, and the shot can still read as correct because the lighting cue explains it.
- Use it as a diagnostic, not a target you chase on every single shot — chasing the exact line on a shot that's meant to feel a specific way will fight the story you're trying to tell.

## Warm vs cool, colour temperature, and creative "warmth"

Kelvin measures the colour of a light source: low values (around 2,700K) are the warm orange of household tungsten bulbs; high values (upward of 6,500K+) trend toward blue daylight and overcast sky. White balance is a two-axis correction, not one: alongside the Kelvin/orange-blue axis, there's a second axis for green-magenta tint, because real-world light sources (especially fluorescent and LED) don't always sit neatly on the blackbody curve that Kelvin describes — they can lean green or magenta as well as warm or cool.

This matters for grading because "white balance" and "creative warmth" are the same tool used for two different jobs, and conflating them causes confusion:

- **White balance as correction** neutralises the colour of the light source so a genuinely white or grey object in the frame *reads* as white or grey — this is a technical fix, done early, judged against a neutral reference.
- **Warmth as a creative choice** deliberately pushes the image warm or cool *after* that neutral point is established, to support mood — nostalgia and comfort skew warm, unease and sterility skew cool.

If you push creative warmth before you've corrected the white balance, you're stacking a stylistic choice on top of an unknown error, and you won't be able to tell later which part of the "look" was intentional and which was just uncorrected tungsten light.

## Additive vs subtractive colour, and why film looks the way it does

This is one of the more genuinely useful pieces of theory for a digital shooter chasing a filmic look, because it explains a mechanical difference, not just a stylistic one.

**Digital saturation is typically additive/multiplicative.** Standard saturation controls scale the distance of a pixel from grey while leaving its brightness largely alone — or worse, they brighten as they saturate. Push saturation hard and colours get more vivid *and* often lighter, which reads as glossy, synthetic, "video." This is part of what people mean by the "video look": over-saturated, hue-distorted highlights combined with over-sharpened detail.

**Film's colour is subtractive by physical construction.** Colour negative and print film are stacks of dye layers — cyan, magenta and yellow — and each dye layer works by *absorbing* light, not adding it. More saturated colour on film means more dye density, which means the image gets physically darker in that area, not brighter. This is sometimes described as "subtractive saturation": modelling saturation as pigment/filter density rather than an RGB gain, so that saturated colours get denser (darker), the way ink or dye actually behaves. Print stock also has an inherent tendency to desaturate highlights as they approach the film's maximum density — bright, saturated colour and pure white can't coexist the way they can on a digital sensor, so film highlights roll off toward soft, slightly desaturated white rather than clipping to a flat, saturated plateau.

The practical takeaway for you: if a Resolve grade with the ordinary Saturation slider feels plasticky no matter how little you push it, the issue often isn't *how much* saturation, it's the *mechanism* — a gain-style saturation tool and a density-style one produce visibly different results at the same nominal setting, and reaching for a subtractive/density-modelled tool (or emulating the behaviour with lum-vs-sat curves that pull luminance down as saturation rises) gets you closer to what reads as "filmic" than simply dialling back the same tool further.

## Perceptual effects graders exploit (knowingly or not)

Your eyes are not a colorimeter. Several well-documented perceptual quirks mean that the same numeric values can look different depending on context — and colourists lean on these, deliberately or by trained instinct, all the time.

- **Hunt effect** — colour looks more saturated as luminance increases, and less saturated as luminance drops, even when the underlying chroma value hasn't changed. Practical takeaway: a grade that looks correctly saturated on a bright grading display can look under-saturated in a dim room, and grades made for very bright HDR displays often need less nominal saturation than an SDR grade of the same scene.
- **Abney effect** — adding white to a saturated colour (desaturating it) doesn't just reduce its purity, it also shifts its *perceived hue* — pure blue, desaturated, drifts toward purple. Practical takeaway: pulling saturation down on a colour and expecting the hue to hold steady is not a safe assumption; check the vectorscope trace angle after a big saturation pull, not just before.
- **Bezold-Brücke hue shift** — perceived hue shifts with luminance/intensity alone, independent of saturation: as a colour gets brighter, hues below roughly 500nm drift toward blue and hues above drift toward yellow. Practical takeaway: lifting or lowering a colour's brightness can visibly rotate its hue even if you never touched a hue control — useful to know when a lift/gamma/gain move seems to have "shifted the colour" of something.
- **Simultaneous contrast** — a colour's appearance is altered by the colours around it, most strongly when the surrounding colour is its complement. Practical takeaway: a neutral grey background can look tinted next to a strongly coloured wardrobe or set piece, so judge a "neutral" only in isolation (on the scope) — never trust your eye for neutrality against a busy background.
- **Helmholtz-Kohlrausch effect** — more saturated colour is perceived as *brighter* than a less saturated colour of identical measured luminance, an effect that's strongest in blues and reds/magentas and weakest in yellows. Practical takeaway: a heavily saturated colour can visually compete with (or overpower) a technically brighter but desaturated element in the frame — worth remembering when you're trying to direct the eye.

None of these are things you correct for with a specific slider. They're context for why an image can measure "right" on scopes and still look slightly off, or measure "off" and still look right — and why judging by eye and judging by scope are both necessary, and neither is sufficient alone.

## Colour spaces for a grader

This is the part of colour theory that's genuinely non-optional for your specific workflow, because grading log footage without understanding it leads directly to "why does everything look wrong" confusion.

### Scene-referred vs display-referred

**Scene-referred** image data represents, as closely as possible, the light that was actually in the scene, without being squeezed into a particular display's limited range. Your S-Log3/S-Gamut3.Cine footage straight off the FX30 is scene-referred: it's encoding a wide dynamic range and a wide colour gamut, deliberately uncommitted to what a Rec.709 TV can show.

**Display-referred** image data has already been mapped to a specific display's characteristics — brightness range, gamut, gamma. Once you convert to Rec.709, you've committed to display-referred: the image is now tone-mapped and gamut-mapped specifically for a Rec.709 screen, and further grading is being done "against" that display's limits.

In practice, working scene-referred for as long as possible (grading underneath, or "before," your display transform) preserves highlight and shadow detail and gamut that would otherwise already be clipped away — this is why Resolve's node trees typically put the LUT or colour space transform (CST) at the *end* of the chain, with correction happening in log/scene-referred space "underneath" it.

### Linear, log, and gamma

- **Linear** light data is a direct, unencoded record of photon count — doubling the light value doubles the number. It's mathematically ideal for certain operations (compositing, some colour science) but wildly inefficient for storing an image, because human vision is far more sensitive to differences in dark tones than bright ones, and linear "wastes" most of its numeric range on highlights we can barely distinguish.
- **Gamma encoding** (what Rec.709/sRGB do) compresses highlights and expands shadows using a power-law curve, roughly matching how human vision perceives brightness — this is why traditional video gamma looks "normal" straight off the sensor without extra grading, at the cost of a much narrower dynamic range than the sensor can actually capture.
- **Log encoding** (S-Log3, F-Log2) uses a logarithmic curve instead, stretching a much wider swath of the sensor's dynamic range across the available bits, prioritising highlight and shadow retention over an immediately "correct-looking" image. This is precisely the trade your FX30 and X-T5 are making when you shoot log: more usable range, at the cost of an image that needs a deliberate transform before it looks right.

### Gamut and transfer function, for your specific cameras

| Camera / space | Gamut (colour volume) | Transfer function (tone curve) | Notes |
|---|---|---|---|
| Sony FX30, S-Log3 | S-Gamut3.Cine | S-Log3 | S-Gamut3.Cine is deliberately sized close to DCI-P3 with extra room for grading; S-Log3 has no shoulder and a reduced toe, designed as a "purer" log curve than S-Log2 |
| Fujifilm X-T5, F-Log2 | F-Gamut (specified to comply with BT.2020) | F-Log2 | F-Log2 extends dynamic range over F-Log; designed to grade toward Rec.709 or Rec.2020/DCI-P3 |
| Rec.709 / sRGB | Rec.709 (the "standard HD" triangle — smallest of this group) | Rec.709 gamma / BT.1886 (~gamma 2.4) for video; sRGB's own curve for stills/web | The default delivery target for most online video |
| DCI-P3 | Wider than Rec.709 | Cinema-specific | Common digital cinema projection gamut; sits between Rec.709 and Rec.2020 |
| Rec.2020 | Very wide — encompasses Rec.709 and DCI-P3 | Used for HDR delivery | The gamut used for HDR streaming |
| DaVinci Wide Gamut | Wider than Rec.2020 | DaVinci Intermediate (log-like) | Resolve's own working/intermediate space — designed so grading operations don't clip real camera data before you've made a creative decision to clip it |

**Why log footage looks flat, and why you must not judge it before a display transform:** the flat, washed-out appearance of S-Log3 or F-Log2 footage straight off the timeline isn't a fault, it's the encoding working as designed — all that highlight and shadow detail is deliberately compressed into a low-contrast, desaturated-looking signal so nothing clips prematurely. Viewed with no transform, you are looking at *data*, not an *image* — the contrast, saturation and black level you're seeing bear no resemblance to what the footage will look like once mapped to a display. Judging exposure, white balance or "does this look nice" on raw log is close to meaningless; every meaningful judgement has to happen either with a technical LUT/CST applied (temporarily, for viewing) or by reading the scopes against known log-specific values instead of trusting your eye.

## A colour theory checklist for building a look

Use this before you start pushing wheels and curves — it turns "make it look cinematic" into a short list of actual decisions:

1. **Choose a palette.** Pick two or three hues you actually want present in the final image (e.g. teal shadows, warm skin, a neutral background) — don't let every hue in the frame compete for attention.
2. **Decide where warmth lives.** Highlights warm and shadows cool (or the reverse) — pick one and commit, rather than pushing warmth uniformly across the whole tonal range.
3. **Decide the contrast character.** High-contrast and punchy, or flatter and filmic with lifted blacks — this is a light-dark (Itten) decision, made before you touch saturation.
4. **Protect skin.** Whatever else moves, keep skin close to the vectorscope skin-tone line unless the lighting in the shot genuinely justifies moving it off.
5. **Keep one anchor neutral.** Pick something in the frame — a wall, a shirt, a grey card if you shot one — and keep it genuinely neutral on the scopes, so you have a fixed reference point telling you the rest of the grade is a deliberate choice and not drift.

## Sources

- [HSL (Hue, Saturation, Lightness) Definition — TechTerms](https://techterms.com/definition/hsl)
- [HSL: Hue, Saturation, and Lightness — Color Tutorial](https://colortutorial.design/hsb.html)
- [Why RGB instead of RYB? — Omni Calculator](https://www.omnicalculator.com/why-rgb-instead-of-ryb)
- [RGB or RYB: The Endless Debate Between Computer Scientists and Artists — Medium](https://scientificsamosa.medium.com/rgb-or-ryb-the-endless-debate-between-computer-scientists-and-artists-4d6bc982ff16)
- [Harmony (color) — Wikipedia](https://en.wikipedia.org/wiki/Harmony_(color))
- [Explanation of Complementary, Analogous, Triadic and Split Complementary Colors — graf1x.com](https://graf1x.com/definition-of-complementary-analogous-triadic-and-split-complementary-color-schemes/)
- [What is the Teal-Orange Look? Color Grading Technique Explained — Beverly Boy Productions](https://beverlyboy.com/filmmaking/what-is-teal-orange-look/)
- [What is the 'Orange & Teal Look' and Why is it So Popular? — PetaPixel](https://petapixel.com/2017/02/23/orange-teal-look-popular-hollywood/)
- [Johannes Itten's Color Contrasts — Worqx](https://www.worqx.com/color/itten.htm)
- [The 7 Color Contrasts of Johannes Itten Applied to Color Grading in DaVinci Resolve — Tobia Montanari](https://www.tobiamontanari.com/the-7-color-contrasts-of-johannes-itten-applied-to-color-grading-in-davinci-resolve/)
- [What is the skin tone line in the Vectorscope, and how do I use it? — Caitlin Watson](https://caitlinwatson.com/what-is-the-skin-tone-line-in-the-vectorscope-and-how-do-i-use-it/)
- [The Secret to Setting Skin Colors Accurately — Larry Jordan](https://larryjordan.com/articles/the-secret-to-setting-skin-colors-accurately/)
- [Memory Colors: Why Skin, Sky, Foliage Break Edits — Fstoppers](https://fstoppers.com/education/three-colors-expose-every-bad-edit-and-why-your-brain-cant-ignore-them-903385)
- [Memory Colors: an essential tool for Colorists — Tobia Montanari](https://www.tobiamontanari.com/memory-colors-an-essential-tool-for-colorists/)
- [Is There a Difference Between Color Temperature and White Balance? — Fstoppers](https://fstoppers.com/natural-light/there-difference-between-color-temperature-and-white-balance-596031)
- [Learning to See: White Balance 101 — Medium](https://medium.com/ice-cream-geometry/white-balance-learning-to-see-810335df427)
- [Subtractive Saturation Color Grading & Film Emulation — DVResolve.com](https://dvresolve.com/tutorial/subtractive-saturation-color-film-emulation/)
- [Subtractive Color Grading in DaVinci Resolve: Film Look with DCTL Tool — Passion Fuels Ambition](https://www.passionfuelsambition.com/mastering-subtractive-color-grading-in-davinci-resolve-the-ultimate-dctl-tool-for-film-density-and-pixeltools-level-control/)
- [The Simple Technique for "Cinematic" Color Saturation in DaVinci Resolve — Frame.io](https://blog.frame.io/2023/04/03/cinematic-color-saturation-resolve-hsv/)
- [The film look: what is it, and why are there two of them? — ProVideo Coalition](https://www.provideocoalition.com/film-look-two/)
- [Hunt effect (color) — Wikipedia](https://en.wikipedia.org/wiki/Hunt_effect_(color))
- [The Hunt Effect: Why the Same Grade Looks Different Depending on Where You Live — Jakob Martinez](https://jakobmartinezcolor.com/hunt-effect)
- [Bezold–Brücke shift — Wikipedia](https://en.wikipedia.org/wiki/Bezold%E2%80%93Br%C3%BCcke_shift)
- [Abney effect — Wikipedia](https://en.wikipedia.org/wiki/Abney_effect)
- [Color Context — DePaul University](http://facweb.cs.depaul.edu/sgrais/color_context.htm)
- [Helmholtz–Kohlrausch effect — Wikipedia](https://en.wikipedia.org/wiki/Helmholtz%E2%80%93Kohlrausch_effect)
- [Scene Referred vs. Display Referred Part II — The Daejeon Chronicles](https://daejeonchronicles.com/2022/12/31/scene-referred-vs-display-referred/)
- [Display-referred, scene-referred — ninedegreesbelow.com](https://ninedegreesbelow.com/photography/display-referred-scene-referred.html)
- [Color Management in DaVinci Resolve — MONONODES](https://mononodes.com/color-management-in-davinci-resolve/)
- [Log vs Gamma-corrected Video — Frame.io Workflow Guide](https://workflow.frame.io/guide/log-video)
- [Linear Light, Gamma, and ACES — Prolost](https://prolost.com/blog/aces)
- [Sony FX30 – S-Log3 and Cine EI Modes Explained — CineD](https://www.cined.com/sony-fx30-s-log3-and-cine-ei-modes-explained/)
- [Technical Summary for S-Gamut3.Cine/S-Log3 and S-Gamut3/S-Log3 — Sony](https://pro.sony/s3/cms-static-content/uploadfile/06/1237494271406.pdf)
- [F-Log2 Data Sheet Ver.1.0 — Fujifilm](https://dl.fujifilm-x.com/support/lut/F-Log2_DataSheet_E_Ver.1.0.pdf)
- [FUJIFILM F-Log Color Correction Using CSTs and LUTs — Fujifilm](https://shopusa.fujifilm-x.com/discover/grading-fujifilm-f-log-footage-with-csts-and-luts/)
- [Why Your Videos Look Flat (And How Log Profiles Fix It) — Canon Outside of Auto](https://www.canonoutsideofauto.ca/2026/04/03/why-your-videos-look-flat-and-how-log-profiles-fix-it/)
- [Why Your Display Can't Show the Full Dynamic Range of Log Footage — KTCPlay](https://us.ktcplay.com/blogs/technology-hub/log-footage-dynamic-range-monitor-limits)
- [Why Use Log Profiles in Video? — Beverly Boy Productions](https://beverlyboy.com/filmmaking/why-use-log-profiles-in-video/)
- [ITU-R BT.1886 — Wikipedia](https://en.wikipedia.org/wiki/ITU-R_BT.1886)
- [Color Gamut: Understanding Rec.709, DCI-P3, and Rec.2020 — BenQ](https://www.benq.com/en-us/business/resource/trends/understanding-color-gamut.html)
- [Why DaVinci Wide Gamut Matters — Gamut.io](https://gamut.io/why-davinci-wide-gamut-matters/)
- [Best Color Space for DaVinci Resolve — Miracamp](https://www.miracamp.com/learn/davinci-resolve/best-color-space)
