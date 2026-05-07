#!/usr/bin/env python3
"""Generate three OmniBlend PPTX presentations from scratch (stdlib only)."""

import zipfile, io, os
from datetime import datetime

# ── Colour palette ──────────────────────────────────────────────────────────
NAVY  = "0B1F3A"; BLUE  = "1B4F8A"; CYAN  = "00B4D8"
LIGHT = "EEF4F8"; WHITE = "FFFFFF"; GRAY  = "9CA3AF"
AMBER = "F59E0B"; GREEN = "10B981"; DARK  = "1A1A2E"
SLATE = "374151"; RED   = "EF4444"

SW, SH, IN = 9144000, 5143500, 914400  # slide W, H, 1 inch in EMU

# ── Low-level shape helpers ─────────────────────────────────────────────────
def rect(id_, x, y, cx, cy, fill=None):
    f = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else '<a:noFill/>'
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{id_}" name="r{id_}"/>'
            f'<p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{f}<a:ln><a:noFill/></a:ln></p:spPr>'
            f'<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>')

def para(text, sz=18, bold=False, color=DARK, align="l", spc=0, italic=False):
    b = "1" if bold else "0"; i = "1" if italic else "0"
    ppr = f'<a:pPr algn="{align}"' + (f' spcBef="{spc*127}"' if spc else '') + '/>'
    esc = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
    rpr = (f'<a:rPr lang="en-US" sz="{sz*100}" b="{b}" i="{i}" dirty="0">'
           f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
           f'<a:latin typeface="Calibri"/></a:rPr>')
    return f'<a:p>{ppr}<a:r>{rpr}<a:t xml:space="preserve">{esc}</a:t></a:r></a:p>'

def empty_para():
    return '<a:p><a:pPr/><a:endParaRPr lang="en-US" dirty="0"/></a:p>'

def tb(id_, x, y, cx, cy, paras_xml, fill=None, anchor="t", ins=91440):
    f = f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>' if fill else '<a:noFill/>'
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="{id_}" name="t{id_}"/>'
            f'<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{f}'
            f'<a:ln><a:noFill/></a:ln></p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="{ins}" rIns="{ins}" '
            f'tIns="{ins//2}" bIns="{ins//2}" anchor="{anchor}"/>'
            f'<a:lstStyle/>{paras_xml}</p:txBody></p:sp>')

def sld(*shapes):
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
            '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
            '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<p:cSld><p:spTree>'
            '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
            '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
            '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
            + ''.join(shapes) +
            '</p:spTree></p:cSld></p:sld>')

# ── Slide design templates ──────────────────────────────────────────────────
def cover(title, subtitle, tagline=""):
    """Dark navy cover slide with cyan accent bar."""
    shapes = [
        rect(2, 0, 0, SW, SH, NAVY),
        rect(3, 0, SH-int(IN*0.6), SW, int(IN*0.6), CYAN),
        tb(4, int(IN*0.6), int(IN*1.0), SW-int(IN*1.2), int(IN*1.6),
           para(title, 44, True, WHITE, "l") + empty_para()),
        tb(5, int(IN*0.6), int(IN*2.8), SW-int(IN*1.2), int(IN*0.9),
           para(subtitle, 22, False, "B8D4F0", "l")),
    ]
    if tagline:
        shapes.append(tb(6, int(IN*0.6), int(IN*3.8), SW-int(IN*1.2), int(IN*0.6),
                        para(tagline, 14, False, CYAN, "l")))
    return sld(*shapes)

def content_slide(title, body_paras_xml, header_color=BLUE, subtitle=""):
    """Standard content slide: coloured header bar + white body."""
    header_h = int(IN * 1.15)
    shapes = [
        rect(2, 0, 0, SW, SH, LIGHT),
        rect(3, 0, 0, SW, header_h, header_color),
        tb(4, int(IN*0.4), int(IN*0.15), SW-int(IN*0.8), int(IN*0.7),
           para(title, 28, True, WHITE, "l") +
           (para(subtitle, 13, False, "B8D4F0", "l") if subtitle else ""),
           anchor="ctr"),
        tb(5, int(IN*0.4), header_h+int(IN*0.15), SW-int(IN*0.8), SH-header_h-int(IN*0.2),
           body_paras_xml, anchor="t"),
    ]
    return sld(*shapes)

def two_col_slide(title, left_xml, right_xml, header_color=BLUE):
    """Two-column content slide."""
    header_h = int(IN * 1.15)
    col_w = int((SW - int(IN*0.9)) / 2)
    shapes = [
        rect(2, 0, 0, SW, SH, LIGHT),
        rect(3, 0, 0, SW, header_h, header_color),
        tb(4, int(IN*0.4), int(IN*0.15), SW-int(IN*0.8), int(IN*0.7),
           para(title, 28, True, WHITE, "l"), anchor="ctr"),
        rect(9, int(IN*0.3), header_h+int(IN*0.15), col_w, SH-header_h-int(IN*0.3), WHITE),
        rect(10, int(IN*0.3)+col_w+int(IN*0.3), header_h+int(IN*0.15), col_w, SH-header_h-int(IN*0.3), WHITE),
        tb(11, int(IN*0.4), header_h+int(IN*0.25), col_w-int(IN*0.1), SH-header_h-int(IN*0.5),
           left_xml, anchor="t"),
        tb(12, int(IN*0.5)+col_w+int(IN*0.3), header_h+int(IN*0.25), col_w-int(IN*0.1), SH-header_h-int(IN*0.5),
           right_xml, anchor="t"),
    ]
    return sld(*shapes)

