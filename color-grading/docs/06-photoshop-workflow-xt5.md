# Photoshop Workflow for the X-T5

Stills work is a different discipline to grading video, but the goal is the same: get a clean, unclipped, neutral base before any creative look touches the image. This guide covers what the X-T5's raw files actually are, a Camera Raw base workflow that gets you to that neutral base, how to apply BNC Grade's `.cube` LUTs in Photoshop and at the raw stage, and how to keep photos and video looking like they came from the same camera system.

## 1. X-T5 facts for this workflow

### Sensor and raw format

The X-T5 uses a 40.2MP APS-C X-Trans CMOS 5 HR sensor (X-Trans, not a standard Bayer array) with the X-Processor 5 engine. Raw files are **14-bit RAF**, offered in two forms:

| RAF type | Reported file size | Notes |
|---|---|---|
| Uncompressed | roughly 60–85 MB (reports vary with scene complexity) | Every sensor value stored as-is |
| Lossless compressed | roughly 27–55 MB (reports vary) | Same bit depth and identical develop result to uncompressed — the compression is genuinely lossless, comparable to a ZIP, not a quality trade-off |

Given lossless compression develops identically to uncompressed, there's little reason to shoot uncompressed unless a specific downstream tool doesn't support the compressed variant — it's roughly half the card space for the same data.

### Dynamic range modes (DR100/200/400)

Fujifilm's DR modes protect highlights by deliberately underexposing and then lifting the result, and they come with a real cost:

| Mode | Highlight protection | Minimum ISO on the X-T5 | Trade-off |
|---|---|---|---|
| DR100 | Baseline (none) | Base ISO 125 | Best shadow cleanliness; highlights protected only by normal raw headroom |
| DR200 | +1 stop | ISO 250 minimum | Some added shadow noise once lifted |
| DR400 | +2 stops | ISO 500 minimum | Noticeably more shadow noise and a flatter, "lifted" look, especially in large even-tone areas like sky |

Use DR100 in soft, low-contrast light; DR200 as a general-purpose middle ground in bright/contrasty conditions; reach for DR400 specifically when highlights are genuinely at risk — hard sun, backlit faces, bright shirts, shiny foreheads — and accept the shadow noise trade-off as the cost of not blowing the highlight.

### Film simulations: baked in vs metadata only

Shoot JPEG, and the selected film simulation (Classic Chrome, Nostalgic Neg, Provia, etc.) is baked into the pixels. Shoot RAF, and the simulation choice rides along only as a metadata tag — the underlying sensor data stays neutral, and any raw processor can reinterpret it however it chooses (or ignore it and apply its own default). This is why a RAF opened in Camera Raw does not automatically look like the JPEG the camera would have produced from the same exposure.

### Adobe Camera Raw camera-matching profiles

Adobe ships "Camera Matching" profiles that approximate the Fujifilm film simulations. Coverage has lagged at times: shortly after the X-T5 launched, users reported **Classic Negative** and **Nostalgic Neg** missing, with those files falling back to a Provia-style profile. Current Camera Raw releases carry most simulations for the X-T5, but check the Profile Browser's Camera Matching group in your version; if one you rely on is absent, that is a version gap, not a fault on your end. Third-party DCP profile sets exist to fill the gap (for example, a community-maintained set on GitHub covering Nostalgic Neg and Bleach Bypass), as does Capture One, which has reportedly had broader simulation coverage.

### Fujifilm X RAW Studio (alternative path)

X RAW Studio is Fujifilm's free desktop app that reprocesses RAF files using the **actual camera's own image processor** over a USB tether, rather than software emulation — so film simulation rendering matches the camera's JPEG engine exactly, including any custom "recipes" saved on the camera. The trade-off is it needs the camera connected and powered throughout, and it's a from-scratch raw processor, not an ACR plug-in — a genuinely different workflow, not a Photoshop feature. An open-source alternative, FilmKit, does the same thing via WebUSB without Fujifilm's own app.

## 2. Camera Raw base workflow, step by step

The target at the end of this section is a clean, neutral, unclipped image — no creative colour decisions yet, just an honest rendition of what the sensor captured.

