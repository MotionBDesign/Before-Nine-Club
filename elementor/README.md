# Before Nine Club — landing page (Elementor paste-in)

A self-contained HTML/CSS build of the latest website design
(`MBD_BeforeNine_Website_V2.jpg`, shared in Slack on 2026-06-30). It reproduces
the layout, brand colours, fonts, copy, the five feature icons (recreated as
inline SVG), and a logo stand-in.

`before-nine-landing.html` is the deliverable. It is a single block that you can
**paste straight into an Elementor "HTML" widget**, and it also opens directly in
any browser for previewing.

## Paste into Elementor

1. Edit the page → drag an **HTML** widget onto a full-width section (set the
   section's content width to *Full Width* and padding to `0` so the bands run
   edge-to-edge).
2. Open `before-nine-landing.html`, copy the **entire** contents, paste into the
   widget, then **Update**.
3. Swap in your photos and logo (below).

Everything is scoped under `#bnc`, so it won't clash with your theme's styles.

## Swap in the photos  ← do this in one place

There are **three photo areas**. Each is a single CSS variable near the top of
the `<style>` block (search for `IMAGE SLOTS`). Upload your images to the WP
Media Library, copy each image's URL, and replace the gradient with `url(...)`:

| Variable           | Where it appears                          | Suggested image                         |
|--------------------|-------------------------------------------|-----------------------------------------|
| `--img-hero`       | Top hero background                       | Breakfast table / pastries + coffee     |
| `--img-howitworks` | Right-hand photo in "How it works"        | Members talking at an event             |
| `--img-upside`     | "Any upside…" background behind quotes     | Group laughing over breakfast           |

Example:
```css
--img-hero: url('https://yoursite.com/wp-content/uploads/2026/06/hero.jpg');
```
(The defaults are brand-coloured gradients so the page looks finished before you
add photos.)

## Swap in the logo

The header and footer use an inline-SVG **logo stand-in** (search the file for
`LOGO STAND-IN`). Replace each with your official logo — e.g.:
```html
<a class="bnc-logo" href="#"><img src="https://yoursite.com/.../before-nine-logo.svg" alt="Before Nine" style="height:36px"></a>
```
Use the white version of the logo in the footer (dark navy background).

## Brand reference (baked into the file)

**Colours** (Adobe palette from Slack):

| Hex       | Use                                   |
|-----------|---------------------------------------|
| `#023E73` | Navy — headings, header button, footer |
| `#177DA6` | Mid blue — icons, middle quote card    |
| `#96C6D9` | Light blue — first quote card          |
| `#D9BD6A` | Gold — announcement bar, gold buttons  |
| `#BF9445` | Dark gold — "Good food…" band          |

**Fonts:** Poppins (headings) + Inter (body), loaded from Google Fonts via the
`@import` at the top of the style block. If Elementor manages your site fonts,
you can delete that `@import` and the page will fall back to your theme fonts.

## Needs your confirmation

Two FAQ answers are placeholders pending real info — search for `[Confirm`:
- **How much does it cost?** — pricing not specified in the design.
- **Can I bring a guest?** — guest policy not specified.

## What couldn't be pulled from Slack

The production **photos and icons** live inside the Illustrator working file
(`v2_MBD_BeforeNine_Website.ai`) on the studio SMB share
(`smb://MBD BM…/Before Nine/Website/`), which isn't reachable from the build
environment. Export those assets as PNG/JPG from the `.ai` file (or pull the
real photos) and drop them in via the image slots above. The icons here are
faithful SVG recreations and need no hosting.
