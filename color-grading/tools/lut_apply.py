"""lut_apply.py -- shared .cube helpers (SPEC.md section 8).

read_cube / write_cube handle the Iridas/Resolve .cube format with red
index fastest ("for b: for g: for r"). apply_lut uses tetrahedral
interpolation (the 6-tetrahedra decomposition of the unit cube, what
Resolve uses); apply_lut_trilinear is provided for comparison. Both are
fully vectorised over arrays of shape (..., 3) -- no per-pixel Python loop.
"""

from typing import Tuple

import numpy as np


def write_cube(
    path: str,
    lattice: np.ndarray,
    title: str,
    description: str,
    input_space: str,
    output_space: str = "Rec.709 Gamma 2.4",
) -> None:
    """Write a (N,N,N,3) lattice, indexed [b,g,r], to a .cube file.

    Row order is red index fastest, then green, then blue -- i.e. exactly
    `for b in range(N): for g in range(N): for r in range(N): yield
    lattice[b,g,r]` -- which is precisely how a [b,g,r]-indexed array
    flattens in C (row-major) order, so no reordering is needed here.
    Values are clipped to [0,1] and written "%.6f".
    """
    lattice = np.asarray(lattice, dtype=np.float64)
    n = lattice.shape[0]
    if lattice.shape != (n, n, n, 3):
        raise ValueError(f"lattice must be (N,N,N,3), got {lattice.shape}")

    flat = np.clip(lattice, 0.0, 1.0).reshape(-1, 3)
    with open(path, "w", newline="\n") as f:
        f.write(f'TITLE "{title}"\n')
        f.write(f"# BNC Grade v1.0 - {description}\n")
        f.write(f"# Input: {input_space} | Output: {output_space}\n")
        f.write(f"LUT_3D_SIZE {n}\n")
        f.write("DOMAIN_MIN 0.0 0.0 0.0\n")
        f.write("DOMAIN_MAX 1.0 1.0 1.0\n")
        np.savetxt(f, flat, fmt="%.6f")


def read_cube(path: str) -> Tuple[int, np.ndarray, str]:
    """Parse a .cube file.

    Returns (N, lattice, title) where lattice has shape (N,N,N,3) indexed
    [b,g,r] -- lattice[b,g,r] is the (R,G,B) output for the point whose
    input was (r/(N-1), g/(N-1), b/(N-1)). This is the natural reshape of
    the file's red-fastest row order, so no reordering is needed.
    """
    title = None
    size = None
    rows = []
    with open(path, "r") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            if s.startswith("TITLE"):
                if '"' in s:
                    title = s.split('"', 1)[1].rsplit('"', 1)[0]
                else:
                    title = s[len("TITLE"):].strip()
                continue
            if s.startswith("LUT_3D_SIZE"):
                size = int(s.split()[1])
                continue
            if s.startswith(("DOMAIN_MIN", "DOMAIN_MAX", "LUT_1D_SIZE", "TITLE")):
                continue
            parts = s.split()
            if len(parts) >= 3:
                rows.append((float(parts[0]), float(parts[1]), float(parts[2])))

    if size is None:
        raise ValueError(f"{path}: missing LUT_3D_SIZE")
    data = np.asarray(rows, dtype=np.float64)
    expected = size ** 3
    if data.shape[0] != expected:
        raise ValueError(f"{path}: expected {expected} data rows for size {size}, got {data.shape[0]}")
    lattice = data.reshape(size, size, size, 3)
    return size, lattice, title


def _lattice_corners(lut: np.ndarray, r0, g0, b0):
    """The 8 lattice corners around (r0,g0,b0), each shaped like r0 + (3,)."""
    def corner(dr, dg, db):
        return lut[b0 + db, g0 + dg, r0 + dr]

    return {
        (0, 0, 0): corner(0, 0, 0), (1, 0, 0): corner(1, 0, 0),
        (0, 1, 0): corner(0, 1, 0), (0, 0, 1): corner(0, 0, 1),
        (1, 1, 0): corner(1, 1, 0), (1, 0, 1): corner(1, 0, 1),
        (0, 1, 1): corner(0, 1, 1), (1, 1, 1): corner(1, 1, 1),
    }


