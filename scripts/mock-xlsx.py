"""Write one solved mock-exam workbook from the JSON that scripts/build-kit.ts produces.

Usage: python3 scripts/mock-xlsx.py <spec.json> <out.xlsx>
Sheets Q1, Q2 hold the reference-solved model (formulas recalculate on open); the Answers sheet lists every part.
"""
import json
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

spec_path, out_path = sys.argv[1], sys.argv[2]
with open(spec_path, encoding="utf-8") as fh:
    spec = json.load(fh)

wb = Workbook()
wb.remove(wb.active)
for sheet in spec["sheets"]:
    ws = wb.create_sheet(sheet["name"])
    for ref, cell in sheet["cells"].items():
        target = ws[ref]
        target.value = cell["f"] if "f" in cell else cell.get("v")
        if cell.get("fmt"):
            target.number_format = cell["fmt"]
        if cell.get("bold"):
            target.font = Font(bold=True)
    for col, width in sheet.get("colWidths", {}).items():
        ws.column_dimensions[col].width = max(width, 8)

ws = wb.create_sheet("Answers")
headers = ["Question", "Marks", "Part", "Answer (formula / settings)", "Steps", "Why"]
ws.append(headers)
for c in ws[1]:
    c.font = Font(bold=True)
for a in spec["answers"]:
    ws.append([a["question"], a["marks"], a["task"], a["answer"], a["steps"], a["why"]])
for col, width in zip("ABCDEF", (9, 7, 60, 60, 50, 60)):
    ws.column_dimensions[col].width = width
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical="top")

wb.calculation.fullCalcOnLoad = True
wb.save(out_path)
print(f"wrote {out_path}")
