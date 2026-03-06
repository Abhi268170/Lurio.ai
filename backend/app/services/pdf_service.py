import re
from datetime import datetime

import mistune
from weasyprint import HTML

PRIMARY = "#4F46E5"
PRIMARY_LIGHT = "#EEF2FF"
DARK = "#0F172A"
MUTED = "#64748B"
BORDER = "#E2E8F0"
CODE_BG = "#F8FAFC"

CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}

body {{
    font-family: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    color: {DARK};
}}

@page {{
    size: A4;
    margin: 2.5cm 2.5cm 3cm 2.5cm;
    @bottom-center {{
        content: counter(page);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 9pt;
        color: {MUTED};
    }}
}}

@page cover {{
    margin: 0;
    @bottom-center {{ content: none; }}
}}

/* ─── Cover Page ─────────────────────────────── */
.cover-page {{
    page: cover;
    page-break-after: always;
    position: relative;
    width: 210mm;
    height: 297mm;
    background: {DARK};
    overflow: hidden;
}}

.cover-brand {{
    position: absolute;
    top: 3cm;
    left: 3cm;
    right: 3cm;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.35em;
    color: {PRIMARY};
}}

.cover-main {{
    position: absolute;
    top: 8.5cm;
    left: 3cm;
    right: 3cm;
}}

.cover-accent-bar {{
    width: 56px;
    height: 4px;
    background: {PRIMARY};
    margin-bottom: 0.7cm;
    border-radius: 2px;
}}

.cover-title {{
    font-size: 28pt;
    font-weight: 700;
    line-height: 1.2;
    color: white;
    margin-bottom: 0.4cm;
}}

.cover-topic {{
    font-size: 12pt;
    color: rgba(255,255,255,0.5);
    margin-bottom: 0.8cm;
}}

.cover-divider {{
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin-bottom: 0.7cm;
}}

.cover-meta {{
    display: table;
    width: 100%;
}}

.cover-meta-col {{
    display: table-cell;
    padding-right: 1cm;
}}

.cover-meta-label {{
    font-size: 7pt;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 3px;
}}

.cover-meta-value {{
    font-size: 9.5pt;
    color: rgba(255,255,255,0.85);
    font-weight: 600;
}}

.cover-footer {{
    position: absolute;
    bottom: 2.5cm;
    left: 3cm;
    right: 3cm;
    font-size: 8pt;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.04em;
}}

/* ─── TOC ────────────────────────────────────── */
.toc-page {{
    page-break-after: always;
    padding-top: 0.5cm;
}}

.section-label {{
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: {PRIMARY};
    margin-bottom: 0.8cm;
    padding-bottom: 0.3cm;
    border-bottom: 2px solid {PRIMARY};
}}

.toc-list {{
    list-style: none;
}}

.toc-list li {{
    display: table;
    width: 100%;
    padding: 0.4cm 0;
    border-bottom: 1px solid {BORDER};
}}

.toc-num {{
    display: table-cell;
    font-size: 8.5pt;
    font-weight: 700;
    color: {PRIMARY};
    width: 1.8em;
    vertical-align: middle;
}}

.toc-title {{
    display: table-cell;
    font-size: 11pt;
    font-weight: 500;
    color: {DARK};
    vertical-align: middle;
}}

/* ─── Chapters ───────────────────────────────── */
.chapter {{
    page-break-before: always;
}}

.chapter-header {{
    padding-bottom: 0.5cm;
    margin-bottom: 0.8cm;
    border-bottom: 3px solid {PRIMARY};
}}

.chapter-eyebrow {{
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: {PRIMARY};
    margin-bottom: 0.2cm;
}}

.chapter-title {{
    font-size: 20pt;
    font-weight: 700;
    color: {DARK};
    line-height: 1.25;
}}

/* ─── Markdown Content ───────────────────────── */
.chapter-content h1,
.chapter-content h2,
.chapter-content h3 {{
    margin-top: 1em;
    margin-bottom: 0.3em;
    line-height: 1.3;
    page-break-after: avoid;
}}

