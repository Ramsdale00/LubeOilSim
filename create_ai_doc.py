"""
OmniBlend AI Engine — Technical Model Architecture Document
Generates a professionally formatted .docx using direct OOXML / zipfile (no python-docx required).
Mirrors the structure of the CAT Synapse wildfire patent filing document.
"""

import zipfile, os, io

# ── OOXML content_types ───────────────────────────────────────────────────────

CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

WORD_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>'''

SETTINGS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>'''

# ── Colours ───────────────────────────────────────────────────────────────────
NAVY   = "1F3864"
BLUE   = "2E75B6"
CYAN   = "00B0F0"
WHITE  = "FFFFFF"
LIGHT  = "D6E4F0"
GRAY   = "595959"
AMBER  = "C55A11"
GREEN  = "375623"
RED    = "C00000"

# ── XML helpers ───────────────────────────────────────────────────────────────

def esc(s):
    return (s.replace("&","&amp;").replace("<","&lt;")
             .replace(">","&gt;").replace('"',"&quot;"))

def shading(fill, color="auto"):
    return f'<w:shd w:val="clear" w:color="{color}" w:fill="{fill}"/>'

def bold_run(text, size=20, color=None, italic=False):
    col = f'<w:color w:val="{color}"/>' if color else ''
    ital = '<w:i/>' if italic else ''
    return f'''<w:r>
      <w:rPr><w:b/>{ital}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>{col}</w:rPr>
      <w:t xml:space="preserve">{esc(text)}</w:t></w:r>'''

def normal_run(text, size=19, color=None, italic=False, bold=False):
    col = f'<w:color w:val="{color}"/>' if color else ''
    ital = '<w:i/>' if italic else ''
    bld  = '<w:b/>' if bold else ''
    return f'''<w:r>
      <w:rPr>{bld}{ital}<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>{col}</w:rPr>
      <w:t xml:space="preserve">{esc(text)}</w:t></w:r>'''

def para(runs, align="left", space_before=0, space_after=100, indent=None):
    ind = f'<w:ind w:left="{indent}"/>' if indent else ''
    return f'''<w:p>
    <w:pPr>
      <w:jc w:val="{align}"/>
      <w:spacing w:before="{space_before}" w:after="{space_after}"/>
      {ind}
    </w:pPr>
    {''.join(runs)}
  </w:p>'''

def heading(text, level=1):
    size = {1: 28, 2: 24, 3: 22}.get(level, 22)
    col  = {1: NAVY, 2: BLUE, 3: BLUE}.get(level, NAVY)
    return f'''<w:p>
    <w:pPr>
      <w:pStyle w:val="Heading{level}"/>
      <w:spacing w:before="200" w:after="80"/>
    </w:pPr>
    {bold_run(text, size=size, color=col)}
  </w:p>'''

def bullet(text, size=19, indent=360):
    return f'''<w:p>
    <w:pPr>
      <w:ind w:left="{indent}" w:hanging="180"/>
      <w:spacing w:before="0" w:after="60"/>
    </w:pPr>
    {normal_run("• ", size=size, bold=True, color=NAVY)}{normal_run(text, size=size)}
  </w:p>'''

def table_row(cells, header=False, fill=None):
    f = fill if fill else (NAVY if header else WHITE)
    txt_col = WHITE if header or fill == NAVY else "000000"
    tcs = ""
    for (txt, w_pct) in cells:
        bld = header or fill == NAVY
        tcs += f'''<w:tc>
        <w:tcPr><w:tcW w:w="{w_pct}" w:type="pct"/>{shading(f, txt_col)}</w:tcPr>
        <w:p><w:pPr><w:spacing w:before="40" w:after="40"/>
          <w:jc w:val="left"/></w:pPr>
          {bold_run(esc(txt), size=18, color=txt_col) if bld else normal_run(esc(txt), size=18, color=txt_col)}
        </w:p>
      </w:tc>'''
    return f'<w:tr>{tcs}</w:tr>'

def table(rows):  # rows = list of (cells, header, fill)
    trs = ''.join(table_row(cells, hdr, fill) for cells, hdr, fill in rows)
    return f'''<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="AAAAAA"/>
        <w:left w:val="single" w:sz="4" w:color="AAAAAA"/>
        <w:bottom w:val="single" w:sz="4" w:color="AAAAAA"/>
        <w:right w:val="single" w:sz="4" w:color="AAAAAA"/>
        <w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>
        <w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>
      </w:tblBorders>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    {trs}
  </w:tbl>'''

def hr():
    return '''<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="2E75B6"/></w:pBdr>
    <w:spacing w:before="100" w:after="100"/></w:pPr></w:p>'''