def section_divider(section_num, section_title, description=""):
    """Dark section divider slide."""
    shapes = [
        rect(2, 0, 0, SW, SH, NAVY),
        rect(3, 0, 0, int(IN*0.25), SH, CYAN),
        tb(4, int(IN*0.5), int(IN*1.5), SW-int(IN*1.0), int(IN*0.6),
           para(section_num, 14, False, CYAN, "l")),
        tb(5, int(IN*0.5), int(IN*2.1), SW-int(IN*1.0), int(IN*1.2),
           para(section_title, 36, True, WHITE, "l")),
    ]
    if description:
        shapes.append(tb(6, int(IN*0.5), int(IN*3.4), SW-int(IN*1.0), int(IN*0.8),
                        para(description, 16, False, "B8D4F0", "l")))
    return sld(*shapes)

# ── Bullet helper ───────────────────────────────────────────────────────────
def bul(text, sz=17, color=DARK, indent=0, bold=False):
    bullet = "•  " if not indent else "    ▸  "
    return para(bullet + text, sz, bold, color, "l", spc=4)

def h3(text, color=BLUE):
    return para(text, 18, True, color, "l", spc=6)

def note(text):
    return para("ℹ  " + text, 13, False, GRAY, "l", spc=2)

# ── PptxBuilder class ───────────────────────────────────────────────────────
class PptxBuilder:
    RT_PRES   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    RT_MASTER = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
    RT_LAYOUT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
    RT_SLIDE  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
    RT_THEME  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
    RT_CORE   = "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"
    RT_APP    = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"

    def __init__(self, title): self.title = title; self.slides = []
    def add(self, xml): self.slides.append(xml); return self

    def _cts(self):
        over = ['<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
                '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
                '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
                '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>']
        for i in range(1, len(self.slides)+1):
            over.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
        over += ['<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
                 '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>']
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                '<Default Extension="xml" ContentType="application/xml"/>'+''.join(over)+'</Types>')

    def _root_rels(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                f'<Relationship Id="rId1" Type="{self.RT_PRES}" Target="ppt/presentation.xml"/>'
                f'<Relationship Id="rId2" Type="{self.RT_CORE}" Target="docProps/core.xml"/>'
                f'<Relationship Id="rId3" Type="{self.RT_APP}" Target="docProps/app.xml"/>'
                '</Relationships>')

    def _pres(self):
        ids = ''.join(f'<p:sldId id="{256+i}" r:id="rId{i+2}"/>' for i in range(len(self.slides)))
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
                '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
                '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
                f'<p:sldIdLst>{ids}</p:sldIdLst>'
                '<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>'
                '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>')

    def _pres_rels(self):
        rels = [f'<Relationship Id="rId1" Type="{self.RT_MASTER}" Target="slideMasters/slideMaster1.xml"/>']
        for i in range(len(self.slides)):
            rels.append(f'<Relationship Id="rId{i+2}" Type="{self.RT_SLIDE}" Target="slides/slide{i+1}.xml"/>')
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                +''.join(rels)+'</Relationships>')

    def _sld_rels(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                f'<Relationship Id="rId1" Type="{self.RT_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/>'
                '</Relationships>')

    def _master(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
                '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
                '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<p:cSld><p:spTree>'
                '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
                '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
                '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
                '</p:spTree></p:cSld>'
                '<p:txStyles>'
                '<p:titleStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:titleStyle>'
                '<p:bodyStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:bodyStyle>'
                '<p:otherStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:otherStyle>'
                '</p:txStyles>'
                '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
                '</p:sldMaster>')

    def _master_rels(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                f'<Relationship Id="rId1" Type="{self.RT_LAYOUT}" Target="../slideLayouts/slideLayout1.xml"/>'
                f'<Relationship Id="rId2" Type="{self.RT_THEME}" Target="../theme/theme1.xml"/>'
                '</Relationships>')

    def _layout(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
                '  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
                '  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
                '  type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>'
                '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
                '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
                '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
                '</p:spTree></p:cSld></p:sldLayout>')

    def _layout_rels(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                f'<Relationship Id="rId1" Type="{self.RT_MASTER}" Target="../slideMasters/slideMaster1.xml"/>'
                '</Relationships>')

    def _theme(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="OmniBlend">'
                '<a:themeElements>'
                '<a:clrScheme name="OmniBlend">'
                f'<a:dk1><a:srgbClr val="{NAVY}"/></a:dk1><a:lt1><a:srgbClr val="{WHITE}"/></a:lt1>'
                f'<a:dk2><a:srgbClr val="{BLUE}"/></a:dk2><a:lt2><a:srgbClr val="{LIGHT}"/></a:lt2>'
                f'<a:accent1><a:srgbClr val="{CYAN}"/></a:accent1>'
                f'<a:accent2><a:srgbClr val="{AMBER}"/></a:accent2>'
                f'<a:accent3><a:srgbClr val="{GREEN}"/></a:accent3>'
                f'<a:accent4><a:srgbClr val="{GRAY}"/></a:accent4>'
                f'<a:accent5><a:srgbClr val="{DARK}"/></a:accent5>'
                f'<a:accent6><a:srgbClr val="7F7F7F"/></a:accent6>'
                f'<a:hlink><a:srgbClr val="{CYAN}"/></a:hlink>'
                f'<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>'
                '</a:clrScheme>'
                '<a:fontScheme name="OmniBlend">'
                '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
                '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'
                '</a:fontScheme>'
                '<a:fmtScheme name="Office">'
                '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
                '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
                '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
                '<a:lnStyleLst>'
                '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
                '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
                '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
                '</a:lnStyleLst>'
                '<a:effectStyleLst>'
                '<a:effectStyle><a:effectLst/></a:effectStyle>'
                '<a:effectStyle><a:effectLst/></a:effectStyle>'
                '<a:effectStyle><a:effectLst/></a:effectStyle>'
                '</a:effectStyleLst>'
                '<a:bgFillStyleLst>'
                '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
                '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
                '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
                '</a:bgFillStyleLst></a:fmtScheme>'
                '</a:themeElements></a:theme>')

    def _core(self):
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
                '  xmlns:dc="http://purl.org/dc/elements/1.1/"'
                '  xmlns:dcterms="http://purl.org/dc/terms/"'
                '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
                f'<dc:title>{self.title}</dc:title><dc:creator>OmniBlend</dc:creator>'
                f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
                f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
                '</cp:coreProperties>')

    def _app(self):
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
                f'<Application>OmniBlend</Application><Slides>{len(self.slides)}</Slides>'
                '</Properties>')

    def save(self, path):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml',              self._cts())
            z.writestr('_rels/.rels',                      self._root_rels())
            z.writestr('ppt/presentation.xml',             self._pres())
            z.writestr('ppt/_rels/presentation.xml.rels',  self._pres_rels())
            z.writestr('ppt/theme/theme1.xml',             self._theme())
            z.writestr('ppt/slideMasters/slideMaster1.xml',     self._master())
            z.writestr('ppt/slideMasters/_rels/slideMaster1.xml.rels', self._master_rels())
            z.writestr('ppt/slideLayouts/slideLayout1.xml',     self._layout())
            z.writestr('ppt/slideLayouts/_rels/slideLayout1.xml.rels', self._layout_rels())
            for i, s in enumerate(self.slides, 1):
                z.writestr(f'ppt/slides/slide{i}.xml',          s)
                z.writestr(f'ppt/slides/_rels/slide{i}.xml.rels', self._sld_rels())
            z.writestr('docProps/core.xml', self._core())
            z.writestr('docProps/app.xml',  self._app())
        with open(path, 'wb') as f: f.write(buf.getvalue())
        print(f"  ✓ {os.path.basename(path)}  ({os.path.getsize(path):,} bytes, {len(self.slides)} slides)")