.chapter-content h2 {{
    font-size: 12.5pt;
    font-weight: 700;
    color: {PRIMARY};
    margin-top: 1.2em;
}}

.chapter-content h3 {{
    font-size: 11pt;
    font-weight: 600;
    color: {DARK};
}}

.chapter-content p {{
    margin-bottom: 0.55em;
}}

.chapter-content ul,
.chapter-content ol {{
    margin: 0.4em 0 0.7em 1.4em;
}}

.chapter-content li {{
    margin-bottom: 0.25em;
}}

.chapter-content strong {{
    font-weight: 700;
}}

.chapter-content em {{
    font-style: italic;
}}

.chapter-content hr {{
    border: none;
    border-top: 1px solid {BORDER};
    margin: 0.8em 0;
}}

.chapter-content code {{
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    background: {CODE_BG};
    border: 1px solid {BORDER};
    border-radius: 3px;
    padding: 1px 5px;
    color: #7C3AED;
}}

.chapter-content pre {{
    background: {CODE_BG};
    border: 1px solid {BORDER};
    border-left: 4px solid {PRIMARY};
    border-radius: 4px;
    padding: 0.4cm 0.5cm;
    margin: 0.7em 0;
    page-break-inside: avoid;
}}

.chapter-content pre code {{
    background: none;
    border: none;
    padding: 0;
    font-size: 9pt;
    line-height: 1.6;
    color: {DARK};
}}

.chapter-content table {{
    width: 100%;
    border-collapse: collapse;
    margin: 0.7em 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}}

.chapter-content th {{
    background: {PRIMARY};
    color: white;
    padding: 0.22cm 0.4cm;
    text-align: left;
    font-weight: 600;
    font-size: 8.5pt;
    letter-spacing: 0.03em;
}}

.chapter-content td {{
    padding: 0.2cm 0.4cm;
    border-bottom: 1px solid {BORDER};
    vertical-align: top;
}}

.chapter-content tr:nth-child(even) td {{
    background: {PRIMARY_LIGHT};
}}

.chapter-content blockquote {{
    margin: 0.7em 0;
    padding: 0.35cm 0.55cm;
    background: {PRIMARY_LIGHT};
    border-left: 4px solid {PRIMARY};
    border-radius: 0 4px 4px 0;
    color: {MUTED};
    font-style: italic;
}}

/* ─── Math & Diagrams ────────────────────────── */
.math-block {{
    background: #FAFAFA;
    border: 1px solid {BORDER};
    border-left: 4px solid #7C3AED;
    border-radius: 0 4px 4px 0;
    padding: 0.35cm 0.5cm;
    margin: 0.7em 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10.5pt;
    text-align: center;
    color: #5B21B6;
    page-break-inside: avoid;
}}

.math-inline {{
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5pt;
    color: #7C3AED;
    background: #F5F3FF;
    padding: 1px 4px;
    border-radius: 3px;
}}