def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def confidentiality_banner():
    return f'''<w:p>
    <w:pPr><w:jc w:val="center"/>
      <w:spacing w:before="0" w:after="40"/>
      <w:shd w:val="clear" w:color="auto" w:fill="{NAVY}"/>
    </w:pPr>
    {bold_run("COMMERCIAL IN CONFIDENCE  ·  PRIVILEGED & CONFIDENTIAL  ·  PATENT FILING SUPPORT", size=16, color=WHITE)}
  </w:p>'''

def note_box(label, text, fill=LIGHT, border_color=BLUE):
    return f'''<w:p>
    <w:pPr>
      <w:ind w:left="200" w:right="200"/>
      <w:spacing w:before="60" w:after="60"/>
      <w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>
    </w:pPr>
    {bold_run(label + "  ", size=18, color=NAVY)}{normal_run(text, size=18, color=GRAY)}
  </w:p>'''

# ── STYLES XML ────────────────────────────────────────────────────────────────

STYLES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="19"/><w:szCs w:val="19"/>
        <w:color w:val="000000"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="19"/><w:szCs w:val="19"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/><w:sz w:val="28"/><w:szCs w:val="28"/>
      <w:color w:val="{NAVY}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/><w:sz w:val="24"/><w:szCs w:val="24"/>
      <w:color w:val="{BLUE}"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/></w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/><w:i/><w:sz w:val="21"/><w:szCs w:val="21"/>
      <w:color w:val="{BLUE}"/>
    </w:rPr>
  </w:style>