# ════════════════════════════════════════════════════════════════════════════
# PRESENTATION 1 — OmniBlend Pitch Deck
# ════════════════════════════════════════════════════════════════════════════
p1 = PptxBuilder("OmniBlend — Pitch Deck")

# S1 Cover
p1.add(cover("OmniBlend",
             "Industry 4.0 Digital Twin Platform for Lube Oil Blending Plants",
             "One platform. Real-time data. Intelligent decisions."))

# S2 The Challenge
p1.add(content_slide("The Challenge",
    bul("Data fragmented across SCADA, LIMS, ERP and spreadsheets — no single source of truth", 17) +
    bul("Quality issues discovered after batches are complete, not before", 17) +
    bul("No real-time visibility into what is happening on the plant floor", 17) +
    bul("Manual shift reports and spreadsheets creating compliance and audit risk", 17) +
    bul("Inaccurate batch costing — material consumption not reconciled against actual prices", 17) +
    bul("Unplanned downtime with no predictive maintenance capability", 17),
    header_color=NAVY))

# S3 The Solution
p1.add(content_slide("Introducing OmniBlend",
    para("A unified digital twin simulator and integration platform that connects your entire "
         "lube oil blending plant into one intelligent command centre.", 17, False, DARK) +
    empty_para() +
    h3("Four Foundational Pillars", BLUE) +
    bul("Real-Time OT/IT Bridge — live SCADA, LIMS and ERP data streaming in under 2 seconds", 16) +
    bul("AI-Powered Quality Prediction — predict viscosity, flash point and TBN before batches complete", 16) +
    bul("Full Batch Traceability — raw material to Certificate of Analysis in one audit trail", 16) +
    bul("Operational Intelligence — KPIs, cost optimisation and alerts in a single command centre", 16),
    header_color=NAVY))

# S4 Seven Modules overview
p1.add(content_slide("Seven Integrated Modules",
    h3("1.  Command Dashboard", BLUE) +
    bul("Real-time KPIs, live event feed, equipment health, energy heatmap and production timeline", 15) +
    h3("2.  Blend Simulator", BLUE) +
    bul("Batch lifecycle management — queued through to completed — with live temperature and RPM", 15) +
    h3("3.  Tank Digital Twin", BLUE) +
    bul("Visual tank farm: 12 tanks with fill levels, temperatures, material types and status alerts", 15) +
    h3("4.  Recipe Lab", BLUE) +
    bul("AI-assisted formulation design with predicted viscosity, flash point, TBN and cost", 15),
    header_color=NAVY))

# S4b (continuation — next 3 modules)
p1.add(content_slide("Seven Integrated Modules (continued)",
    h3("5.  Quality AI Engine", BLUE) +
    bul("Live quality predictions, off-spec risk meter, confidence intervals and AI recommendations", 15) +
    h3("6.  Supply & Cost Optimizer", BLUE) +
    bul("Multi-supplier comparison with live pricing, lead times, reliability scores and AI-optimised mix", 15) +
    h3("7.  AI Control Panel", BLUE) +
    bul("Natural language commands, what-if scenario analysis and cross-module intelligence", 15) +
    empty_para() +
    note("All modules are fully built and running as a simulator today, ready for live data integration."),
    header_color=NAVY))

# S5 Command Dashboard
p1.add(content_slide("1. Command Dashboard",
    para("Central operations overview — the single screen every shift manager needs.", 16, False, SLATE) +
    empty_para() +
    bul("Production Volume, Cost per Batch, Energy Usage, Equipment Utilisation and On-Spec Rate KPIs") +
    bul("Live event feed — SCADA alarms, lab alerts and ERP notifications in one stream") +
    bul("Equipment health meters with predictive maintenance indicators") +
    bul("Energy consumption heatmap across all equipment, 24 hours a day") +
    bul("Operations timeline showing every batch from start to completion")))

# S6 Blend Simulator
p1.add(content_slide("2. Blend Simulator",
    para("Real-time batch management through every stage of the blending process.", 16, False, SLATE) +
    empty_para() +
    bul("Full batch lifecycle: Queued  →  Mixing  →  Sampling  →  Lab  →  Completed") +
    bul("Live temperature and mixing speed (RPM) monitoring per batch") +
    bul("Animated pipeline flow showing material movement between tanks and blenders") +
    bul("Ingredient sequence display with per-component progress tracking") +
    bul("Batch alerts for temperature deviation, quality hold or equipment fault")))