.diagram-note {{
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    border-radius: 6px;
    padding: 0.3cm 0.5cm;
    margin: 0.7em 0;
    font-size: 9.5pt;
    color: #166534;
    font-style: italic;
}}
"""


def _title_case(s: str) -> str:
    """Proper title case preserving short words in middle positions."""
    minor = {'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on',
             'at', 'to', 'by', 'in', 'of', 'up', 'as', 'vs'}
    words = s.split()
    return ' '.join(
        w.capitalize() if i == 0 or w.lower() not in minor else w.lower()
        for i, w in enumerate(words)
    )


def _strip_leading_title(text: str, module_title: str) -> str:
    """
    Remove the LLM-generated H1/H2 title from module content so it doesn't
    duplicate the chapter header we render ourselves.
    Also strips sub-lines like 'Module X of "Course"'.
    """
    text = text.strip()
    # Strip first H1 or H2 heading
    text = re.sub(r'^#{1,2}[^\n]*\n?', '', text, count=1).strip()
    # Strip lines like: Module 3 of "Electric Current"
    text = re.sub(r'^Module\s+\d+\s+of\s+[^\n]*\n?', '', text, flags=re.IGNORECASE, count=1).strip()
    # Strip a bare subtitle that duplicates the module title (LLM sometimes adds it as italic or plain)
    escaped = re.escape(module_title)
    text = re.sub(rf'^[_*]?{escaped}[_*]?\s*\n?', '', text, flags=re.IGNORECASE, count=1).strip()
    return text


def _preprocess_markdown(text: str) -> str:
    """Handle Mermaid and LaTeX before markdown parsing."""
    # Mermaid blocks → styled placeholder
    text = re.sub(
        r'```mermaid\n(.*?)```',
        '<div class="diagram-note">Diagram — view in the Lurio app for interactive visualization</div>',
        text,
        flags=re.DOTALL,
    )
    # Block math $$...$$
    text = re.sub(
        r'\$\$(.*?)\$\$',
        lambda m: f'<div class="math-block">{m.group(1).strip()}</div>',
        text,
        flags=re.DOTALL,
    )
    # Inline math $...$
    text = re.sub(
        r'(?<!\$)\$([^$\n]+?)\$(?!\$)',
        lambda m: f'<span class="math-inline">{m.group(1)}</span>',
        text,
    )
    return text


def _markdown_to_html(text: str) -> str:
    text = _preprocess_markdown(text)
    md = mistune.create_markdown(plugins=['table', 'strikethrough'])
    return md(text)


def _build_toc(modules) -> str:
    items = "".join(
        f'<li><span class="toc-num">{i}</span><span class="toc-title">{m.title}</span></li>'
        for i, m in enumerate(modules, 1)
    )
    return f"""<div class="toc-page">
    <div class="section-label">Table of Contents</div>
    <ol class="toc-list">{items}</ol>
</div>"""


def _build_chapter(module, index: int) -> str:
    raw = _strip_leading_title(module.content or "", module.title)
    content_html = _markdown_to_html(raw)
    return f"""<div class="chapter">
    <div class="chapter-header">
        <div class="chapter-eyebrow">Module {index}</div>
        <h1 class="chapter-title">{module.title}</h1>
    </div>
    <div class="chapter-content">
        {content_html}
    </div>
</div>"""


def generate_course_pdf(course, modules) -> bytes:
    date_str = datetime.now().strftime("%B %Y")
    difficulty = (course.difficulty or "Standard").capitalize()
    display_title = _title_case(course.title)

    # Only show topic subtitle if it adds info beyond the title
    show_topic = course.topic.strip().lower() != course.title.strip().lower()
    topic_html = f'<div class="cover-topic">{course.topic}</div>' if show_topic else ''

    cover = f"""<div class="cover-page">
    <div class="cover-brand">LURIO</div>
    <div class="cover-main">
        <div class="cover-accent-bar"></div>
        <div class="cover-title">{display_title}</div>
        {topic_html}
        <div class="cover-divider"></div>
        <div class="cover-meta">
            <div class="cover-meta-col">
                <div class="cover-meta-label">Difficulty</div>
                <div class="cover-meta-value">{difficulty}</div>
            </div>
            <div class="cover-meta-col">
                <div class="cover-meta-label">Modules</div>
                <div class="cover-meta-value">{len(modules)}</div>
            </div>
            <div class="cover-meta-col">
                <div class="cover-meta-label">Generated</div>
                <div class="cover-meta-value">{date_str}</div>
            </div>
        </div>
    </div>
    <div class="cover-footer">Powered by Lurio AI Learning Platform</div>
</div>"""

    toc = _build_toc(modules)
    chapters = "\n".join(_build_chapter(m, i) for i, m in enumerate(modules, 1))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{display_title}</title>
    <style>{CSS}</style>
</head>
<body>
{cover}
{toc}
{chapters}
</body>
</html>"""

    return HTML(string=html).write_pdf()
