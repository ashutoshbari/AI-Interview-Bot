import { NextResponse } from 'next/server';
import { getSession } from '@/lib/store';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const candidateId = Number(params.id);
    const session = getSession(candidateId);

    const name = session?.candidate?.name || 'Candidate';
    const position = session?.candidate?.position || 'Software Engineer';
    const answers = session?.answers || [];

    let techTotal = 75;
    let probTotal = 70;
    let commTotal = 80;

    if (answers.length > 0) {
        techTotal = Math.round(answers.reduce((acc, a) => acc + (a.technical_score ?? 75), 0) / answers.length);
        probTotal = Math.round(answers.reduce((acc, a) => acc + (a.depth_score ?? 75), 0) / answers.length);
        commTotal = Math.round(answers.reduce((acc, a) => acc + (a.communication_score ?? 80), 0) / answers.length);
    }

    const overallScore = Math.round((techTotal + probTotal + commTotal) / 3);
    const recommendation = overallScore >= 80 ? 'Strong Hire' : overallScore >= 65 ? 'Hire' : 'Needs Improvement';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ASHVANCE TECH - Interview Report - ${name}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo-badge {
      font-weight: 900;
      font-size: 20px;
      letter-spacing: -0.5px;
      color: #6366f1;
    }
    .tagline {
      font-size: 11px;
      color: #64748b;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 25px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .meta-item .label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }
    .meta-item .val {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .score-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      background: #ffffff;
    }
    .card.primary {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .card-score {
      font-size: 32px;
      font-weight: 900;
      color: #0f172a;
    }
    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-top: 4px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 25px;
      margin-bottom: 12px;
      border-left: 4px solid #6366f1;
      padding-left: 10px;
    }
    ul {
      margin: 0;
      padding-left: 20px;
      color: #334155;
    }
    li {
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .btn-print {
      background: #6366f1;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-badge">ASHVANCE TECH</div>
      <div class="tagline">Smart Interview AI Assessment</div>
    </div>
    <div class="no-print">
      <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <div class="label">Candidate Name</div>
      <div class="val">${name}</div>
    </div>
    <div class="meta-item">
      <div class="label">Role Evaluated</div>
      <div class="val">${position}</div>
    </div>
    <div class="meta-item">
      <div class="label">Executive Verdict</div>
      <div class="val" style="color: #16a34a;">${recommendation}</div>
    </div>
  </div>

  <div class="score-cards">
    <div class="card primary">
      <div class="card-score" style="color: #16a34a;">${overallScore}</div>
      <div class="card-label">Overall Composite</div>
    </div>
    <div class="card">
      <div class="card-score">${techTotal}</div>
      <div class="card-label">Technical Score</div>
    </div>
    <div class="card">
      <div class="card-score">${probTotal}</div>
      <div class="card-label">Problem Solving</div>
    </div>
    <div class="card">
      <div class="card-score">${commTotal}</div>
      <div class="card-label">Communication</div>
    </div>
  </div>

  <div class="section-title">Key Strengths Demonstrated</div>
  <ul>
    <li>Structured problem decomposition and architectural understanding.</li>
    <li>Clear, articulate verbal communication with contextual technical depth.</li>
    <li>Understanding of production resilience, code maintainability, and testing.</li>
  </ul>

  <div class="section-title">High-Priority Growth & Upskilling Areas</div>
  <ul>
    <li>Elaborate further with quantitative metrics (latency SLA, throughput benchmarks).</li>
    <li>Provide deeper architectural specifications when discussing distributed storage and consensus.</li>
  </ul>

  <div class="footer">
    <div>Generated by ASHVANCE TECH AI Interview Assessment Engine</div>
    <div>Official Candidate Scorecard • Confidential</div>
  </div>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}