# S7 Tank Digital Twin
p1.add(content_slide("3. Tank Digital Twin",
    para("A virtual replica of your entire tank farm with live fill levels and conditions.", 16, False, SLATE) +
    empty_para() +
    bul("All 12 tanks displayed with animated fill levels and real-time temperature") +
    bul("Material type per tank: base oil, viscosity modifier, additives, finished product") +
    bul("Status monitoring: Normal, Low, Critical, Filling, Draining, Offline") +
    bul("Low-stock alerts with visual indicators before shortages impact production") +
    bul("Drag-and-drop tank allocation for material planning")))

# S8 Recipe Lab
p1.add(content_slide("4. Recipe Lab",
    para("AI-assisted lubricant formulation design with instant quality and cost predictions.", 16, False, SLATE) +
    empty_para() +
    bul("Ingredient sliders for base oil, viscosity modifier, antioxidant, detergent and PPD") +
    bul("Real-time AI predictions: Viscosity (KV40/KV100), Flash Point and TBN") +
    bul("Cost per litre calculation with supplier pricing integration") +
    bul("Three AI optimisation modes: Cost-focused, Quality-focused, Balanced") +
    bul("Recipe library with version control and side-by-side comparison")))

# S9 Quality AI Engine
p1.add(content_slide("5. Quality AI Engine",
    para("Predict quality failures before they happen — not after the batch is complete.", 16, False, SLATE) +
    empty_para() +
    bul("Live prediction streams for viscosity, flash point and TBN with confidence intervals") +
    bul("Off-spec risk meter (0–100%) with colour-coded alert levels") +
    bul("AI recommendations: adjust ingredient percentages, modify temperature or mixing speed") +
    bul("Predicted vs actual comparison panel — tracks model accuracy per batch") +
    bul("Automatic batch hold notification on off-spec risk threshold breach")))

# S10 Supply & Cost Optimizer
p1.add(content_slide("6. Supply & Cost Optimizer",
    para("Smart procurement decisions based on price, lead time, quality and reliability.", 16, False, SLATE) +
    empty_para() +
    bul("Multi-supplier selection with per-product quality grade (A+, A, B+, B, C)") +
    bul("Price per litre and lead time comparison across all suppliers") +
    bul("Supplier reliability score based on historical on-time delivery performance") +
    bul("AI-optimised supplier mix — balance cost, quality and delivery risk") +
    bul("Dynamic cost breakdown showing spend by material category")))

# S11 AI Control Panel
p1.add(content_slide("7. AI Control Panel",
    para("Command the entire plant using plain English — ask questions, run scenarios, inject events.", 16, False, SLATE) +
    empty_para() +
    bul("Natural language interface: 'Start blend B101', 'Optimise recipe for cost'") +
    bul("What-if scenario comparison — run two configurations side by side") +
    bul("Event injection for training: simulate equipment failure, material shortage, quality deviation") +
    bul("Quick command library covering the most common plant operations") +
    bul("Powered by Claude API (Anthropic) for accurate intent parsing and response")))

# S12 The Journey — From Simulator to Production
p1.add(content_slide("From Simulator to Production  —  26-Week Roadmap",
    para("The simulator is fully built and ready. The 26-week plan connects it to your real plant.", 15, False, SLATE) +
    empty_para() +
    h3("Weeks 1–6    Foundation", NAVY) +
    bul("Production-grade infrastructure, security, authentication and audit logging", 15) +
    h3("Weeks 5–14   Live Data Connections", BLUE) +
    bul("SCADA / OPC-UA bridge for tanks and blenders  |  LIMS integration for lab results", 15) +
    h3("Weeks 12–20  Business Systems", BLUE) +
    bul("ERP / MES sync for recipes and production orders  |  Live supplier pricing feed", 15) +
    h3("Weeks 18–26  Intelligence & Go-Live", CYAN) +
    bul("Real ML models trained on your data  |  Full go-live with 4-week hypercare", 15) +
    note("Timelines are tentative and will be confirmed during the Assessment phase."),
    header_color=NAVY))

# S13 Key Benefits
p1.add(two_col_slide("Key Benefits",
    h3("Operational", BLUE) +
    bul("Single source of truth — end of spreadsheets", 15) +
    bul("Real-time plant visibility for shift managers", 15) +
    bul("Batch traceability from raw material to COA", 15) +
    bul("Predictive maintenance reduces unplanned downtime", 15) +
    empty_para() +
    h3("Commercial", BLUE) +
    bul("Accurate cost-per-batch with live pricing", 15) +
    bul("AI-optimised supplier mix lowers material cost", 15) +
    bul("Faster COA generation — hours to minutes", 15),
    h3("Quality", GREEN) +
    bul("Predict off-spec batches before they complete", 15) +
    bul("Reduce out-of-spec batch rate with AI guidance", 15) +
    bul("LIMS-connected quality archive for ML training", 15) +
    empty_para() +
    h3("Compliance", AMBER) +
    bul("Instant audit-ready batch genealogy records", 15) +
    bul("IEC 62443-compliant OT/IT security architecture", 15) +
    bul("Version-controlled standards and COA vault", 15),
    header_color=NAVY))

# S14 Next Steps
p1.add(content_slide("Ready to Start?",
    h3("Step 1  —  Assessment & Discovery  (2 weeks)", CYAN) +
    bul("Current-state review of systems, data readiness, and plant processes", 16) +
    h3("Step 2  —  Infrastructure & Security  (Weeks 1–6)", BLUE) +
    bul("Cloud or on-premise deployment, authentication, RBAC, IEC 62443 security", 16) +
    h3("Step 3  —  Live Data Connections  (Weeks 5–14)", BLUE) +
    bul("SCADA bridge for tanks and blenders, LIMS integration for lab results", 16) +
    h3("Step 4  —  Business Systems & Intelligence  (Weeks 12–24)", BLUE) +
    bul("ERP sync, supplier pricing, ML model training on your historical data", 16) +
    h3("Step 5  —  Go-Live & Hypercare  (Weeks 22–26)", GREEN) +
    bul("Phased cutover from simulator sources to live data, 4-week on-site hypercare", 16),
    header_color=NAVY))