1. **Profile.** Start in the Profile Browser. **Adobe Color** is Adobe's own general-purpose rendering; a **Camera Matching** profile (where the simulation you shot is actually covered — see above) gets you closer to Fujifilm's own colour science as a starting point. Either is a reasonable base; pick one and be consistent, since it changes the starting tone curve everything else is built on.
2. **White balance.** Use the eyedropper on a known-neutral area, or dial Temp/Tint by eye against a reference. Do this before exposure — a wrong white balance will bias how clipped highlights and shadows look.
3. **Exposure.** Set the overall brightness using the Exposure slider, judged against the histogram, not the thumbnail.
4. **Highlights, Shadows, Whites, Blacks — with clipping warnings on.** Turn on the clipping warning triangles at the top corners of the histogram (or press **U** for shadow/underexposed clipping and **O** for highlight/overexposed clipping) so clipped areas overlay in blue (shadows) or red (highlights) on the image. The triangles themselves are colour-coded by which channel is clipping — black means nothing clipped, white means all three channels clipped, and red/green/blue/yellow/magenta/cyan indicate one or two channels clipping. Pull **Highlights** and **Shadows** to recover local detail first; use **Whites** and **Blacks** to set the overall clip points, backing off the moment the warning overlay appears anywhere you need to hold detail (skin, key subject, sky texture).
5. **Texture, Clarity, Dehaze — used with restraint.** These live in the Effects panel. Texture affects fine detail, Clarity affects broader midtone contrast, Dehaze cuts atmospheric haze and adds contrast — all three can look heavy-handed fast, and Dehaze in particular can introduce colour shifts if pushed. For a clean neutral base, keep all three light or at zero; save any of it for later, on a mask, only where a specific problem (real haze, a genuinely flat area) needs it.
6. **Lens corrections.** Turn on the built-in lens profile (distortion, vignette, chromatic aberration) for the lens actually mounted — Camera Raw carries profiles for most current lenses and will match automatically from EXIF in most cases.
7. **Enhance → Denoise for high ISO.** Camera Raw's AI Denoise (right-click the image → **Enhance**, or the Enhance panel) works only on raw files from Bayer or X-Trans sensors — which the X-T5 qualifies for — and uses a single Amount slider rather than the older multi-slider noise reduction tools, generally preserving more real detail while removing noise than the legacy approach. Reach for it on anything shot well above base ISO, especially DR400 frames where shadows have already been lifted.
8. **HSL panel.** Fine-tune individual hue, saturation and luminance per colour channel if the base profile needs correcting toward neutral — this is a corrective pass at this stage, not the creative grade.
9. **Calibration panel.** The Camera Calibration panel adjusts the primaries of the underlying profile itself (shifting how red/green/blue are interpreted at the sensor level) rather than adjusting the image directly — useful for a global, repeatable correction to a profile you find slightly off on every shot from this camera, though most users will get further, faster, from profile choice and HSL. Check the exact behaviour and defaults in your version of Camera Raw.

## 3. Opening into Photoshop

- **Bit depth: 16-bit**, always, for anything that's going to be graded further. 8-bit gives you 256 levels per channel; 16-bit gives 65,536 — the difference matters once you start pushing tone with a LUT.
- **Colour space choice — sRGB vs Adobe RGB vs ProPhoto RGB.** ProPhoto RGB is Camera Raw's native working space and preserves the widest possible gamut from the raw file, which is the right choice while you're still doing raw-stage corrections. But BNC Grade's look LUTs are built for **display-referred, Rec.709/sRGB-ish input** — they expect the same kind of already-tone-mapped data the technical LUT produces from video, or a standard sRGB-rendered photo. Convert (or, better, export a copy) to **sRGB** at the point you're about to apply the look LUT, so the LUT's colour transform is operating on the gamut it was built and tested against. Applying a look LUT to a still-wide-gamut ProPhoto image can shift the result compared to what the same LUT does to sRGB/Rec.709 video.
- **Smart objects.** Open as (or convert to) a Smart Object so the raw file stays attached and re-editable — double-clicking the Smart Object thumbnail reopens Camera Raw on the original raw data at any point, even after you've layered Photoshop adjustments and a Color Lookup layer on top.

