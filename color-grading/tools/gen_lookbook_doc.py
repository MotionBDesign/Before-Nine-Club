"""gen_lookbook_doc.py -- writes the per-look sections of docs/08-lookbook.md
and the looks table in README.md from tools/bnc_looks.py, so the docs never
drift from the recipes. Re-run after editing a recipe:

    python3 tools/gen_lookbook_doc.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import bnc_looks as bl  # noqa: E402

START = "<!-- LOOKS_TABLE -->"
END = "<!-- /LOOKS_TABLE -->"


def look_section(lk):
    lines = [f"### {lk.id} {lk.name}", "", lk.intent, "",
             f"**Use for:** {lk.use_for}", "",
             f"**Files:** `luts/02_looks/BNC_{lk.id}_{lk.slug}.cube` (Rec.709 in) · "
             f"`luts/03_combined_slog3/BNC_SLog3_{lk.id}_{lk.slug}.cube` (S-Log3 in)", "",
             "**Recipe (in order):**", ""]
    for i, line in enumerate(bl.describe(lk), 1):
        lines.append(f"{i}. {line}")
    lines.append("")
    return "\n".join(lines)


def summary_table():
    rows = ["| Look | Character | Use for |", "|---|---|---|"]
    for lk in bl.LOOKS:
        rows.append(f"| {lk.id} {lk.name} | {lk.intent} | {lk.use_for} |")
    return "\n".join(rows)


def replace_block(path, body):
    s = open(path).read()
    block = f"{START}\n{body}\n{END}"
    if END in s:
        s = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: block, s, flags=re.S)
    else:
        assert START in s, f"{path}: marker {START} missing"
        s = s.replace(START, block)
    open(path, "w").write(s)
    print("updated", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    doc = "\n".join(look_section(lk) for lk in bl.LOOKS)
    replace_block(os.path.join(ROOT, "docs", "08-lookbook.md"), doc)
    replace_block(os.path.join(ROOT, "README.md"), summary_table())