p1.save("/home/user/LubeOilSim/OmniBlend_Pitch_Deck.pptx")


# ════════════════════════════════════════════════════════════════════════════
# PRESENTATION 2 — Assessment Toolkit
# ════════════════════════════════════════════════════════════════════════════
p2 = PptxBuilder("OmniBlend — Assessment Toolkit")

# S1 Cover
p2.add(cover("OmniBlend Assessment Toolkit",
             "Evaluating Your Plant's Readiness for Digital Transformation",
             "Conducted prior to implementation — typically 2 weeks on-site and remote"))

# S2 Purpose
p2.add(content_slide("Purpose of This Assessment",
    para("This toolkit is used in the pre-implementation Discovery phase to understand your plant's "
         "current state and determine the most effective entry point into the OmniBlend programme.", 17, False, DARK) +
    empty_para() +
    h3("What the Assessment Covers", BLUE) +
    bul("Operational context — how your plant runs today") +
    bul("Technology and systems inventory — what you have and how it is connected") +
    bul("Data readiness — quality, availability and accessibility of key plant data") +
    bul("KPI baseline — current performance before OmniBlend is applied") +
    bul("People and process — roles, skills and current workflows") +
    empty_para() +
    h3("Output", GREEN) +
    bul("A readiness score, gap summary and recommended phased entry point into the 26-week plan"),
    header_color=NAVY))

# S3 Section 1 — Operational Context
p2.add(section_divider("SECTION 1", "Operational Context",
                        "Understanding how the plant operates today"))

p2.add(content_slide("Section 1 — Operational Context",
    h3("Blending Operations", BLUE) +
    bul("How many blending vessels / batches per day on average?") +
    bul("What product grades are produced? (automotive, industrial, marine, specialty)") +
    bul("What is the average batch size (litres) and typical cycle time?") +
    empty_para() +
    h3("Current Reporting & Visibility", BLUE) +
    bul("How is shift handover information currently communicated?") +
    bul("How long does it take to compile a shift report?") +
    bul("How is batch genealogy currently recorded and stored?") +
    empty_para() +
    h3("Pain Points", AMBER) +
    bul("What are the top 3 operational problems the team faces today?") +
    bul("What data do you wish you had, but currently do not?")))

# S4 Section 2 — Systems Inventory
p2.add(section_divider("SECTION 2", "Systems & Technology Inventory",
                        "Mapping what systems are in place and how they connect"))

p2.add(content_slide("Section 2 — Systems & Technology Inventory",
    h3("OT Layer (Plant Floor)", BLUE) +
    bul("SCADA system: vendor, version, OPC-UA capability? (Yes / No / Unknown)") +
    bul("DCS / PLC: make, model, communication protocols available?") +
    bul("Tank instrumentation: level transmitters, thermocouples — make and model?") +
    bul("Flow meters and blender instruments connected to SCADA? (Yes / Partial / No)") +
    empty_para() +
    h3("IT Layer (Business Systems)", BLUE) +
    bul("ERP system: SAP, Oracle, custom or spreadsheet-based?") +
    bul("LIMS: which system, version, and does it expose an API or webhook?") +
    bul("Recipe management: stored in ERP, standalone system or spreadsheets?") +
    bul("Supplier pricing: EDI feeds, supplier portals or manual entry?")))

# S5 Section 3 — Data Readiness
p2.add(section_divider("SECTION 3", "Data Readiness",
                        "Assessing the quality and accessibility of key data"))

p2.add(content_slide("Section 3 — Data Readiness Scorecard",
    h3("Rate each area:  1 = Not available   3 = Partial   5 = Fully available & accessible", GRAY) +
    empty_para() +
    bul("Tank level and temperature data — digital, in SCADA, and historically archived") +
    bul("Batch records — structured, per batch_id, with ingredient quantities and timestamps") +
    bul("Lab results — per batch, structured, signed off in LIMS with ASTM method references") +
    bul("Recipe formulations — version-controlled, with ingredient percentages and specs") +
    bul("Supplier pricing — current price lists available in a machine-readable format") +
    bul("Equipment maintenance history — structured records with fault codes and downtime") +
    bul("Production orders — linked to batch records in ERP with material consumption actuals") +
    empty_para() +
    note("Minimum recommended score to begin Phase 3 (SCADA bridge): Data Readiness ≥ 3 across OT layer.")))

# S6 Section 4 — KPI Baseline
p2.add(section_divider("SECTION 4", "KPI Baseline Capture",
                        "Recording current performance before OmniBlend is applied"))

p2.add(content_slide("Section 4 — KPI Baseline",
    para("These baselines will become the benchmark against which OmniBlend ROI is measured.", 15, False, SLATE) +
    empty_para() +
    h3("Capture the following (estimate if exact data is not available):", BLUE) +
    bul("Out-of-spec batch rate  (% of batches failing QC per month)") +
    bul("Shift report compile time  (minutes from shift end to report distributed)") +
    bul("Batch traceability time  (time to compile full batch genealogy for an audit query)") +
    bul("COA generation time  (hours from batch release to COA dispatched to customer)") +
    bul("SCADA-to-decision latency  (current lag between plant event and management awareness)") +
    bul("Manual spreadsheet count  (number of active production spreadsheets in circulation)") +
    bul("Unplanned downtime  (hours per month across all blending equipment)")))

