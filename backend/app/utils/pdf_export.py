import io
import json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT


PRIMARY = HexColor("#6366f1")
DARK = HexColor("#1e1b4b")
LIGHT_BG = HexColor("#f5f3ff")
GREEN = HexColor("#22c55e")
RED = HexColor("#ef4444")
AMBER = HexColor("#f59e0b")
GRAY = HexColor("#6b7280")


def _score_color(score: float) -> HexColor:
    if score >= 75:
        return GREEN
    elif score >= 50:
        return AMBER
    return RED


def _rec_color(rec: str) -> HexColor:
    mapping = {
        "Strong Hire": GREEN,
        "Hire": HexColor("#3b82f6"),
        "Maybe": AMBER,
        "No Hire": RED,
    }
    return mapping.get(rec, GRAY)


def generate_pdf_report(candidate_name: str, position: str, report: dict) -> bytes:
    """Generate a professional PDF interview report and return as bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        "Title", fontSize=22, textColor=white, alignment=TA_CENTER, fontName="Helvetica-Bold", spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", fontSize=11, textColor=HexColor("#c7d2fe"), alignment=TA_CENTER, fontName="Helvetica"
    )
    h2_style = ParagraphStyle(
        "H2", fontSize=14, textColor=DARK, fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=6
    )
    body_style = ParagraphStyle(
        "Body", fontSize=10, textColor=HexColor("#374151"), fontName="Helvetica", leading=16
    )
    bullet_style = ParagraphStyle(
        "Bullet", fontSize=10, textColor=HexColor("#374151"), fontName="Helvetica", leading=16,
        leftIndent=16, bulletIndent=0
    )

    # --- Header Banner ---
    header_data = [
        [Paragraph(f"Interview Report", title_style)],
        [Paragraph(f"{candidate_name} — {position or 'Software Engineer'}", subtitle_style)],
        [Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", subtitle_style)],
    ]
    header_table = Table(header_data, colWidths=[515])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 20))

    # --- Score Cards ---
    overall = report.get("overall_score", 0)
    technical = report.get("technical_score", 0)
    communication = report.get("communication_score", 0)
    hiring_rec = report.get("hiring_recommendation", "Maybe")

    def score_cell(label, value, color):
        return [
            Paragraph(f"<b>{label}</b>", ParagraphStyle("sl", fontSize=9, textColor=GRAY, fontName="Helvetica", alignment=TA_CENTER)),
            Paragraph(f"<b>{value}</b>", ParagraphStyle("sv", fontSize=22, textColor=color, fontName="Helvetica-Bold", alignment=TA_CENTER)),
        ]

    scores_table = Table(
        [
            [
                Table(score_cell("Overall Score", f"{overall:.0f}/100", _score_color(overall)), colWidths=[120]),
                Table(score_cell("Technical", f"{technical:.0f}/100", _score_color(technical)), colWidths=[120]),
                Table(score_cell("Communication", f"{communication:.0f}/100", _score_color(communication)), colWidths=[120]),
                Table(score_cell("Recommendation", hiring_rec, _rec_color(hiring_rec)), colWidths=[145]),
            ]
        ],
        colWidths=[130, 130, 130, 125]
    )
    scores_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e0e7ff")),
        ("LINEAFTER", (0, 0), (2, 0), 1, HexColor("#c7d2fe")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(scores_table)
    story.append(Spacer(1, 18))

    # --- Summary ---
    story.append(Paragraph("Performance Summary", h2_style))
    story.append(Paragraph(report.get("overall_summary", ""), body_style))
    story.append(Spacer(1, 8))

    # Levels row
    levels_table = Table(
        [[
            Paragraph(f"<b>Technical Level:</b> {report.get('technical_level', 'N/A')}", body_style),
            Paragraph(f"<b>Communication Level:</b> {report.get('communication_level', 'N/A')}", body_style),
        ]],
        colWidths=[257, 258]
    )
    story.append(levels_table)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#e0e7ff")))

    # --- Strengths & Weaknesses ---
    def list_section(title, items, color):
        result = [Paragraph(title, h2_style)]
        for item in (items or []):
            result.append(Paragraph(f"• {item}", bullet_style))
        return result

    story.extend(list_section("✅ Strengths", report.get("strengths", []), GREEN))
    story.append(Spacer(1, 4))
    story.extend(list_section("⚠️ Areas for Improvement", report.get("weaknesses", []), RED))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#e0e7ff")))

    # --- Hiring Recommendation ---
    story.append(Paragraph("Hiring Recommendation", h2_style))
    rec_style = ParagraphStyle(
        "Rec", fontSize=13, textColor=_rec_color(hiring_rec),
        fontName="Helvetica-Bold", spaceBefore=4, spaceAfter=8
    )
    story.append(Paragraph(f"🎯 {hiring_rec}", rec_style))
    story.append(Paragraph(report.get("recommendation_reason", ""), body_style))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#e0e7ff")))

    # --- Improvement Plan ---
    story.append(Paragraph("📈 Suggested Improvement Plan", h2_style))
    for i, item in enumerate(report.get("improvement_plan", []), start=1):
        story.append(Paragraph(f"{i}. {item}", bullet_style))

    story.append(Spacer(1, 24))
    footer_style = ParagraphStyle(
        "Footer", fontSize=8, textColor=GRAY, alignment=TA_CENTER, fontName="Helvetica"
    )
    story.append(Paragraph("Generated by AI Interview Bot • Confidential", footer_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