def _lattice_position(img: np.ndarray, n: int):
    img_c = np.clip(np.asarray(img, dtype=np.float64), 0.0, 1.0)
    pos = img_c * (n - 1)
    r_pos, g_pos, b_pos = pos[..., 0], pos[..., 1], pos[..., 2]
    r0 = np.clip(np.floor(r_pos).astype(np.int64), 0, n - 2)
    g0 = np.clip(np.floor(g_pos).astype(np.int64), 0, n - 2)
    b0 = np.clip(np.floor(b_pos).astype(np.int64), 0, n - 2)
    fr = (r_pos - r0)[..., None]
    fg = (g_pos - g0)[..., None]
    fb = (b_pos - b0)[..., None]
    return r0, g0, b0, fr, fg, fb


def apply_lut(img_float: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Apply a (N,N,N,3) [b,g,r]-indexed LUT with tetrahedral interpolation
    (the standard 6-tetrahedra decomposition of the unit cube; this is what
    DaVinci Resolve uses). img_float in [0,1], shape (...,3); vectorised.
    """
    n = lut.shape[0]
    r0, g0, b0, fr, fg, fb = _lattice_position(img_float, n)
    c = _lattice_corners(lut, r0, g0, b0)
    c000, c100, c010, c001 = c[0, 0, 0], c[1, 0, 0], c[0, 1, 0], c[0, 0, 1]
    c110, c101, c011, c111 = c[1, 1, 0], c[1, 0, 1], c[0, 1, 1], c[1, 1, 1]

    m1 = (fr >= fg) & (fg >= fb)                                   # r>=g>=b
    m2 = (fr >= fb) & (fb >= fg) & ~m1                              # r>=b>=g
    m3 = (fg >= fr) & (fr >= fb) & ~m1 & ~m2                        # g>=r>=b
    m4 = (fb >= fr) & (fr >= fg) & ~m1 & ~m2 & ~m3                  # b>=r>=g
    m5 = (fg >= fb) & (fb >= fr) & ~m1 & ~m2 & ~m3 & ~m4            # g>=b>=r
    # m6 (remaining): b>=g>=r

    out1 = (1 - fr) * c000 + (fr - fg) * c100 + (fg - fb) * c110 + fb * c111
    out2 = (1 - fr) * c000 + (fr - fb) * c100 + (fb - fg) * c101 + fg * c111
    out3 = (1 - fg) * c000 + (fg - fr) * c010 + (fr - fb) * c110 + fb * c111
    out4 = (1 - fb) * c000 + (fb - fr) * c001 + (fr - fg) * c101 + fg * c111
    out5 = (1 - fg) * c000 + (fg - fb) * c010 + (fb - fr) * c011 + fr * c111
    out6 = (1 - fb) * c000 + (fb - fg) * c001 + (fg - fr) * c011 + fr * c111

    out = np.where(m1, out1, np.where(m2, out2, np.where(m3, out3,
          np.where(m4, out4, np.where(m5, out5, out6)))))
    return out


def apply_lut_trilinear(img_float: np.ndarray, lut: np.ndarray) -> np.ndarray:
    """Apply a (N,N,N,3) [b,g,r]-indexed LUT with trilinear interpolation
    (provided for comparison against apply_lut's tetrahedral result).
    """
    n = lut.shape[0]
    r0, g0, b0, fr, fg, fb = _lattice_position(img_float, n)
    c = _lattice_corners(lut, r0, g0, b0)

    c00 = c[0, 0, 0] * (1 - fr) + c[1, 0, 0] * fr
    c10 = c[0, 1, 0] * (1 - fr) + c[1, 1, 0] * fr
    c01 = c[0, 0, 1] * (1 - fr) + c[1, 0, 1] * fr
    c11 = c[0, 1, 1] * (1 - fr) + c[1, 1, 1] * fr

    c0 = c00 * (1 - fg) + c10 * fg
    c1 = c01 * (1 - fg) + c11 * fg

    return c0 * (1 - fb) + c1 * fb
