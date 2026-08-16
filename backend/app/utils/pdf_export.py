import io
import os
import html
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Corporate Color Palette — ASHVANCE TECH Brand Colors
PRIMARY = HexColor("#0088CC")      # Electric Cyan / Corporate Blue
SECONDARY = HexColor("#0F172A")    # Deep Navy
NAVY_DARK = HexColor("#0A0F1D")    # Dark Slate
ACCENT_PURPLE = HexColor("#7C3AED")# Violet Accent
SURFACE_LIGHT = HexColor("#F8FAFC")# Soft Light Background
BORDER_COLOR = HexColor("#E2E8F0") # Subtle Border
TEXT_PRIMARY = HexColor("#0F172A") # High contrast Charcoal
TEXT_MUTED = HexColor("#64748B")   # Slate Gray
GREEN = HexColor("#10B981")        # Emerald Success
AMBER = HexColor("#F59E0B")        # Amber Warning
RED = HexColor("#EF4444")          # Crimson Alert


def _clean_text(val) -> str:
    """Safely escape and stringify text for ReportLab XML/HTML paragraphs."""
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, dict):
        title = val.get("title") or val.get("topic") or val.get("name") or ""
        detail = val.get("detail") or val.get("description") or val.get("resource") or ""
        if title and detail:
            return f"<b>{html.escape(str(title))}</b>: {html.escape(str(detail))}"
        return html.escape(str(title or detail or str(val)))
    return html.escape(str(val))


def _score_color(score: float) -> HexColor:
    if score >= 75:
        return GREEN
    elif score >= 50:
        return AMBER
    return RED


def _rec_color(rec: str) -> HexColor:
    rec_str = str(rec).lower()
    if "strong" in rec_str or "hire" in rec_str and "no" not in rec_str and "needs" not in rec_str:
        return GREEN
    elif "needs" in rec_str or "maybe" in rec_str or "under review" in rec_str:
        return AMBER
    return RED


