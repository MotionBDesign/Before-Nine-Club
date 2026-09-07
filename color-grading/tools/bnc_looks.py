"""bnc_looks.py -- the 13 BNC Grade look recipes (SPEC.md section 6).

Each look is a `Look` (id, name, slug, intent, use_for, ops) built from the
toolbox constructors in bnc_color.py, so the recipe text below reads almost
exactly like the pseudo-DSL in the spec. `describe(look)` renders the ops as
plain English; `LOOKS` is the ordered list of all 13.
"""

from dataclasses import dataclass, field
from typing import List

from bnc_color import (
    Op,
    exposure, white_balance, contrast, tone_curve, lift_blacks, toe,
    shoulder, softclip, saturation, vibrance, density, split_tone,
    hue_shift, hue_sat, hue_lum, bw_mix, tint,
)

# Hue centres (Oklab degrees) -- section 6.
RED = 29
ORANGE = 60  # skin
YELLOW = 110
GREEN = 142
CYAN = 195
BLUE = 264
MAGENTA = 328


@dataclass
class Look:
    id: str
    name: str
    slug: str
    intent: str
    use_for: str
    ops: List[Op] = field(default_factory=list)


LOOKS: List[Look] = [
    Look(
        id="L01", name="Clean", slug="Clean",
        intent="A neutral, true-to-life grade with a light punch -- the "
               "default 'just make it look intentional' pass.",
        use_for="General-purpose delivery and client review cuts that "
                "should read as graded without looking stylised.",
        ops=[
            contrast(1.05, hi=0.92),  # narrow soft clip so white stays white
            density(0.03),
            vibrance(1.04),
        ],
    ),
    Look(
        id="L02", name="Print2383", slug="Print2383",
        intent="Kodak 2383 print-stock emulation: punchy contrast, a "
               "crushed toe, cool-leaning shadows against warm highlights, "
               "and an overall desaturated, filmic roll-off.",
        use_for="Cinematic narrative work and trailers wanting a classic "
                "release-print look.",
        ops=[
            white_balance(0.01, 0),
            contrast(1.20),
            toe(0.40, 0.30),
            hue_shift(BLUE, 45, -6),
            hue_shift(YELLOW, 30, -8),
            hue_sat(RED, 30, 0.90),
            hue_sat(GREEN, 40, 0.90),
            density(0.14),
            split_tone(195, 0.014, 75, 0.014),
            saturation(0.90),
            softclip(0.86),
        ],
    ),
    Look(
        id="L03", name="GoldenHour", slug="GoldenHour",
        intent="Warm, golden-hour glow with an amber split-tone and a soft "
               "top end.",
        use_for="Sunset and outdoor lifestyle footage, weddings and travel "
                "work shot near golden hour.",
        ops=[
            white_balance(0.05, -0.01),
            contrast(1.10),
            split_tone(40, 0.008, 65, 0.026),
            hue_sat(ORANGE, 35, 1.08),
            density(0.06),
            lift_blacks(0.008),
            vibrance(1.06),
            softclip(0.88),
        ],
    ),
    Look(
        id="L04", name="TealOrange", slug="TealOrange",
        intent="Complementary teal shadows against warm orange skin tones "
               "-- the modern high-contrast blockbuster look.",
        use_for="Action, travel and commercial work wanting a punchy, "
                "contemporary grade.",
        ops=[
            contrast(1.12),
            split_tone(210, 0.042, 55, 0.020),
            hue_shift(BLUE, 45, -16),
            hue_shift(GREEN, 40, 20),
            hue_sat(GREEN, 40, 0.85),
            hue_sat(ORANGE, 25, 1.06),
            density(0.08),
            softclip(0.88),
        ],
    ),
    Look(
        id="L05", name="Chrome", slug="Chrome",
        intent="Muted, cross-processed 'chrome' look: rotated primaries, "
               "reduced saturation and cool highlights.",
        use_for="Music videos, fashion and moody narrative pieces.",
        ops=[
            contrast(1.15),
            toe(0.30, 0.30),
            saturation(0.82),
            hue_shift(RED, 30, 8),
            hue_sat(RED, 30, 0.85),
            hue_shift(BLUE, 45, -12),
            hue_sat(BLUE, 45, 0.90),
            hue_shift(GREEN, 40, -10),
            hue_sat(GREEN, 40, 0.85),
            split_tone(250, 0.010, 80, 0.006),
            density(0.10),
            softclip(0.87),
        ],
    ),
    Look(
        id="L06", name="Nostalgic", slug="Nostalgic",
        intent="Soft vintage look: lifted blacks, warm greens, cyan-leaning "
               "shadows and a gentle highlight shoulder.",
        use_for="Home-movie style memory pieces and documentary "
                "retrospectives.",
        ops=[
            contrast(1.04),
            lift_blacks(0.025),
            saturation(0.88),
            hue_shift(GREEN, 40, -14),
            hue_sat(GREEN, 40, 0.90),
            split_tone(190, 0.016, 70, 0.030),
            tint(340, 0.005),
            hue_sat(ORANGE, 30, 1.05),
            density(0.08),
            shoulder(0.80, 0.15),
        ],
    ),
    Look(
        id="L07", name="Eterna", slug="Eterna",
        intent="Fujifilm Eterna-style flat, low-contrast cinema stock "
               "emulation with soft highlights and gentle desaturation.",
        use_for="Naturalistic drama and documentary work that needs to sit "
                "gently rather than pop.",
        ops=[
            contrast(0.95),
            lift_blacks(0.015),
            shoulder(0.72, 0.25),
            saturation(0.78),
            hue_shift(GREEN, 40, 8),
            hue_sat(GREEN, 40, 0.85),
            split_tone(220, 0.008, 60, 0.004),
            density(0.06),
        ],
    ),
    Look(
        id="L08", name="Bleach", slug="Bleach",
        intent="Bleach-bypass emulation: heavy contrast, a crushed toe, "
               "and cool-leaning desaturation.",
        use_for="War/thriller and other gritty narrative work, "
                "high-contrast promos.",
        ops=[
            contrast(1.28),
            toe(0.40, 0.30),
            saturation(0.50),
            density(0.15),
            split_tone(220, 0.006, 85, 0.008),
            softclip(0.85),
        ],
    ),
    Look(
        id="L09", name="Nocturne", slug="Nocturne",
        intent="Cool, blue-leaning night grade with deep, protected "
               "shadows.",
        use_for="Night exteriors, moody low-key interiors, thriller/noir "
                "work.",
        ops=[
            white_balance(-0.06, 0),
            contrast(1.15),
            toe(0.30, 0.25),
            split_tone(240, 0.038, 60, 0.012),
            hue_sat(ORANGE, 30, 1.05),
            hue_sat(GREEN, 40, 0.80),
            saturation(0.90),
            density(0.10),
            softclip(0.88),
        ],
    ),
    Look(
        id="L10", name="Faded", slug="Faded",
        intent="Faded, lifted-black low-contrast look with a soft "
               "highlight shoulder, like a sun-faded print.",
        use_for="Retro/nostalgic edits and lifestyle content wanting an "
                "undone, filmic look.",
        ops=[
            lift_blacks(0.06),
            contrast(0.98),
            shoulder(0.75, 0.30),
            saturation(0.85),
            split_tone(50, 0.012, 70, 0.015),
            hue_shift(GREEN, 40, -10),
            density(0.04),
        ],
    ),
    Look(
        id="L11", name="Acros", slug="Acros",
        intent="Fujifilm Acros-style fine-grain black & white with punchy "
               "contrast and a gentle toe.",
        use_for="Black & white delivery, timeless/classic edits.",
        ops=[
            bw_mix(0.45, 0.45, 0.10),
            contrast(1.15),
            toe(0.25, 0.25),
            softclip(0.88),
        ],
    ),
    Look(
        id="L12", name="Vivid", slug="Vivid",
        intent="High-punch, high-vibrance grade with cool blue shadows "
               "lifted in luminance for extra pop.",
        use_for="Social and commercial content wanting maximum pop and "
                "saturation.",
        ops=[
            contrast(1.12),
            vibrance(1.25),
            hue_lum(BLUE, 45, 0.90),
            hue_sat(GREEN, 40, 1.10),
            hue_shift(GREEN, 40, 6),
            density(0.14),
            softclip(0.88),
        ],
    ),
    Look(
        id="L13", name="Airy", slug="Airy",
        intent="Bright, airy, lifted-shadow look with a soft top end and "
               "gentle overall desaturation.",
        use_for="Lifestyle, wedding and portrait work wanting a soft, "
                "bright aesthetic.",
        ops=[
            exposure(0.12),
            lift_blacks(0.03),
            contrast(0.92, pivot=0.5),
            shoulder(0.70, 0.15),
            saturation(0.90),
            split_tone(230, 0.006, 25, 0.012),
            hue_sat(GREEN, 40, 0.90),
        ],
    ),
]

