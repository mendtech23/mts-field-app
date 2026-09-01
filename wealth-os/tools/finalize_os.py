"""Embed computed values and ask Excel to recalculate on open.

LibreOffice in this environment ships without its Calc filters, so the usual
recalc script cannot run. evaluate.py computes every formula from first
principles instead; its results are written in as cached values so the file
reads correctly in previewers, and fullCalcOnLoad makes Excel and Sheets
recompute everything from scratch the moment it is opened.
"""
import sys, zipfile, re, datetime as dt
sys.path.insert(0, "build")
import openpyxl
from openpyxl.workbook.properties import CalcProperties
from openpyxl.utils import column_index_from_string
from evaluate import Book
import xml.etree.ElementTree as ET

F = "Johnnys_Edge_Finance_OS.xlsx"
wb = openpyxl.load_workbook(F)
if wb.calculation is None:
    wb.calculation = CalcProperties(calcId=124519)
wb.calculation.fullCalcOnLoad = True
wb.save(F)

book = Book(F)
cache, errors = book.evaluate_all()
if errors:
    print("ERRORS — not embedding")
    for e in errors[:20]:
        print(" ", e)
    sys.exit(1)

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
with zipfile.ZipFile(F) as z:
    parts = {n: z.read(n) for n in z.namelist()}

rels = ET.fromstring(parts["xl/_rels/workbook.xml.rels"])
target = {r.get("Id"): r.get("Target") for r in rels}
wbx = ET.fromstring(parts["xl/workbook.xml"])
sheet_part = {}
for sh in wbx.find(NS + "sheets"):
    t = target[sh.get(REL + "id")]
    sheet_part[sh.get("name")] = ("xl/" + t.lstrip("/")).replace("xl/xl/", "xl/")

ET.register_namespace("", NS[1:-1])
EPOCH = dt.datetime(1899, 12, 30)
embedded = 0
for name, part in sheet_part.items():
    if part not in parts:
        continue
    root = ET.fromstring(parts[part])
    changed = False
    for c in root.iter(NS + "c"):
        f = c.find(NS + "f")
        if f is None:
            continue
        m = re.match(r"([A-Z]+)(\d+)", c.get("r") or "")
        if not m:
            continue
        val = cache.get((name, int(m.group(2)), column_index_from_string(m.group(1))))
        for old in c.findall(NS + "v"):
            c.remove(old)
        for old in c.findall(NS + "is"):
            c.remove(old)
        c.attrib.pop("t", None)
        v = ET.SubElement(c, NS + "v")
        if isinstance(val, bool):
            c.set("t", "b"); v.text = "1" if val else "0"
        elif isinstance(val, str):
            c.set("t", "str"); v.text = val
        elif isinstance(val, (int, float)):
            v.text = repr(round(float(val), 10))
        elif isinstance(val, (dt.datetime, dt.date)):
            d = val if isinstance(val, dt.datetime) else dt.datetime(val.year, val.month, val.day)
            v.text = repr((d - EPOCH).total_seconds() / 86400.0)
        else:
            c.remove(v); continue
        embedded += 1
        changed = True
    if changed:
        parts[part] = ET.tostring(root, encoding="UTF-8", xml_declaration=True)

with zipfile.ZipFile(F, "w", zipfile.ZIP_DEFLATED) as z:
    for n, data in parts.items():
        z.writestr(n, data)

print(f"finalised {F}: {embedded} cached values, 0 formula errors")
chk = openpyxl.load_workbook(F, data_only=True)
for sheet, cell, want in [("Checks & Audit", "A27", "MODEL STATUS:  ALL CHECKS OK"),
                          ("Accounts", "D15", 6105.17),
                          ("Settings", "B115", 18910.50),
                          ("Settings", "B13", 31.0),
                          ("Account History", "H7", 14.95)]:
    got = chk[sheet][cell].value
    ok = (isinstance(got, str) and got == want) or (
        isinstance(got, (int, float)) and abs(got - float(want)) < 0.02)
    print(f"  {'ok ' if ok else 'BAD'} {sheet}!{cell} = {got!r}")
    if not ok:
        sys.exit(1)