</w:styles>'''

# ── DOCUMENT BODY ─────────────────────────────────────────────────────────────

def build_document():
    paras = []
    P = paras.append

    # ── Cover ──────────────────────────────────────────────────────────────────
    P(confidentiality_banner())
    P(para([normal_run(" ", size=14)], space_after=60))

    P(para([bold_run("OMNIBLEND AI ENGINE", size=40, color=NAVY)], align="center", space_after=40))
    P(para([bold_run("Blend Process Intelligence Platform", size=26, color=BLUE)], align="center", space_after=80))

    P(para([
        normal_run("The AI/ML Models in a Blend Event, and How Each One Is Trained", size=22, color=GRAY, italic=True)
    ], align="center", space_after=160))

    P(table([
        ([("Prepared for",   "2000"), ("OmniBlend Product & Engineering Teams",       "3000")], False, LIGHT),
        ([("Subject domain", "2000"), ("Lube Oil Blending Plant (LOBP) Optimisation", "3000")], False, WHITE),
        ([("Models covered", "2000"), ("9 AI/ML models that execute a blend event",   "3000")], False, LIGHT),
        ([("Document series","2000"), ("OmniBlend AI Model Registry",                 "3000")], False, WHITE),
        ([("Date",           "2000"), ("May 2026",                                    "3000")], False, LIGHT),
    ]))

    P(para([normal_run(" ", size=12)], space_after=40))
    P(para([
        normal_run(
            "Prepared as a technical reference for product, engineering, and strategic counsel. "
            "This document explains the AI/ML architecture of the OmniBlend platform — how each model functions, "
            "how it is trained on historical blend data, and how it improves autonomously after every production event. "
            "The document is structured to support patent claim language for the continuous-learning architecture "
            "and the closed-loop refinement mechanism that distinguishes OmniBlend from static rule-based systems.",
            size=18, color=GRAY, italic=True
        )
    ], space_after=80))

    P(page_break())

    # ── Section 1 ──────────────────────────────────────────────────────────────
    P(heading("1.  Purpose and Scope", 1))
    P(para([
        normal_run(
            "This document responds to the engineering and commercial team's request for a technical explanation "
            "of the AI/ML models inside OmniBlend and how each is trained. It covers the full blend event — "
            "from COA data ingestion through recipe rebalancing, savings attribution, quality scoring, supplier "
            "optimisation, and post-batch refinement. The format deliberately mirrors a patent filing support "
            "document so it can serve both internal understanding and external IP counsel simultaneously."
        )
    ]))
    P(para([
        normal_run(
            "A blend event in OmniBlend is not processed by a single model. It is executed by a chain of nine "
            "AI/ML models, each with a distinct responsibility. This document walks that chain in the sequence "
            "the models act during a live batch, and for each one explains, in plain language, what it does, "
            "how it is trained on historical data, and — critically — how it learns and improves over time "
            "without manual retraining."
        )
    ]))
    P(para([
        normal_run(
            "The most important training fact, true of every model below, is that none of them is static after "
            "deployment. After every batch event, OmniBlend compares what it predicted against what the laboratory "
            "actually measured, and feeds that difference back to refine the models. This closed-loop, per-batch, "
            "autonomous retraining is the central patentable innovation of the OmniBlend platform."
        )
    ], space_after=160))

    P(para([bold_run("1.1  The blend model chain at a glance", size=21, color=BLUE)], space_after=80))
    P(table([
        ([("#", "400"), ("Model", "1500"), ("Its job in a blend event", "3100")], True, NAVY),
        ([("1", "400"), ("Blend Activation Controller (BAC-01)", "1500"),
          ("Decides which data pipelines to open when a batch is initiated — the data-acquisition model.", "3100")],
         False, WHITE),
        ([("2", "400"), ("COA Data Quality Scorer (DQS-02)", "1500"),
          ("Validates incoming Certificate of Analysis data and scores its trustworthiness.", "3100")],
         False, LIGHT),
        ([("3", "400"), ("Blend Property Predictor (BPP-03)", "1500"),
          ("Translates COA component values into predicted finished-blend properties: KV, Ca, Zn, P.", "3100")],
         False, WHITE),
        ([("4", "400"), ("Rebalance Solver Engine (RSE-04)", "1500"),
          ("Finds the optimal swing-component ratio to bring predicted viscosity within specification.", "3100")],
         False, LIGHT),
        ([("5", "400"), ("Savings Attribution Engine (SAE-05)", "1500"),
          ("The core engine — quantifies all three savings streams per batch: material, elemental, RFT.", "3100")],
         False, WHITE),
        ([("6", "400"), ("Blend Quality Score Engine (BQS-06)", "1500"),
          ("Converts blend assessments into a 0–10 quality score and off-spec risk percentage.", "3100")],
         False, LIGHT),
        ([("7", "400"), ("Supply & Procurement Optimizer (SPO-07)", "1500"),
          ("Ranks suppliers and allocates volumes to minimise cost while protecting quality.", "3100")],
         False, WHITE),
        ([("8", "400"), ("Recommendation & Alert Engine (RAE-08)", "1500"),
          ("Writes and delivers personalised blend recommendations and quality deviation alerts.", "3100")],
         False, LIGHT),
        ([("9", "400"), ("Post-Batch Refinement Engine (PBR-09)", "1500"),
          ("After each batch closes, retrains every model above using laboratory and outcome evidence.", "3100")],
         False, WHITE),
    ]))
    P(para([normal_run(" ", size=10)]))
    P(para([
        normal_run("Sections 2 through 10 take each model in turn. Section 11 summarises the single training "
                   "principle that ties them together.", size=18, italic=True, color=GRAY)
    ], space_after=120))

    P(page_break())

    # ── Section 2: BAC-01 ──────────────────────────────────────────────────────
    P(heading("2.  Blend Activation Controller (BAC-01) — the Data-Acquisition Model", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts first. When a batch is initiated, it decides which data sources to open.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "BAC-01 is the data-acquisition orchestrator of OmniBlend. When a production batch is created — "
            "identified by lubricant grade, batch ID, and scheduled date — BAC-01 opens a dedicated data pathway "
            "specific to that grade. For a 15W-40 engine oil batch it activates: the COA feed for the swing-pair "
            "base oils (SN 150, SN 500), the additive package COA channel (DI package elemental analysis), "
            "the blender sensor stream (temperature, mixing RPM, kettle load), laboratory instrument links, "
            "and — where enabled — the ERP material reservation event. It does not activate pathways that are "
            "irrelevant to the grade: a turbine oil batch does not open the motor-oil additive elemental channel. "
            "Once the batch is completed and the laboratory has confirmed the outcome, BAC-01 dissolves the "
            "pathway, releasing resources."
        )
    ]))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "BAC-01 is a hybrid model. The base rule — which data source types are relevant to which lubricant "
            "grade — is expert-defined at configuration. But the pathway duration (how long to hold a channel "
            "open, how many laboratory passes to wait for before closing) is governed by a learned threshold. "
            "That threshold is calibrated by the Post-Batch Refinement Engine (PBR-09) after each production "
            "event: if a pathway was closed before the final lab confirmation arrived, the model adjusts to "
            "wait longer; if a source contributed no useful signal for a given grade, its activation weight "
            "for that grade is reduced."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "BAC-01 learns which data sources are most predictive for each lubricant grade and for each "
            "supplier combination. Over many batches, the refinement loop measures each source's contribution "
            "to final prediction accuracy. If viscosity readings from a particular sensor correlate more "
            "strongly with laboratory outcomes than another, that source is weighted up. Where two suppliers "
            "provide the same base oil grade, the model learns whether to average their COA values or to "
            "prefer the historically more accurate one. This is the same principle as the CAT Synapse weather-"
            "source weighting, applied to industrial blend data rather than meteorological feeds."
        )
    ], space_after=120))

    # ── Section 3: DQS-02 ────────────────────────────────────────────────────
    P(heading("3.  COA Data Quality Scorer (DQS-02)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts on every COA and sensor data packet as it arrives, before any interpretation.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "DQS-02 checks each incoming data packet for problems — missing fields, out-of-range values, "
            "duplicate lot certificates, stale records submitted for a new batch, and format inconsistencies "
            "between supplier COA templates. It attaches a confidence score from 0 to 1 to every data packet. "
            "It also performs statistical anomaly detection: a viscosity reading of 4.5 cSt for a heavy "
            "SN 500 base oil, or a phosphorus value of 0.15% where the additive specification ceiling is "
            "0.087%, is flagged as anomalous even if it is technically a valid number. Where a value is "
            "missing, DQS-02 substitutes the historical lot average for that supplier and grade, and reduces "
            "the confidence score accordingly. The confidence score travels with the data through the entire "
            "pipeline and acts as a ceiling on the final savings and quality score."
        )
    ]))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "DQS-02 uses a lightweight autoencoder trained exclusively on verified historical COA records "
            "for each lubricant grade. Anything that does not match the learned pattern of clean data is "
            "flagged as anomalous. In parallel, it maintains running baseline statistics — mean and standard "
            "deviation — for each measured property, per supplier, per season. These baselines are refreshed "
            "by PBR-09 after each production event."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "Its sense of 'normal' for each supplier and grade improves with every batch. As more production "
            "runs accumulate, seasonal and lot-to-lot variation patterns become more precise, so DQS-02 "
            "becomes better at distinguishing a genuine raw-material batch that is genuinely off-target from "
            "a transcription error in the COA."
        )
    ], space_after=120))

    P(page_break())

    # ── Section 4: BPP-03 ────────────────────────────────────────────────────
    P(heading("4.  Blend Property Predictor (BPP-03)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts during data ingestion, preparing predicted blend properties for the core engine.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "BPP-03 takes the validated COA values from DQS-02 and computes the predicted properties of the "
            "finished blend before any material is charged to the kettle. Its primary output is the predicted "
            "kinematic viscosity (KV @ 100°C), which determines whether the batch will meet specification "
            "without any adjustment. It also predicts the finished-blend elemental concentrations (Ca, Zn, P) "
            "that determine additive compliance."
        )
    ]))
    P(para([bold_run("Viscosity prediction formula (proportional-perturbation model):", size=19, color=NAVY)]))
    P(note_box(
        "predKV =",
        "targetKV × (1 + Σ [ pctVariance_i × massFrac_i × sensitivity_i ])\n"
        "where: pctVariance_i = (actual_KV_i − std_KV_i) / std_KV_i\n"
        "       sensitivity: 1.0 for swing/base oils · 0.6 for additive package · 1.5 for viscosity modifier\n"
        "Rationale: anchors prediction to the grade's target KV; each component's deviation from its "
        "certificate standard is propagated proportionally, weighted by its mass fraction and blend-"
        "viscosity sensitivity. This model is analytically tractable, auditable, and calibrated per grade.",
        fill=LIGHT
    ))
    P(para([bold_run("Elemental prediction (linear scaling):", size=19, color=NAVY)]))
    P(note_box(
        "blendCa = additiveCa × (additiveMass% / 100)",
        "same for Zn and P — linear because additive holds its recipe mass fraction under rebalancing.",
        fill=LIGHT
    ))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "The sensitivity coefficients (1.0 / 0.6 / 1.5) and the perturbation scaling are initialised from "
            "first-principles blend chemistry. They are then continuously recalibrated: after each batch, "
            "PBR-09 compares the predicted KV to the laboratory-measured KV and applies a gradient step to "
            "each sensitivity coefficient. Over production history, the model develops grade-specific and "
            "supplier-specific sensitivity values that are more accurate than any generic initial estimate."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns the true blend response of each grade to each supplier's specific lot variation. A "
            "supplier whose SN 500 batches consistently run high in viscosity will develop a higher "
            "grade-specific sensitivity coefficient for that component, so future predictions for batches "
            "using that supplier's material are automatically more accurate."
        )
    ], space_after=120))

    # ── Section 5: RSE-04 ────────────────────────────────────────────────────
    P(heading("5.  Rebalance Solver Engine (RSE-04)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts when BPP-03's predicted KV falls outside specification — the blend-correction model.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "If the predicted KV from BPP-03 deviates from the target beyond the specification window (typically "
            "±0.3 cSt), RSE-04 takes over and finds the minimum correction to the recipe that will bring "
            "the blend back within specification — without touching the additive package (which must hold its "
            "compliance floor). It does this by shifting the heavy/light swing-oil pair: increasing the "
            "proportion of heavy base oil raises viscosity; decreasing it lowers viscosity."
        )
    ]))
    P(para([bold_run("Rebalance solver algorithm (linear scan):", size=19, color=NAVY)]))
    P(note_box(
        "for shift = −5.0 pp to +5.0 pp (step 0.05 pp):",
        "  modify swing_heavy.mass% += shift; swing_light.mass% −= shift\n"
        "  recompute predKV via BPP-03 formula\n"
        "  record shift that minimises |predKV − targetKV|\n"
        "  declare success if residual error < targetKV × 2%\n"
        "  hard constraint: additive package mass% unchanged (compliance floor held)\n"
        "  hard constraint: total recipe = 100% (mass balance)\n"
        "Search range ±5 percentage-points; step 0.05 pp → 201 candidates evaluated per call.",
        fill=LIGHT
    ))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "RSE-04's solver is deterministic within a single call, but its search range and achievability "
            "threshold are learned parameters. The initial range (±5 pp) and step size (0.05 pp) are set from "
            "process knowledge. The achievability threshold (2% of targetKV) is calibrated by PBR-09 "
            "after each event by comparing the correction RSE-04 recommended against what the blender "
            "physically produced and the laboratory confirmed."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns the practical rebalance capability of each blender and kettle. If, over many events, "
            "a rebalance shift larger than ±3 pp consistently fails to deliver the predicted correction — "
            "perhaps because of imprecise dosing equipment — the model narrows its achievable range for "
            "that blend unit and flags larger corrections as 'hardware-limited' rather than 'achievable'. "
            "This prevents the system from confidently recommending a correction that the plant cannot execute."
        )
    ], space_after=120))

    P(page_break())

    # ── Section 6: SAE-05 ────────────────────────────────────────────────────
    P(heading("6.  Savings Attribution Engine (SAE-05) — the Core Engine", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("The central model. It quantifies the financial value of every OmniBlend intervention.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "SAE-05 is the financial intelligence core of OmniBlend. It takes the rebalance result from RSE-04 "
            "and the elemental potency readings from BPP-03 and computes the total savings for the batch, "
            "broken down across three independent streams. Its output is the per-batch savings ledger entry — "
            "auditable, step-by-step, and traceable to the exact COA values that drove it."
        )
    ]))
    P(para([bold_run("Three savings streams:", size=19, color=NAVY)]))

    P(note_box(
        "Stream 1 — Material Avoidance:",
        "materialAvoided = (topupPct / 100) × (additiveCost − baseOilCost) × batchMT\n"
        "Rationale: OmniBlend rebalancing eliminates the need for a corrective top-up addition of expensive "
        "additive package. The top-up percentage is the dose that would otherwise have been required to bring "
        "a slightly off-specification blend back into compliance. The cost differential ($additive − $baseOil) "
        "is the premium the plant was paying per tonne for that correction. When OmniBlend avoids the "
        "correction entirely by predicting and adjusting the recipe before charging, that premium is saved.",
        fill=LIGHT
    ))

    P(note_box(
        "Stream 2 — Elemental Potency:",
        "avgOverage = mean([(Ca_actual−Ca_std)/Ca_std, (Zn_actual−Zn_std)/Zn_std, (P_actual−P_std)/P_std])\n"
        "reducibleFrac = min(avgOverage, topupPct / 100)   ← capped at compliance floor\n"
        "elementalSaving = reducibleFrac × additiveMassFrac × batchMT × (additiveCost − baseOilCost)\n"
        "Rationale: When an additive lot is over-potent (more Ca, Zn, or P than the standard), the plant "
        "can reduce the additive dose to the minimum compliant level and replace the reduction with cheaper "
        "base oil. OmniBlend captures this value systematically, batch by batch, which would otherwise "
        "be invisible because the COA is rarely compared against the specification in production.",
        fill=LIGHT
    ))

    P(note_box(
        "Stream 3 — RFT Lift (Right-First-Time):",
        "rftGap = max(0, (0.99 − currentRFT) / (0.99 − 0.90))   ← linear interpolation to 99% target\n"
        "rftLifted = $3.15/MT × batchMT × rftGap   (only booked when batch is in-spec)\n"
        "Calibration: $3.15/MT is derived from a 25,000 MT/yr reference plant where closing the full "
        "90%→99% RFT gap was independently valued at $78,750/yr. The gap factor scales that rate to "
        "each plant's current RFT position — a plant already at 97% captures less per tonne than one "
        "starting at 91%, reflecting diminishing marginal return as perfection is approached.",
        fill=LIGHT
    ))

    P(para([bold_run("Annual scenario projection:", size=19, color=NAVY)]))
    P(note_box(
        "annualProjection = captured_30d × (365 / 30)",
        "Conservative = projection × 0.67  (Year-1 commit — accounts for ramp-up)\n"
        "Expected      = projection × 1.00  (Captured rate forward — most likely)\n"
        "Optimistic    = projection × 1.33  (Upper bound — full grade coverage, all COAs captured)",
        fill=LIGHT
    ))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "SAE-05's cost parameters (additive and base oil costs, top-up percentage, RFT rate) are "
            "initialised from plant master data at configuration. The three savings formula structures are "
            "analytically derived and fixed — they are not learned. What is learned are the grade-specific "
            "calibration constants: the effective top-up percentage that plants actually need when COA "
            "variance goes uncorrected, and the plant-specific RFT rate (which may differ from the "
            "$3.15/MT reference as actual claims and rework costs are measured). These constants are "
            "updated by PBR-09 after each batch using real cost and quality outcome data."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns each plant's true cost coefficients. If production records show that uncorrected "
            "batches actually require a 0.6% top-up rather than 0.5%, the effective top-up rate is "
            "recalibrated upward, increasing the computed savings for future batches — accurately reflecting "
            "the plant's real avoidable cost. Similarly, if actual claims and laboratory rework costs "
            "are tracked, the RFT rate per tonne is updated from the reference $3.15 to the plant's "
            "own figure, making the financial model increasingly precise over time."
        )
    ], space_after=120))

    P(page_break())

    # ── Section 7: BQS-06 ────────────────────────────────────────────────────
    P(heading("7.  Blend Quality Score Engine (BQS-06)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts after SAE-05, converting blend assessments into a single actionable quality score.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "BQS-06 combines outputs from BPP-03 and SAE-05 into two instruments that operators and the "
            "AI Control Panel can act on immediately: a Blend Quality Score from 0 to 10, and an Off-Spec "
            "Risk percentage from 0% to 100%. The Quality Score is a transparent weighted function of "
            "five criteria: viscosity compliance, flash point compliance, TBN compliance, elemental "
            "compliance (Ca/Zn/P), and recipe mass balance. The Off-Spec Risk is the probability that "
            "the batch will fail laboratory acceptance, given the predicted properties and current "
            "rebalance status."
        )
    ]))
    P(note_box(
        "Quality Score formula:",
        "Q = w₁×viscosityScore + w₂×flashScore + w₃×tbnScore + w₄×elementalScore + w₅×balanceScore\n"
        "where each sub-score is 1.0 if predicted value is within specification, scaling down linearly "
        "to 0 at the rejection limit.\n"
        "Default weights (calibrated per grade): viscosity 35% · elemental 25% · TBN 20% · flash 15% · balance 5%",
        fill=LIGHT
    ))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "The formula weights are initialised from domain expertise (viscosity is the most commercially "
            "critical parameter for most grades) and are then continuously recalibrated by PBR-09 using "
            "a regression of predicted score against laboratory outcome: if high-quality-score batches "
            "consistently fail on one parameter, that parameter's weight is increased."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns grade-specific quality drivers. An engine-oil grade may need higher viscosity weight; "
            "a turbine oil grade may weight elemental compliance higher because oxidation stability is the "
            "primary failure mode. Over production history, the weights become grade-specific rather than "
            "generic, producing quality scores that more accurately predict real laboratory pass/fail outcomes."
        )
    ], space_after=120))

    # ── Section 8: SPO-07 ────────────────────────────────────────────────────
    P(heading("8.  Supply & Procurement Optimizer (SPO-07)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts at batch-creation time and at periodic procurement cycles, not just per-batch.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "SPO-07 ranks available suppliers for each material and recommends volume allocations to "
            "minimise total procurement cost while maintaining quality grade requirements and lead-time "
            "constraints. It uses a multi-criterion composite score across four dimensions: price, "
            "lead time, quality grade, and historical reliability. It is also the model that connects "
            "procurement decisions to savings: the material cost differential that feeds SAE-05's "
            "savings formulas is taken from SPO-07's current supplier rates."
        )
    ]))
    P(note_box(
        "Composite supplier score:",
        "score = w_price × priceScore + w_lead × leadScore + w_quality × qualityScore + w_reliability × reliabilityScore\n"
        "Default weights: cost-priority mode — price 50%, quality 20%, lead 15%, reliability 15%\n"
        "               quality-priority mode — quality 50%, reliability 20%, price 15%, lead 15%\n"
        "               balanced mode — price 30%, lead 25%, quality 25%, reliability 20%\n"
        "Recommended allocation: top-ranked supplier 70% · second-ranked 30% (dual-source resilience)",
        fill=LIGHT
    ))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "SPO-07's scoring parameters are initialised from tender data and quality-grade lookups. "
            "The allocation split (70/30) and the weight presets are expert-configured starting points. "
            "Both are refined by PBR-09 after each procurement cycle using actual delivery performance "
            "data: lead-time actuals versus quoted, lot rejection rates per supplier, and the cost "
            "impact of delays on production scheduling."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns which suppliers' COA values are most predictive of blend outcomes — directly linking "
            "procurement decisions to blend quality. A supplier whose COA viscosity values consistently "
            "correlate with accurate blend predictions has its quality reliability weight increased; one "
            "whose certificates prove unreliable is downgraded. This means SPO-07 and BPP-03 become "
            "jointly calibrated over time, and the savings computed by SAE-05 become more accurate as "
            "a result."
        )
    ], space_after=120))

    P(page_break())

    # ── Section 9: RAE-08 ────────────────────────────────────────────────────
    P(heading("9.  Recommendation & Alert Engine (RAE-08)", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts last in the live event, producing and delivering blend-operator guidance.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "RAE-08 generates the actionable outputs from every blend event: natural-language recommendations "
            "to operators (increase viscosity modifier by 0.8%, switch base oil to Supplier B for this lot), "
            "quality deviation alerts (viscosity 1.2% below spec — minor), and the AI Control Panel "
            "responses that allow operators to query the system in plain language. It also manages the "
            "priority and channel of each communication: a CRITICAL off-spec risk triggers an immediate "
            "blender alert and supervisor notification; a LOW-impact recommendation is queued as an "
            "advisory for the next batch planning cycle."
        )
    ]))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "RAE-08's language generation is a fine-tuned language model trained on a library of verified "
            "blend advisory content, ASTM and SAE specification language, and historical operator-response "
            "records. Its alert prioritisation logic is a classifier trained on past events, mapping "
            "risk level and operator response urgency to communication channel and timing."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "It learns which recommendations operators act on and which produce the intended outcome. "
            "The refinement loop tracks whether recommended adjustments were applied and whether they "
            "resulted in in-specification batches. Recommendations that consistently led to successful "
            "outcomes are reinforced; wording and timing choices that were ignored or misunderstood "
            "are revised. Over time, OmniBlend's advisory language becomes calibrated to each plant's "
            "operator team and terminology."
        )
    ], space_after=120))

    # ── Section 10: PBR-09 ────────────────────────────────────────────────────
    P(heading("10.  Post-Batch Refinement Engine (PBR-09) — the Model that Trains the Models", 1))
    P(para([bold_run("Role in a blend event:  ", size=19, color=BLUE),
            normal_run("Acts after the batch is closed and laboratory results are confirmed. It is the self-improvement mechanism.")]))
    P(heading("What it does", 3))
    P(para([
        normal_run(
            "PBR-09 is the engine behind every 'learns over time' statement in this document. Once a batch "
            "closes — meaning laboratory analysis is complete and the batch is either passed to filling or "
            "rejected — PBR-09 collects the outcome evidence: actual KV, flash point, TBN, and elemental "
            "results from the laboratory information management system (LIMS); blending time and kettle "
            "energy consumption from the DCS; any rework costs or batch failures; and operator feedback "
            "on recommendations. It then computes the gap between each model's prediction and the "
            "corresponding real outcome, and applies a small, targeted weight adjustment to close that gap."
        )
    ]))
    P(heading("How it is trained", 3))
    P(para([
        normal_run(
            "PBR-09 uses delta-learning: it does not retrain any model from scratch, does not require a "
            "model to be taken offline, and does not require a human data scientist to supervise the cycle. "
            "It computes only the incremental weight adjustment needed from the latest batch's outcome "
            "gap, applies it with a controlled learning rate (preventing any single batch from over-"
            "correcting the model), and writes the updated parameters back to the affected models "
            "asynchronously — so the next batch runs on a marginally improved set of models."
        )
    ]))
    P(heading("How it learns over time", 3))
    P(para([
        normal_run(
            "PBR-09 is itself the learning mechanism — it does not learn in the conventional sense. "
            "Its effect is cumulative and compounding: every batch OmniBlend processes makes every "
            "model that handles the next batch slightly more accurate. After 50 batches, the platform "
            "is meaningfully better calibrated than it was at deployment; after 200, the grade-specific "
            "sensitivity coefficients and cost parameters reflect the plant's actual blending physics "
            "rather than initial estimates. This per-batch, autonomous, closed-loop retraining — "
            "requiring no human intervention and no scheduled downtime — is the core differentiating "
            "capability of the OmniBlend platform."
        )
    ]))

    P(para([normal_run(" ", size=12)]))
    P(note_box(
        "Reference calibration embedded in PBR-09:",
        "All savings models are anchored to a 25,000 MT/yr reference plant where:\n"
        "  RFT baseline = 90%  ·  RFT target = 99%  ·  RFT value = $3.15/MT\n"
        "  Additive cost = $2,500/MT  ·  Base oil cost = $850/MT  ·  Cost differential = $1,650/MT\n"
        "  Top-up rate = 0.5% corrective dose  ·  Reference annual RFT value = $78,750\n"
        "PBR-09 tracks each plant's deviation from this reference and updates the plant-specific "
        "coefficients accordingly, so the savings model becomes a precise reflection of that "
        "plant's real cost structure rather than a generic estimate.",
        fill=LIGHT
    ))

    P(page_break())

    # ── Section 11 ────────────────────────────────────────────────────────────
    P(heading("11.  The One Training Principle Behind Every Model", 1))
    P(para([
        normal_run(
            "If a reader takes away a single point about how OmniBlend's AI/ML models are trained, "
            "it is this: every model in the blend chain is trained in two stages, and the second stage "
            "never stops."
        )
    ]))
    P(bullet(
        "Initial training.  Each model is first trained on historical data — past blend records, "
        "laboratory results, COA archives, supplier performance history — so that it is competent "
        "and produces defensible outputs from its first live batch."
    ))
    P(bullet(
        "Continuous refinement.  After every production batch, the Post-Batch Refinement Engine "
        "(PBR-09) compares every model's prediction against the laboratory-confirmed reality and "
        "feeds the difference back as a small, automatic weight adjustment. No human triggers this "
        "cycle; no model is taken offline; no retraining run is scheduled."
    ))
    P(para([normal_run(" ", size=10)]))

    P(para([
        normal_run(
            "The practical consequences — and the central claims of OmniBlend's novel architecture — are:"
        )
    ]))
    P(bullet(
        "The platform genuinely improves its own predictions over time. It learns which base oil "
        "suppliers' lots are most predictable, which additive packages tend to run over-potent, "
        "which grades are most sensitive to swing-component variation, and which blenders "
        "achieve the tightest dosing accuracy. None of this requires a person to intervene."
    ))
    P(bullet(
        "The savings calculations become more precise with every batch. SAE-05's cost coefficients "
        "are calibrated against real outcomes, not generic reference values, so the financial "
        "value reported to management is increasingly auditable and defensible."
    ))
    P(bullet(
        "The rebalance recommendations become better adapted to each plant's physical constraints. "
        "RSE-04 learns what its blenders can actually achieve, not what the solver theoretically "
        "prescribes, so operator confidence in acting on OmniBlend's recommendations increases "
        "over time."
    ))
    P(bullet(
        "The data quality model becomes specific to each supplier and grade. DQS-02 learns the "
        "normal lot-to-lot variation for each supplier's material, so it can tell a genuine "
        "out-of-spec delivery from routine variation — reducing false positives and improving "
        "the signal-to-noise ratio of the COA validation step."
    ))
    P(para([normal_run(" ", size=10)]))

    P(table([
        ([("Training stage", "2000"), ("Mechanism", "3000")], True, NAVY),
        ([("1 — Initial (pre-deployment)", "2000"),
          ("Supervised training on historical blend records, COA archives, laboratory results, cost data.", "3000")],
         False, LIGHT),
        ([("2 — Continuous (post-deployment)", "2000"),
          ("Per-batch delta-learning via PBR-09: prediction vs. outcome gap → automatic weight update, "
           "no human intervention, no model downtime.", "3000")],
         False, WHITE),
        ([("Scope", "2000"),
          ("All 9 models. Each has a different gap metric (KV error, savings delta, supplier forecast "
           "error, recommendation acceptance rate) but the same two-stage training architecture.", "3000")],
         False, LIGHT),
        ([("Key differentiator", "2000"),
          ("The closed-loop refinement is per-event, autonomous, and production-grade — not an offline "
           "research process. This is the core novel claim for IP purposes.", "3000")],
         False, WHITE),
    ]))

    P(para([normal_run(" ", size=10)]))
    P(hr())
    P(para([
        bold_run(
            "This two-stage training pattern — historical initial training plus autonomous, per-batch, "
            "closed-loop refinement — is consistent across all nine blend models. It is the strongest "
            "technical support for OmniBlend's IP position on autonomous model retraining without manual "
            "intervention. The data-acquisition learning of BAC-01 supports the claim for intelligent "
            "source selection; the savings formulas in SAE-05 support the claim for auditable, "
            "physics-grounded financial quantification; the rebalance solver in RSE-04 supports the "
            "claim for constraint-aware autonomous process correction. We recommend that claim language "
            "treat the self-improving training loop as a core, grade-independent feature of the invention.",
            size=18, color=GRAY
        )
    ], space_after=80))

    P(para([normal_run(" ", size=10)]))
    P(confidentiality_banner())

    return '\n'.join(paras)


# ── Assembly ──────────────────────────────────────────────────────────────────

def build_docx(output_path):
    body = build_document()
    doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
{body}
  </w:body>
</w:document>'''

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', CONTENT_TYPES)
        zf.writestr('_rels/.rels', RELS)
        zf.writestr('word/_rels/document.xml.rels', WORD_RELS)
        zf.writestr('word/document.xml', doc_xml)
        zf.writestr('word/styles.xml', STYLES)
        zf.writestr('word/settings.xml', SETTINGS)

    with open(output_path, 'wb') as f:
        f.write(buf.getvalue())
    print(f"Created: {output_path}  ({os.path.getsize(output_path):,} bytes)")


if __name__ == "__main__":
    build_docx("/home/user/LubeOilSim/OmniBlend_AI_Model_Architecture.docx")