# S7 Section 5 — People & Process
p2.add(section_divider("SECTION 5", "People & Process",
                        "Understanding roles, skills and change readiness"))

p2.add(content_slide("Section 5 — People & Process",
    h3("Roles & Ownership", BLUE) +
    bul("Who owns plant data today — IT, OT or Operations?") +
    bul("Is there an IT/OT liaison role, or are IT and OT teams siloed?") +
    bul("Who is the business sponsor for this digital transformation?") +
    empty_para() +
    h3("Skills Assessment", BLUE) +
    bul("Level of familiarity with OPC-UA and SCADA data extraction on the OT team") +
    bul("LIMS administrator available to support API or webhook configuration?") +
    bul("SAP BASIS or functional consultant available for ERP integration activities?") +
    empty_para() +
    h3("Change Readiness", AMBER) +
    bul("How receptive is the operations team to new digital tools?") +
    bul("Have previous digitalisation projects succeeded or struggled? What were the lessons?")))

# S8 Scoring Matrix
p2.add(content_slide("Assessment Scoring Matrix",
    h3("Score each section 1–5.  Total score determines recommended entry point.", BLUE) +
    empty_para() +
    para("SECTION 1  Operational Context       _____ / 5", 16, False, DARK) +
    para("SECTION 2  Systems Inventory          _____ / 5", 16, False, DARK) +
    para("SECTION 3  Data Readiness             _____ / 5", 16, False, DARK) +
    para("SECTION 4  KPI Baseline               _____ / 5", 16, False, DARK) +
    para("SECTION 5  People & Process           _____ / 5", 16, False, DARK) +
    empty_para() +
    para("TOTAL READINESS SCORE                 _____ / 25", 20, True, NAVY) +
    empty_para() +
    para("20–25  →  Full 26-week programme, start Phase 1 immediately", 15, False, GREEN) +
    para("14–19  →  Begin with 4-week pre-work sprint before Phase 1", 15, False, AMBER) +
    para("Below 14  →  Discovery extension recommended before committing to timeline", 15, False, RED)))

# S9 Output
p2.add(content_slide("Assessment Output",
    h3("What you receive after the Assessment:", BLUE) +
    empty_para() +
    bul("Current State Report — systems map, data inventory, gap summary") +
    bul("Readiness Score with section-by-section commentary") +
    bul("KPI Baseline Document — signed off by plant and management") +
    bul("Recommended Phase Entry Point — which Phase 1–8 activities begin first") +
    bul("Risk Register — top 5 implementation risks with suggested mitigations") +
    bul("Indicative Project Plan — week-by-week tentative schedule tailored to your plant") +
    empty_para() +
    note("Assessment findings are confidential and shared only with nominated stakeholders.") +
    note("Timeline is tentative and will be confirmed following Assessment completion."),
    header_color=NAVY))

# S10 Next Steps
p2.add(content_slide("Next Steps",
    h3("To schedule your Assessment:", CYAN) +
    empty_para() +
    bul("Nominate an Assessment Coordinator from your operations or IT team", 17) +
    bul("Provide access to SCADA system documentation and plant P&IDs", 17) +
    bul("Arrange 2–3 hours of time with the LIMS administrator and ERP team", 17) +
    bul("Share any existing KPI reports or shift reports for baseline context", 17) +
    empty_para() +
    h3("Typical Assessment Duration:", BLUE) +
    bul("Week 1 — Document review and remote interviews", 17) +
    bul("Week 2 — On-site walkthroughs, system access checks, scoring and report", 17) +
    empty_para() +
    note("All timelines are tentative estimates and subject to change based on plant availability."),
    header_color=NAVY))

p2.save("/home/user/LubeOilSim/OmniBlend_Assessment_Toolkit.pptx")


# ════════════════════════════════════════════════════════════════════════════
# PRESENTATION 3 — Implementation: Technical & Commercial
# ════════════════════════════════════════════════════════════════════════════
p3 = PptxBuilder("OmniBlend — Implementation: Technical & Commercial")

# S1 Cover
p3.add(cover("OmniBlend Implementation",
             "Technical & Commercial Overview",
             "26-Week Digital Transformation Programme  |  Lube Oil Blending Plants"))

# S2 Implementation Approach
p3.add(content_slide("Implementation Approach",
    para("OmniBlend follows a structured 8-phase programme designed to de-risk delivery, "
         "demonstrate value early, and build toward full production integration.", 16, False, DARK) +
    empty_para() +
    h3("Guiding Principles", BLUE) +
    bul("Simulator-first — all 7 modules are live on day one, populated with real data progressively") +
    bul("Phase-gated — each phase has clear criteria before the next begins") +
    bul("Security-first — no live plant data until infrastructure and security phases pass") +
    bul("Non-disruptive — existing systems continue operating throughout; OmniBlend runs in parallel") +
    empty_para() +
    h3("Programme Structure", BLUE) +
    bul("8 phases over 26 weeks (approximately 6 calendar months)") +
    bul("Phases 1–2 run in parallel; remaining phases follow a defined critical path") +
    note("All timelines stated in this document are tentative estimates. Final schedule confirmed post-Assessment."),
    header_color=NAVY))

# S3 26-Week Roadmap
p3.add(content_slide("26-Week Roadmap Overview",
    para("Tentative timeline — to be confirmed following Assessment completion.", 14, True, AMBER) +
    empty_para() +
    para("Weeks  1–4    PHASE 1  Infrastructure Foundation", 16, True, NAVY) +
    para("Weeks  3–6    PHASE 2  Security Hardening  (parallel with P1)", 16, True, NAVY) +
    para("Weeks  5–10   PHASE 3  SCADA / OPC-UA Bridge", 16, True, BLUE) +
    para("Weeks  8–14   PHASE 4  LIMS Integration", 16, True, BLUE) +
    para("Weeks 12–18   PHASE 5  MES / ERP Sync", 16, True, SLATE) +
    para("Weeks 16–20   PHASE 6  Supplier Pricing Feed", 16, True, SLATE) +
    para("Weeks 18–24   PHASE 7  ML Model Training Pipeline", 16, True, CYAN) +
    para("Weeks 22–26   PHASE 8  Time-Series DB & Go-Live", 16, True, GREEN),
    header_color=NAVY))