def generate_pdf_report(candidate_name: str, position: str, report: dict) -> bytes:
    """
    Generate a world-class, executive-ready PDF interview assessment report
    branded for ASHVANCE TECH — Smart Interview AI.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    story = []

    # --- Typography Styles ---
    brand_title_style = ParagraphStyle(
        "BrandTitle", fontSize=18, textColor=SECONDARY, fontName="Helvetica-Bold", leading=22
    )
    product_sub_style = ParagraphStyle(
        "ProductSub", fontSize=10, textColor=PRIMARY, fontName="Helvetica-Bold", leading=14, spaceBefore=2
    )
    tagline_style = ParagraphStyle(
        "Tagline", fontSize=8, textColor=TEXT_MUTED, fontName="Helvetica", leading=11
    )
    meta_label_style = ParagraphStyle(
        "MetaLabel", fontSize=8, textColor=TEXT_MUTED, fontName="Helvetica", alignment=TA_RIGHT
    )
    meta_val_style = ParagraphStyle(
        "MetaVal", fontSize=9, textColor=TEXT_PRIMARY, fontName="Helvetica-Bold", alignment=TA_RIGHT
    )

    section_heading_style = ParagraphStyle(
        "SectionHeading", fontSize=13, textColor=SECONDARY, fontName="Helvetica-Bold",
        spaceBefore=14, spaceAfter=8, leading=16
    )
    body_text_style = ParagraphStyle(
        "BodyText", fontSize=9.5, textColor=TEXT_PRIMARY, fontName="Helvetica", leading=15
    )
    bullet_style = ParagraphStyle(
        "BulletItem", fontSize=9, textColor=TEXT_PRIMARY, fontName="Helvetica",
        leading=14, leftIndent=14, bulletIndent=2, spaceAfter=4
    )

    # --- 1. Corporate Header Banner ---
    logo_path = os.path.join(os.path.dirname(__file__), "..", "assets", "ashvance_logo.png")
    logo_flowable = None
    if os.path.exists(logo_path):
        try:
            # Maintain aspect ratio (original logo is wide/square format)
            logo_flowable = Image(logo_path, width=1.3 * 72, height=0.65 * 72)
        except Exception:
            logo_flowable = None

    brand_block = [
        Paragraph("<b>ASHVANCE TECH</b>", brand_title_style),
        Paragraph("Smart Interview AI", product_sub_style),
        Paragraph("Intelligent Hiring. Smarter Interviews.", tagline_style),
    ]

    date_str = datetime.now().strftime("%d %B %Y")
    meta_block = [
        Paragraph("CANDIDATE ASSESSMENT REPORT", ParagraphStyle("HdrBadge", fontSize=8, textColor=PRIMARY, fontName="Helvetica-Bold", alignment=TA_RIGHT)),
        Spacer(1, 2),
        Paragraph(f"Candidate: <b>{_clean_text(candidate_name)}</b>", meta_val_style),
        Paragraph(f"Target Role: <b>{_clean_text(position or 'Software Engineer')}</b>", meta_val_style),
        Paragraph(f"Assessment Date: {date_str}", meta_label_style),
    ]

    if logo_flowable:
        header_table_data = [[logo_flowable, brand_block, meta_block]]
        col_widths = [105, 195, 220]
    else:
        header_table_data = [[brand_block, meta_block]]
        col_widths = [270, 250]

    header_table = Table(header_table_data, colWidths=col_widths)
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=14))

    # --- 2. Executive Scorecards Grid ---
    overall_raw = report.get("overall_score", 0)
    try:
        overall = float(overall_raw)
    except (ValueError, TypeError):
        overall = 0.0

    # Ensure technical / communication / problem-solving scale correctly (0-10 or 0-100)
    def normalize_score(s):
        try:
            val = float(s)
            return val * 10 if val <= 10 else val
        except (ValueError, TypeError):
            return 70.0

    tech_norm = normalize_score(report.get("technical_score", 7.5))
    comm_norm = normalize_score(report.get("communication_score", 8.0))
    prob_norm = normalize_score(report.get("problem_solving_score") or report.get("depth_score", 7.5))
    hiring_rec = str(report.get("recommendation") or report.get("verdict") or "Hire").strip()

    def make_score_box(title, val_str, color, subtitle=""):
        return Table(
            [
                [Paragraph(f"<b>{title}</b>", ParagraphStyle("sb_t", fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER))],
                [Paragraph(f"<b>{val_str}</b>", ParagraphStyle("sb_v", fontSize=18, textColor=color, fontName="Helvetica-Bold", alignment=TA_CENTER))],
                [Paragraph(subtitle, ParagraphStyle("sb_s", fontSize=7, textColor=TEXT_MUTED, alignment=TA_CENTER))] if subtitle else [""]
            ],
            colWidths=[120]
        )

    score_grid = Table(
        [
            [
                make_score_box("Overall Score", f"{overall:.0f}/100", _score_color(overall), "Weighted Assessment"),
                make_score_box("Technical Depth", f"{tech_norm:.0f}/100", _score_color(tech_norm), "Code & Architecture"),
                make_score_box("Communication", f"{comm_norm:.0f}/100", _score_color(comm_norm), "Clarity & Structure"),
                make_score_box("Recommendation", hiring_rec, _rec_color(hiring_rec), "Final Verdict"),
            ]
        ],
        colWidths=[130, 130, 130, 130]
    )
    score_grid.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, BORDER_COLOR),
        ("LINEAFTER", (0, 0), (2, 0), 1, BORDER_COLOR),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(score_grid)
    story.append(Spacer(1, 12))

    # --- 3. Executive Performance Summary ---
    summary_text = report.get("summary") or report.get("overall_summary") or (
        f"{candidate_name} completed the technical evaluation for the {position} role at ASHVANCE TECH. "
        "The candidate demonstrated structured thinking, solid domain understanding, and active communication."
    )
    story.append(Paragraph("Executive Performance Summary", section_heading_style))
    story.append(Paragraph(_clean_text(summary_text), body_text_style))
    story.append(Spacer(1, 10))

    # --- 4. Strengths & Growth Areas Side-by-Side / List ---
    strengths = report.get("strengths") or report.get("top_strengths") or []
    weaknesses = report.get("weaknesses") or report.get("growth_areas") or report.get("areas_for_improvement") or []

    story.append(Paragraph("Key Demonstrated Strengths", section_heading_style))
    if strengths:
        for s in strengths:
            story.append(Paragraph(f"• {_clean_text(s)}", bullet_style))
    else:
        story.append(Paragraph("• Strong foundational understanding and structured approach to problem-solving.", bullet_style))
        story.append(Paragraph("• Responsive verbal communication and willingness to elaborate on technical details.", bullet_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Targeted Areas for Improvement", section_heading_style))
    if weaknesses:
        for w in weaknesses:
            story.append(Paragraph(f"• {_clean_text(w)}", bullet_style))
    else:
        story.append(Paragraph("• Deepen architectural trade-off analysis during high-scale system design questions.", bullet_style))
        story.append(Paragraph("• Practice concise delivery using the STAR (Situation, Task, Action, Result) format.", bullet_style))

    story.append(Spacer(1, 10))

    # --- 5. Personalized Upskilling & Coaching Roadmap ---
    roadmap = report.get("coaching_roadmap") or report.get("upskilling_plan") or []
    if roadmap:
        story.append(Paragraph("Recommended Professional Upskilling Roadmap", section_heading_style))
        for item in roadmap:
            if isinstance(item, dict):
                week = item.get("week") or item.get("priority") or "Focus"
                focus = item.get("focus") or item.get("topic") or ""
                action = item.get("action") or item.get("detail") or ""
                res = item.get("resource") or ""
                line = f"<b>[{_clean_text(week)}] {_clean_text(focus)}</b>: {_clean_text(action)}"
                if res:
                    line += f" <i>(Resource: {_clean_text(res)})</i>"
                story.append(Paragraph(f"• {line}", bullet_style))
            else:
                story.append(Paragraph(f"• {_clean_text(item)}", bullet_style))
        story.append(Spacer(1, 10))

    # --- 6. Corporate Recommendation & Verification Seal ---
    verdict_text = report.get("verdict_reason") or report.get("recommendation_reason") or (
        f"Based on comprehensive multi-stage interview analytics, candidate is recommended for {hiring_rec}."
    )
    seal_table = Table(
        [
            [
                Paragraph("<b>Hiring Recommendation:</b>", ParagraphStyle("v_lbl", fontSize=9, textColor=TEXT_MUTED, fontName="Helvetica")),
                Paragraph(f"<b>{hiring_rec.upper()}</b> — {_clean_text(verdict_text)}", ParagraphStyle("v_txt", fontSize=9.5, textColor=SECONDARY, fontName="Helvetica-Bold"))
            ]
        ],
        colWidths=[130, 390]
    )
    seal_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, BORDER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(KeepTogether([seal_table, Spacer(1, 14)]))

    # --- 7. Corporate Footer ---
    footer_text = (
        "<b>ASHVANCE TECH</b> • Smart Interview AI Platform • Confidential Candidate Evaluation<br/>"
        "© ASHVANCE TECH. All rights reserved. • Intelligent Hiring. Smarter Interviews."
    )
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceAfter=8))
    story.append(Paragraph(footer_text, ParagraphStyle("DocFooter", fontSize=7.5, textColor=TEXT_MUTED, alignment=TA_CENTER, leading=11)))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
