"""Build the three-page ForgePilot technical report with ReportLab."""
import argparse
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph

parser = argparse.ArgumentParser()
parser.add_argument("--team", default="[Enter Techfest Team ID]")
parser.add_argument("--participants", default="[Enter participant names]")
parser.add_argument("--model", default="Pending a successful model turn")
parser.add_argument("--task-a", default="Pending live model verification.")
parser.add_argument("--task-b", default="Pending live model verification.")
parser.add_argument("--task-c", default="A genuine refused model endpoint was surfaced in VS Code. Git status and the Flask helper checksum matched before and after. Recovery is pending.")
args = parser.parse_args()

destination = Path(__file__).resolve().parents[1] / "submission/ForgePilot_Technical_Report.pdf"
pdf = canvas.Canvas(str(destination), pagesize=(595, 842))
pdf.setTitle("ForgePilot AI | Technical Report")
pdf.setAuthor("ForgePilot AI team")

INK = colors.HexColor("#13273A")
MUTED = colors.HexColor("#476174")
ACCENT = colors.HexColor("#087C80")
PAPER = colors.HexColor("#F3F8FA")
RULE = colors.HexColor("#CBDCE0")
FONT_DIR = Path("/usr/share/fonts/truetype/open-sans")
REGULAR = "Helvetica"
BOLD = "Helvetica-Bold"
if (FONT_DIR / "OpenSans-Regular.ttf").is_file():
    REGULAR, BOLD = "OpenSans", "OpenSans-Bold"
    pdfmetrics.registerFont(TTFont(REGULAR, str(FONT_DIR / "OpenSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(BOLD, str(FONT_DIR / "OpenSans-Bold.ttf")))
    pdfmetrics.registerFontFamily(REGULAR, normal=REGULAR, bold=BOLD)
BASE = ParagraphStyle("body", fontName=REGULAR, fontSize=10.6, leading=16, textColor=INK, alignment=TA_LEFT)

def text(y, content, x=52, width=491):
    paragraph = Paragraph(content, BASE)
    _, height = paragraph.wrap(width, 700)
    paragraph.drawOn(pdf, x, y - height)
    return y - height

def section(y, title, content):
    pdf.setFillColor(ACCENT)
    pdf.setFont(BOLD, 13)
    pdf.drawString(52, y, title)
    return text(y - 10, content) - 29

def start(page, label, title):
    pdf.setFillColor(ACCENT)
    pdf.rect(0, 832, 595, 10, fill=1, stroke=0)
    pdf.setFont(BOLD, 10)
    pdf.drawString(52, 786, "FORGEPILOT AI")
    pdf.setFillColor(MUTED)
    pdf.setFont(REGULAR, 9)
    pdf.drawRightString(543, 786, label)
    pdf.setFillColor(INK)
    pdf.setFont(BOLD, 29)
    pdf.drawString(52, 741, title)
    pdf.setStrokeColor(RULE)
    pdf.line(52, 53, 543, 53)
    pdf.setFillColor(MUTED)
    pdf.setFont(REGULAR, 8)
    pdf.drawString(52, 36, "TRUEFOUNDRY FORGE-A-THON  /  TECHFEST, IIT BOMBAY 2026–27")
    pdf.drawRightString(543, 36, f"{page} / 3")

def box(x, y, w, label):
    pdf.setFillColor(PAPER)
    pdf.setStrokeColor(RULE)
    pdf.roundRect(x, y, w, 31, 5, fill=1, stroke=1)
    pdf.setFillColor(INK)
    pdf.setFont(BOLD, 9)
    pdf.drawCentredString(x + w / 2, y + 11, label)

def edge(x1, y1, x2, y2):
    pdf.setStrokeColor(ACCENT)
    pdf.line(x1, y1, x2, y2)
    if y1 == y2:
        pdf.line(x2 - 4, y2 + 3, x2, y2)
        pdf.line(x2 - 4, y2 - 3, x2, y2)
    else:
        pdf.line(x2 - 3, y2 + 4, x2, y2)
        pdf.line(x2 + 3, y2 + 4, x2, y2)

start(1, "SYSTEM OVERVIEW", "Understand. Engineer. Verify.")
y = text(710, f"<b>Team ID</b> {escape(args.team)}<br/><b>Participants</b> {escape(args.participants)}") - 27
y = section(y, "Problem statement",
    "Repository-scale coding requests require context across implementation, tests and documentation. Developers need to inspect changes before applying them and recover when model calls fail.")
y = section(y, "Proposed solution",
    "ForgePilot AI brings inline editing, multi-file agent execution, and native diff review into VS Code. The model works through scoped tools, and the developer decides which hunks are applied.")
pdf.setFillColor(ACCENT)
pdf.setFont(BOLD, 13)
pdf.drawString(52, y, "Architecture")
top = y - 54
box(52, top, 132, "VS Code extension")
box(224, top, 146, "Local TrueForge + SDK")
box(410, top, 133, "Configured model")
edge(184, top+15, 224, top+15)
edge(370, top+15, 410, top+15)
box(224, top-52, 146, "Workspace MCP bridge")
edge(297, top, 297, top-21)
box(52, top-104, 132, "Bounded context")
box(224, top-104, 146, "Staged proposals")
box(410, top-104, 133, "Native hunk review")
edge(297, top-52, 297, top-73)
edge(370, top-89, 410, top-89)
edge(224, top-36, 118, top-73)
section(top-136, "TrueForge integration",
    "Local TrueForge 0.185.1 runs the agent loop. The TypeScript SDK registers a temporary loopback MCP connector, opens a session and consumes turn events. "
    f"<b>Verified model</b> {escape(args.model)}.")
pdf.showPage()

start(2, "ENGINEERING", "From context to review")
y = 696
y = section(y, "ContextLens",
    "The extension indexes repository paths with ripgrep and filters private or generated paths. A bounded lexical rank combines filename and content matches with active-file, import and related-test signals. "
    "Explicit file and symbol references raise matching files in the ranking. The sidebar shows selected excerpts.")
y = section(y, "Agent workflow",
    "TrueForge selects repository tools and plans edits. The bridge exposes listing, search, symbol lookup, ranged reads and compare-before-stage edits. Inline proposals can replace only the captured selection. "
    "The extension renders actual model text and observable tool activity.")
y = section(y, "ForgeGuard",
    "Proposals retain the original snapshot. Native VS Code diffs are available before application, with per-hunk decisions. Canonical path validation, document versions and content checks protect reviewed transactions. "
    "Undo restores the latest transaction after checking that applied contents still match.")
y = section(y, "Verification",
    "On an appropriately configured Linux host, a developer-approved pytest run uses an isolated snapshot, a bounded command profile, a scrubbed environment and no network. If isolation is unavailable, "
    "the extension leaves execution disabled. The developer can verify saved, approved changes from a separate terminal.")
y = section(y, "Resilience",
    "A broken event stream can reconnect from the last event ID. The Stop control invalidates local staging and requests TrueForge cancellation. Unsuccessful turns clear staged proposals and expose a retry action.")
section(y, "Original contributions",
    "ForgePilot supplies its own VS Code integration, run-scoped bridge, context ranking, staged editing, review and undo. The TrueForge SDK and MCP SDK are used as libraries, with bundled licenses preserved.")
pdf.showPage()

start(3, "ROUND ONE EVIDENCE", "Flask demonstrations")
y = text(697, "<b>Flask baseline</b> 49943b5a94413a530761350f04e896f76e8d620e") - 27
y = section(y, "Task A · Inline editing", escape(args.task_a))
y = section(y, "Task B · Multi-file agent", escape(args.task_b))
y = section(y, "Task C · Model failure", escape(args.task_c))
y = section(y, "Build and verification",
    "The TypeScript build and nine offline tests passed. VS Code 1.147.0 activated the extension and registered all three contributed commands. "
    "TrueForge discovered the inline staging tool through MCP. On clean Flask, the targeted helpers and CLI suites passed 93 tests.")
section(y, "Known limitations",
    "Undo history is session-local. The cloud host could not start the bubblewrap verification profile, so the agent cannot execute pytest there. "
    "Team metadata, authorized public publication, video recording and final upload are participant actions.")
pdf.showPage()
pdf.save()
print(destination)