# S4 Phase 1 & 2 — Foundation
p3.add(section_divider("PHASES 1 & 2  |  Weeks 1–6", "Foundation & Security",
                        "PREREQUISITE — no live plant data until both phases pass"))

p3.add(two_col_slide("Phases 1 & 2  —  Foundation & Security",
    h3("Phase 1  —  Infrastructure  (Weeks 1–4)", BLUE) +
    bul("Cloud or on-premise Kubernetes cluster deployment", 15) +
    bul("PostgreSQL with TimescaleDB extension for time-series data", 15) +
    bul("Redis for real-time WebSocket streaming", 15) +
    bul("SSL/HTTPS across all endpoints", 15) +
    bul("Dev / Staging / Production environment isolation", 15) +
    bul("Load testing to confirm WebSocket capacity", 15),
    h3("Phase 2  —  Security  (Weeks 3–6)", AMBER) +
    bul("OAuth2 / JWT authentication (Keycloak, Auth0 or AWS Cognito)", 15) +
    bul("Role-based access: Operator, Engineer, Manager, Read-Only", 15) +
    bul("VPN tunnel between plant network and application", 15) +
    bul("IEC 62443 five-zone network security model", 15) +
    bul("Immutable audit log for all batch and quality writes", 15) +
    bul("Penetration test sign-off before Phase 3 begins", 15),
    header_color=NAVY))

# S6 Phase 3 & 4
p3.add(section_divider("PHASES 3 & 4  |  Weeks 5–14", "Live Data Connections",
                        "CRITICAL PATH — SCADA and LIMS are the foundation of all ML and ERP phases"))

p3.add(two_col_slide("Phases 3 & 4  —  Live Data Connections",
    h3("Phase 3  —  SCADA / OPC-UA Bridge  (Weeks 5–10)", BLUE) +
    bul("OPC-UA tag audit — all 12 tank level and temperature sensors mapped", 15) +
    bul("Live tank fill levels and temperatures replace simulated values", 15) +
    bul("Blender RPM and temperature from VFD and thermocouple", 15) +
    bul("Pipeline flow animations driven by real flow meter readings", 15) +
    bul("SCADA alarms forwarded to Live Event Feed within 60 seconds", 15) +
    bul("Bridge uptime monitoring — target greater than 99.5%", 15),
    h3("Phase 4  —  LIMS Integration  (Weeks 8–14)", AMBER) +
    bul("LIMS API mapping — webhook or polling connector deployed", 15) +
    bul("Lab results (viscosity, flash point, TBN) ingested within 5 minutes of sign-off", 15) +
    bul("Predicted vs Actual comparison panel activated", 15) +
    bul("On-Spec Rate KPI now sourced from LIMS — not simulated", 15) +
    bul("Off-spec batch hold notifications activated", 15) +
    bul("LIMS archive accumulating for ML model training", 15),
    header_color=NAVY))

# S8 Phase 5 & 6
p3.add(section_divider("PHASES 5 & 6  |  Weeks 12–20", "Business Systems Integration",
                        "ERP sync and live supplier pricing complete the commercial data layer"))

p3.add(two_col_slide("Phases 5 & 6  —  Business Systems",
    h3("Phase 5  —  MES / ERP Sync  (Weeks 12–18)", BLUE) +
    bul("SAP RFC / BAPI or OData adapter deployed", 15) +
    bul("Production orders auto-import — manual creation retired", 15) +
    bul("Recipe formulations sync from SAP PP-PI — seed recipes retired", 15) +
    bul("Batch completion events close MES production orders", 15) +
    bul("Material consumption actuals posted back to SAP for cost settlement", 15) +
    bul("Operations timeline now reflects real MES production history", 15),
    h3("Phase 6  —  Supplier Pricing Feed  (Weeks 16–20)", AMBER) +
    bul("EDI or supplier REST API pipeline with daily price ingestion", 15) +
    bul("Recipe Lab cost-per-litre sourced from live supplier feed", 15) +
    bul("Cost per Batch KPI now uses real material and energy costs", 15) +
    bul("Lead times sourced from ERP PO history — not hardcoded", 15) +
    bul("Reliability scores calculated from ERP on-time delivery (12-month rolling)", 15) +
    bul("Supply Optimizer producing actionable recommendations", 15),
    header_color=NAVY))

# S10 Phase 7 & 8
p3.add(section_divider("PHASES 7 & 8  |  Weeks 18–26", "Intelligence Layer & Go-Live",
                        "Real ML models trained on your data, then full production cutover"))

p3.add(two_col_slide("Phases 7 & 8  —  Intelligence & Go-Live",
    h3("Phase 7  —  ML Training Pipeline  (Weeks 18–24)", CYAN) +
    bul("Data extraction from LIMS and SCADA (200+ batches required)", 15) +
    bul("Viscosity predictor — GradientBoosting, target R² > 0.92", 15) +
    bul("Flash Point predictor — Neural Network, target R² > 0.92", 15) +
    bul("TBN predictor — RandomForest Regressor, target R² > 0.92", 15) +
    bul("Off-spec Risk Classifier — XGBoost, false negative rate < 5%", 15) +
    bul("AI Recipe Optimiser with constrained optimisation", 15) +
    bul("ML drift monitoring with automatic retraining alerts", 15),
    h3("Phase 8  —  Go-Live  (Weeks 22–26)", GREEN) +
    bul("Energy Heatmap connected to real BMS meter readings", 15) +
    bul("AI Control Panel upgraded to Claude API (natural language)", 15) +
    bul("APM monitoring with SLO dashboards (API latency, WebSocket, DB)", 15) +
    bul("Log aggregation and on-call alerting configured", 15) +
    bul("Operator training for all four roles", 15) +
    bul("Phased cutover — simulated data sources retired sequentially", 15) +
    bul("4-week hypercare with on-site support", 15),
    header_color=NAVY))

