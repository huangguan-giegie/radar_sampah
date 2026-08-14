from pathlib import Path
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "documents"
ACCENT = "147D85"
PALE = "EAF5F4"
INK = RGBColor(31, 55, 66)


def shade(cell, fill):
    props = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    props.append(shd)


def set_cell_text(cell, text, bold=False, color=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(9.5)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def add_table(doc, rows):
    table = doc.add_table(rows=1, cols=len(rows[0]))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    for i, value in enumerate(rows[0]):
        set_cell_text(table.rows[0].cells[i], value, bold=True, color="FFFFFF")
        shade(table.rows[0].cells[i], ACCENT)
    for row in rows[1:]:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            set_cell_text(cells[i], value)
            if len(table.rows) % 2 == 0:
                shade(cells[i], PALE)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_body(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(text)
    run.font.name = "Aptos"
    run.font.size = Pt(10.5)
    run.font.color.rgb = INK


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(3)
    run = p.add_run(text)
    run.font.name = "Aptos"
    run.font.size = Pt(10.5)
    run.font.color.rgb = INK


def parse_and_build(source):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.62)
    section.bottom_margin = Inches(0.58)
    section.left_margin = Inches(0.72)
    section.right_margin = Inches(0.72)

    styles = doc.styles
    styles["Normal"].font.name = "Aptos"
    styles["Normal"].font.size = Pt(10.5)
    for name, size, color in [("Title", 24, ACCENT), ("Heading 1", 17, ACCENT), ("Heading 2", 13, "2B6771"), ("Heading 3", 11, "2B6771")]:
        style = styles[name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)

    header = section.header.paragraphs[0]
    header.text = "TEAM 04  |  MARINE OBSERVATION MVP"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in header.runs:
        run.font.name = "Aptos"
        run.font.size = Pt(8)
        run.font.bold = True
        run.font.color.rgb = RGBColor.from_string(ACCENT)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_run = footer.add_run("FIT5120 2026 S2  •  Synthetic/public data boundary")
    footer_run.font.name = "Aptos"
    footer_run.font.size = Pt(8)
    footer_run.font.color.rgb = RGBColor(100, 120, 125)

    lines = source.read_text(encoding="utf-8").splitlines()
    i = 0
    first_title = True
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and lines[i + 1].strip().startswith("|---"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                raw = lines[i].strip().strip("|")
                if set(raw.replace("|", "").replace("-", "").replace(":", "").strip()) == set():
                    i += 1
                    continue
                rows.append([part.strip() for part in raw.split("|")])
                i += 1
            add_table(doc, rows)
            continue
        if line.startswith("# "):
            p = doc.add_paragraph(style="Title" if first_title else "Heading 1")
            p.paragraph_format.space_after = Pt(10)
            p.add_run(line[2:].strip())
            first_title = False
            i += 1
            continue
        if line.startswith("## "):
            doc.add_heading(line[3:].strip(), level=1)
            i += 1
            continue
        if line.startswith("### "):
            doc.add_heading(line[4:].strip(), level=2)
            i += 1
            continue
        if re.match(r"^- \[[ xX]\]", line):
            add_bullet(doc, line[5:].strip())
            i += 1
            continue
        if line.startswith("- "):
            add_bullet(doc, line[2:].strip())
            i += 1
            continue
        if line.startswith("**") and line.endswith("**"):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(5)
            run = p.add_run(line.strip("*"))
            run.bold = True
            run.font.name = "Aptos"
            run.font.size = Pt(10.5)
            run.font.color.rgb = INK
            i += 1
            continue
        if line.startswith("`") and line.endswith("`"):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.18)
            p.paragraph_format.space_after = Pt(5)
            run = p.add_run(line.strip("`").strip())
            run.font.name = "Consolas"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor.from_string("275C63")
            i += 1
            continue
        add_body(doc, re.sub(r"\*\*(.*?)\*\*", r"\1", line))
        i += 1

    output = ROOT / (source.stem + ".docx")
    doc.save(output)
    return output


if __name__ == "__main__":
    for md in sorted(SOURCE_DIR.glob("*.md")):
        print(parse_and_build(md))