## 4. Applying `.cube` LUTs in Photoshop

1. **Layer → New Adjustment Layer → Color Lookup** (or the Color Lookup icon in the Adjustments panel).
2. In the Color Lookup properties, use the **3D LUT** dropdown → **Load 3D LUT…** and select the project's `.cube` file. (To make a LUT appear permanently in that dropdown without reloading it each time, drop it into Photoshop's `Presets/3D LUTs` folder and restart Photoshop.)
3. **Strength:** use the adjustment layer's own **Opacity** slider — this is the simplest and most predictable way to dial a look back, and being an adjustment layer, it stays fully editable and can be toggled off at any time.
4. **Blend mode:** leave at **Normal** for the LUT's literal, intended result. Switching to **Luminosity** constrains the layer to affect only tone, not colour (useful if you want the LUT's contrast shape but not its colour cast); switching to **Color** does the reverse — colour only, tone untouched. Try both against Normal when a LUT feels like it's doing too much in one dimension.
5. **Masking.** Because it's a standard adjustment layer, it takes a standard layer mask. Use **Select Subject** or **Select Sky** to generate a fast starting selection, then refine and paint the mask so the look applies only where intended (e.g., a look LUT on the environment but held back from skin, or vice versa); luminosity masks (built from a channel or via Apply Image) are the standard way to confine the LUT to a tonal range — shadows only, or highlights only — rather than a subject-shaped area.
6. **Bit depth matters here too.** Apply strong Color Lookup layers on a 16-bit document, not 8-bit, to avoid banding — particularly visible in skies and skin gradients once a LUT reshapes contrast.
7. **LUT size.** BNC Grade's LUTs are 33-point `.cube` files, comfortably inside Photoshop's supported range for the format (reports place Photoshop's ceiling for related formats well above what a 33-point cube needs), so there's no resizing or compatibility concern here.

## 5. Applying the look at the raw stage: New Profile with a Look Table

For maximum quality, you can bake BNC Grade's look LUT into a **Camera Raw profile** instead of (or as well as) a Photoshop adjustment layer — this applies the look before any 8-bit rounding and makes it available as a one-click profile on every future import, in both Camera Raw and Lightroom Classic. Confirmed steps:

1. Open an image in Camera Raw (standalone, or via Photoshop's **Filter → Camera Raw Filter**).
2. Go to the **Presets** panel.
3. Hold **Alt** (Windows) / **Option** (Mac) and click the **Create Preset** icon at the top of the panel — holding the modifier key swaps the dialog from "New Preset" to **New Profile**.
4. Scroll to the **Color Lookup Table** section near the bottom of the New Profile dialog.
5. In the **Table** dropdown, choose **Load ".cube" File…** and select the BNC Grade look LUT.
6. Set **Min / Amount / Max** — Amount is what becomes the profile's user-facing intensity slider once applied.
7. Name the profile, choose a group for it, and click **OK**.
8. Apply it from the **Profile Browser** on any image going forward, adjusting the Amount slider per shot as needed.

Because this is stored as a standard **XMP profile**, it syncs into **Lightroom Classic** through Adobe's normal profile sync (Develop module → Profile Browser) — Lightroom Classic cannot load a raw `.cube` file directly, but it fully supports profiles that already have a LUT embedded this way, which is exactly what this process produces.

## 6. Matching photos to video, and exporting for Instagram

Using the **same look LUT** on both stills and FX30 footage (applied as a Camera Raw profile / Color Lookup layer on photos, and as the look LUT in Resolve or After Effects on video) is what makes a mixed photo-and-video post look like one consistent body of work rather than two different projects.

Export settings for social delivery of stills:

1. Flatten or export a copy (keep the layered/Smart Object master separately).
2. Convert to **sRGB** (the standard assumption for Instagram and most social platforms).
3. Resize to **2160px on the long edge** — some sources note 1080px is Instagram's native processing width and the platform will downscale regardless, but exporting a bit larger (2160px) is a common practice for a sharper result on high-density phone screens before that downscale happens.
4. Export as **JPEG, quality ≈80** — high enough to survive the platform's own re-compression without obvious artefacting, without needlessly inflating upload size.
5. **Embed the colour profile** on export — Photoshop's Save As/Export dialogs have a checkbox for embedding the ICC profile (exact wording varies by dialog and version, check yours) — so any app that does honour embedded profiles renders it correctly. Many social platforms still assume sRGB and ignore embedded profiles regardless, which is exactly why converting to sRGB before export (step 2) is the step that actually matters.

## Sources

- [Fujifilm X-T5 Camera Specifications — Sans Mirror (Thom Hogan)](https://www.sansmirror.com/cameras/camera-database/fujifilm-x-cameras/fujifilm-x-t5-camera-specif.html)
- [X-T5 Cheat Sheet — Fujifilm (official)](http://www.fujifilm-x.com/en-ca/wp-content/uploads/sites/12/2022/12/X-T5-Cheat-Sheet.pdf)
- [Fujifilm X-T5 Specifications — DPReview](https://www.dpreview.com/products/fujifilm/slrs/fujifilm_xt5/)
- [Does XT5 allow for lower res RAW? — Cameraderie forum](https://cameraderie.org/threads/does-xt5-allow-for-lower-res-raw.54487/)
- [Advice on Fuji X-T5 with Lossless Compressed RAWs on MacOS — Lightroom Queen Forums](https://www.lightroomqueen.com/community/threads/advice-on-fuji-x-t5-with-lossless-compressed-raws-on-macos.47543/)
- [X-T5 — How big is a 40 MB RAF file? — FujiX-Forum](https://www.fujix-forum.com/threads/how-big-is-a-40-mb-raf-file.132747/)
- [Uncompressed vs. Lossless — Alik Griffin](https://alikgriffin.com/uncompressed-vs-lossless-fujifilm-x-t2/)
- [What Is a RAF File? Fujifilm RAW Explained — RevelRaw](https://revelraw.com/blog/what-is-a-raf-file.html)
- [Fujifilm Dynamic Range: 5 Mistakes and Fixes (DR100, DR200, DR400) — Kevin Mullins Photography](https://www.kevinmullinsphotography.co.uk/blog/fujifilm-dynamic-range-5-mistakes-fixes)
- [Fujifilm Dynamic Range Explained: What DR100, DR200, and DR400 Really Do — J.M. Peltier](https://www.jmpeltier.com/fujifilm-dynamic-range-settings/)
- [How Fujifilm Dynamic Range Settings Change Your RAW Files — pal2tech](https://pal2tech.com/guides/camera/fujifilm-dynamic-range-raw-files/)
- [Fujifilm DR100 vs DR200 vs DR400: Which to Use — X-Alchemy](https://x-alchemy.app/academy/dynamic-range-guide)
- [Film simulations – jpeg only? — DPReview Forums](https://www.dpreview.com/forums/threads/film-simulations-jpeg-only.4742403/)
- [Possible to "bake in" Fuji film simulation to a RAF? — DPReview Forums](https://www.dpreview.com/forums/threads/possible-to-bake-in-fuji-film-simulation-to-a-raf.4792417/)
- [How to Get the Film Look from Fujifilm RAW — RevelRaw](https://revelraw.com/blog/film-look-fujifilm-raw.html)
- [Creating a camera profile for Fujifilm X-T5 — Adobe Community](https://community.adobe.com/t5/camera-raw-discussions/p-camera-matching-profiles-requests-and-information/m-p/13401673)
- [Missing "Fujifilm Classic Negative" film simulation in X-T5 Raw — Adobe Community](https://community.adobe.com/t5/camera-raw-discussions/p-camera-matching-profiles-requests-and-information/m-p/13358681)
- [FujifilmCameraProfiles — GitHub (abpy)](https://github.com/abpy/FujifilmCameraProfiles)
- [X Raw Studio: How to process Fujifilm Raw files with genuine Fujifilm processing — DPReview](https://www.dpreview.com/articles/2220768333/fujifilm-x-raw-studio-how-to-process-fujifilm-raw-files-on-your-computer/)
- [FUJIFILM X RAW STUDIO Alternatives — AlternativeTo](https://alternativeto.net/software/fujifilm-x-raw-studio)
- [Camera Raw's new Denoise uses AI to remove noise from photos! — Photoshop Essentials](https://www.photoshopessentials.com/photo-editing/use-the-new-ai-denoise-in-camera-raw-to-remove-noise-from-photos/)
- [Denoise and Masking Updates in Adobe Camera Raw (v15.3) — Julieanne Kost](https://jkost.com/blog/2023/04/denoise-and-masking-updates-in-adobe-camera-raw-v15-3.html)
- [Improve image quality using Camera Raw — Adobe (official help)](https://helpx.adobe.com/camera-raw/using/enhance.html)
- [Apply Masking for local adjustments in Camera Raw — Adobe (official help)](https://helpx.adobe.com/camera-raw/using/masking.html)
- [Everything You Need to Know About Masking in Adobe Camera Raw — Julieanne Kost](https://jkost.com/blog/2022/10/everything-you-need-to-know-about-masking-in-adobe-camera-raw.html)
- ["New Profile" dialog box / Import Color Lookup Table — Adobe Community](https://community.adobe.com/questions-563/new-profile-dialog-box-import-color-lookup-table-179769)
- [Tip Tuesday: Use a LUT in Camera Raw — KelbyOne Insider](https://insider.kelbyone.com/tip-tuesday-use-a-lut-in-camera-raw/)
- [Use Photoshop's Color Lookup Adjustment Layer to Quickly Apply Consistent Color Grades](https://lifetips.alibaba.com/tech-efficiency/use-photoshops-color-lookup-adjustment-layer-to-quickly)
- [How to Create and Import LUTs in Photoshop — PHLEARN](https://phlearn.com/tutorial/create-and-import-luts-in-photoshop/)
- [How do I apply 3D LUTs in Adobe Photoshop? — Lutify.me](https://lutify.me/docs/how-do-i-apply-3d-luts-in-adobe-photoshop/)
- [Authoring lookup textures with Adobe Photoshop — Unity HDRP docs (LUT size reference)](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@8.1/manual/LUT-Authoring-Photoshop.html)
- [Can You Use LUTs in Lightroom? — ON1](https://www.on1.com/blog/can-you-use-luts-in-lightroom/)
- [How To Install 3D LUTs in Lightroom Classic — PRO EDU](https://proedu.com/blogs/photoshop-skills/how-to-install-3d-luts-in-lightroom-classic-a-step-by-step-guide)
- [How To Convert A LUT To A Lightroom Camera Profile — Scott Davenport Photography](https://scottdavenportphoto.com/blog/how-to-convert-a-lut-to-a-lightroom-camera-profile)
- [Highlight Clipping in Adobe Photoshop Camera Raw (and Why You Should Care) — Layers Magazine](https://layersmagazine.com/highlight-clipping-in-adobe-photoshop-camera-raw-and-why-you-should-care.html)
- [Dehaze, texture, and Clarity are doing what? — Adobe Community](https://community.adobe.com/t5/camera-raw-discussions/dehaze-texture-and-clarity-are-doing-what/m-p/13726430)
- [Enhancing image clarity and texture in Photoshop's Camera Raw — Creatively Squared](https://www.creativelysquared.com/article/enhancing-image-clarity-and-texture-in-photoshops-camera-raw)
- [Work with lens profiles in Photoshop, Lightroom, and Camera Raw — Adobe (official help)](https://helpx.adobe.com/vn_vi/x-productkb/multi/lens-profile-support.html)
- [Understanding ProPhoto RGB — Luminous Landscape](https://luminous-landscape.com/understanding-prophoto-rgb/)
- [sRGB vs Adobe RGB vs ProPhoto RGB — Photography Life](https://photographylife.com/srgb-vs-adobe-rgb-vs-prophoto-rgb)
- [Don't let this hidden setting RUIN your RAW smart objects — Greg Benz Photography](https://gregbenzphotography.com/photography-tips/dont-let-this-hidden-setting-ruin-your-raw-smart-objects/)
- [Best Lightroom Export Settings for Instagram — Shotkit](https://shotkit.com/lightroom-export-instagram/)
- [Instagram Export Settings for Photographers — RevelRaw](https://revelraw.com/blog/best-instagram-export-settings.html)