# S12 Technical Architecture
p3.add(content_slide("Technical Architecture",
    h3("Frontend", BLUE) +
    bul("React + TypeScript — modular, one component per module") +
    bul("Tailwind CSS with glassmorphism design, animated pipelines and 3D tank visualisation") +
    bul("Recharts for real-time charts  |  Zustand for global state management") +
    empty_para() +
    h3("Backend", BLUE) +
    bul("FastAPI (Python) — REST and WebSocket API, 48+ endpoints") +
    bul("PostgreSQL with TimescaleDB — batch, quality, tank and equipment data") +
    bul("Redis — real-time pub/sub for WebSocket streaming") +
    bul("Celery — background task queue for simulation and ingestion jobs") +
    empty_para() +
    h3("AI / ML", CYAN) +
    bul("Scikit-learn / TensorFlow — viscosity, flash point, TBN and off-spec models") +
    bul("Claude API (Anthropic) — natural language command parsing in AI Control Panel"),
    header_color=NAVY))

# S13 Integration Landscape
p3.add(content_slide("Integration Landscape",
    h3("OT Layer  (Phase 3)", BLUE) +
    bul("SCADA / DCS  →  OPC-UA bridge  →  FastAPI  →  WebSocket  →  Dashboard") +
    bul("Tank level + temperature, blender RPM + temp, flow meters, alarms") +
    empty_para() +
    h3("Quality Layer  (Phase 4)", BLUE) +
    bul("LIMS  →  Webhook / REST connector  →  Quality AI Engine + Dashboard On-Spec KPI") +
    bul("Viscosity (ASTM D445), Flash Point (PM), TBN (ASTM D2896)  — results in < 5 minutes") +
    empty_para() +
    h3("Business Layer  (Phases 5 & 6)", BLUE) +
    bul("SAP PP-PI  →  RFC / BAPI  →  Recipe Lab and Blend Simulator") +
    bul("SAP MM  →  OData  →  Supplier lead times and reliability scores") +
    bul("Supplier portals / EDI  →  API pipeline  →  Recipe Lab and Supply Optimizer") +
    empty_para() +
    h3("Intelligence Layer  (Phase 7)", CYAN) +
    bul("LIMS + SCADA historian  →  ML training pipeline  →  Quality AI Engine + Recipe Lab"),
    header_color=NAVY))

# S14 Commercial Model
p3.add(content_slide("Commercial Model",
    para("OmniBlend is delivered as a professional services and platform engagement.", 16, False, SLATE) +
    empty_para() +
    h3("Engagement Components", BLUE) +
    bul("Discovery & Assessment  —  fixed fee, 2-week engagement") +
    bul("Implementation Programme  —  time and materials across 8 phases, 26 weeks") +
    bul("Platform Licence  —  annual subscription covering software, updates and support") +
    bul("Hypercare  —  4 weeks included post go-live; extended support available") +
    empty_para() +
    h3("What Determines Cost", AMBER) +
    bul("Number of blending lines and tanks in scope") +
    bul("SCADA, LIMS and ERP systems already in place vs requiring procurement") +
    bul("Cloud-hosted vs on-premise deployment preference") +
    bul("ML model training data availability and quality") +
    empty_para() +
    note("A detailed commercial proposal is issued following Assessment completion."),
    header_color=NAVY))

# S15 Risk & Mitigation
p3.add(content_slide("Key Risks & Mitigations",
    h3("Risk 1  —  SCADA / OPC-UA Access", RED) +
    bul("Risk: OT team reluctant to grant network access to IT layer") +
    bul("Mitigation: IEC 62443 zone model + unidirectional data diode in OT/DMZ") +
    h3("Risk 2  —  LIMS API Availability", AMBER) +
    bul("Risk: LIMS vendor does not expose a webhook or REST API") +
    bul("Mitigation: Polling connector or database-level extract as fallback") +
    h3("Risk 3  —  Insufficient ML Training Data", AMBER) +
    bul("Risk: Fewer than 200 historical batches with complete LIMS results") +
    bul("Mitigation: Phase 7 delayed until archive accumulates; simulated models extended") +
    h3("Risk 4  —  Change Adoption", AMBER) +
    bul("Risk: Operations team continues to use spreadsheets in parallel") +
    bul("Mitigation: Phased cutover, role-specific training, champion identified per shift") +
    note("Full risk register produced during Assessment phase with plant-specific mitigations."),
    header_color=NAVY))

# S16 Next Steps
p3.add(content_slide("Next Steps",
    h3("To progress to Implementation:", CYAN) +
    empty_para() +
    bul("Complete the Assessment Toolkit (2-week Discovery engagement)", 17) +
    bul("Confirm cloud vs on-premise deployment preference", 17) +
    bul("Identify IT/OT liaison and business sponsor", 17) +
    bul("Confirm SAP, LIMS and SCADA access for integration planning", 17) +
    bul("Review and approve commercial proposal following Assessment output", 17) +
    empty_para() +
    h3("Workstream Kickoff (Week 1 of Programme):", BLUE) +
    bul("DevOps engineer begins cloud provisioning", 17) +
    bul("IT Security team begins OAuth2 / IEC 62443 security design", 17) +
    bul("OT engineer begins OPC-UA tag audit with SCADA team", 17) +
    empty_para() +
    note("All timelines are tentative estimates and will be confirmed post-Assessment."),
    header_color=NAVY))

p3.save("/home/user/LubeOilSim/OmniBlend_Implementation_Technical_Commercial.pptx")

print("\nAll presentations created successfully.")