LOOKS_BY_ID = {look.id: look for look in LOOKS}
LOOKS_BY_SLUG = {look.slug: look for look in LOOKS}


# ---------------------------------------------------------------------------
# describe(): render a look's ops as plain English lines
# ---------------------------------------------------------------------------

_HUE_NAMES = [
    (RED, "red"), (ORANGE, "orange"), (YELLOW, "yellow"), (GREEN, "green"),
    (CYAN, "cyan"), (BLUE, "blue"), (MAGENTA, "magenta"),
]


def _hue_name(deg: float) -> str:
    """Nearest named hue (of the 7 section-6 centres) to `deg`."""
    deg = deg % 360.0

    def circ_dist(a, b):
        d = abs(a - b) % 360.0
        return min(d, 360.0 - d)

    return min(_HUE_NAMES, key=lambda item: circ_dist(deg, item[0]))[1]


def _describe_op(op: Op) -> str:
    k = op.kwargs
    n = op.name

    if n == "exposure":
        return f"Exposure {k['ev']:+.2f} EV"

    if n == "white_balance":
        parts = []
        if k["warm"]:
            parts.append(f"{'warmer' if k['warm'] > 0 else 'cooler'} ({k['warm']:+.3f})")
        if k["tint"]:
            parts.append(f"{'toward magenta' if k['tint'] > 0 else 'toward green'} ({k['tint']:+.3f})")
        return "White balance " + (", ".join(parts) if parts else "unchanged")

    if n == "contrast":
        s = f"Contrast {k['amount']:.2f} around pivot {k['pivot']:.2f}"
        if k["amount"] > 1.0:
            s += f" (soft clip above {k['hi']:.2f}, below {k['lo']:.2f})"
        return s

    if n == "tone_curve":
        return f"Custom tone curve through {len(k['points'])} control points"

    if n == "lift_blacks":
        return f"Blacks lifted by {k['amount']:.3f} (raises the shadow floor)"

    if n == "toe":
        return f"Shadow toe: strength {k['strength']:.2f} over the bottom {k['range']:.2f} of range"

    if n == "shoulder":
        return f"Highlight shoulder from {k['start']:.2f}, roll-off k={k['k']:.2f}"

    if n == "softclip":
        s = f"Soft clip highlights above {k['hi']:.2f}"
        if k["lo"] > 0.0:
            s += f" and shadows below {k['lo']:.2f}"
        return s

    if n == "saturation":
        return f"Saturation × {k['amount']:.2f}"

    if n == "vibrance":
        return f"Vibrance × {k['amount']:.2f} (protects already-saturated colours)"

    if n == "density":
        return f"Film density {k['k']:.2f} (subtractive darkening of saturated colours)"

    if n == "split_tone":
        return (f"Shadows toned toward {_hue_name(k['sh_hue'])} ({k['sh_hue']:.0f}°) "
                f"by {k['sh_amt']:.3f}, highlights toward {_hue_name(k['hi_hue'])} "
                f"({k['hi_hue']:.0f}°) by {k['hi_amt']:.3f}")

    if n == "hue_shift":
        return (f"Hue shift: {_hue_name(k['centre'])} ({k['centre']:.0f}° "
                f"±{k['width']:.0f}°) rotated {k['shift']:+.0f}°")

    if n == "hue_sat":
        return (f"Saturation of {_hue_name(k['centre'])} ({k['centre']:.0f}° "
                f"±{k['width']:.0f}°) × {k['mult']:.2f}")

    if n == "hue_lum":
        return (f"Luminance of {_hue_name(k['centre'])} ({k['centre']:.0f}° "
                f"±{k['width']:.0f}°) × {k['mult']:.2f}")

    if n == "bw_mix":
        return f"Black & white mix: R {k['wr']:.2f} / G {k['wg']:.2f} / B {k['wb']:.2f}"

    if n == "tint":
        return f"Tint toward {_hue_name(k['hue'])} ({k['hue']:.0f}°) by {k['amount']:.3f}"

    return f"{n}({k})"


def describe(look: Look) -> List[str]:
    """Render `look`'s ops, in order, as plain-English grading language."""
    return [_describe_op(op) for op in look.ops]


def has_op(look: Look, *names: str) -> bool:
    """True if `look` uses any op in `names` (used by verify_luts.py for the
    split_tone/tint/white_balance grey-spread exemption in section 9.2)."""
    return any(op.name in names for op in look.ops)


if __name__ == "__main__":
    for look in LOOKS:
        print(f"{look.id} {look.slug} -- {look.intent}")
        for line in describe(look):
            print(f"    {line}")
        print()
