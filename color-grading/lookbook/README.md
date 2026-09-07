# BNC Look Book

`index.html` is a single self-contained page for browsing the 13 BNC Grade looks — before/after per sample, the S-Log3 pipeline, colour charts, the plain-English recipe, how to rebuild each look by hand in Resolve / Photoshop / After Effects, and the LUT filenames — with every preview image inlined as base64.

Regenerate it any time a look recipe or preview changes: `python3 tools/build_lookbook.py`.

The preview photos in `lookbook/previews/` are public-domain or CC0 sample images (see `lookbook/samples/ATTRIBUTION.md`). Replace them with your own FX30 frames or X-T5 photos by dropping files into `lookbook/samples`, then re-run `python3 tools/render_previews.py` followed by `python3 tools/build_lookbook.py`.
