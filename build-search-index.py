"""Build search-index.json from all matchup page sections."""
import os, re, json

def strip_html(text):
    return re.sub(r'<[^>]+>', '', text).strip()

def extract_text(html_block):
    """Extract readable text from a source-section block."""
    lines = []
    for li in re.findall(r'<li>(.*?)</li>', html_block, re.DOTALL):
        t = strip_html(li).strip()
        if t:
            lines.append(t)
    if not lines:
        # fallback: just strip all tags
        t = strip_html(html_block).strip()
        if t:
            lines = [s.strip() for s in t.split('\n') if s.strip()]
    return lines

index = []

# Index matchup pages
for f in sorted(os.listdir('matchups')):
    if not f.endswith('.html'): continue
    path = os.path.join('matchups', f)
    content = open(path, encoding='utf-8').read()
    matchup = f.replace('.html', '')
    
    for m in re.finditer(r'<div\s+class="source-section"\s+id="([^"]+)"[^>]*>(.*?)</div>\s*(?=<div|</div>)', content, re.DOTALL):
        sid = m.group(1)
        block = m.group(2)
        h3 = re.search(r'<h3[^>]*>(.*?)</h3>', block)
        title = strip_html(h3.group(1)) if h3 else ''
        pos = m.start()
        h2_matches = list(re.finditer(r'<h2[^>]*>(.*?)</h2>', content[:pos]))
        h2_title = strip_html(h2_matches[-1].group(1)) if h2_matches else ''
        bullets = extract_text(block)
        preview = ' · '.join(bullets[:3])
        if len(preview) > 200:
            preview = preview[:200] + '...'
        index.append({
            'matchup': matchup,
            'file': 'matchups/' + f,
            'id': sid,
            'h2': h2_title,
            'h3': title,
            'preview': preview,
            'text': ' '.join(bullets).lower()
        })

# Index root-level pages with source-sections (concepts.html, etc.)
for f in ['concepts.html']:
    if not os.path.exists(f): continue
    content = open(f, encoding='utf-8').read()
    slug = f.replace('.html', '')
    
    for m in re.finditer(r'<div\s+class="source-section"\s+id="([^"]+)"[^>]*>(.*?)</div>\s*(?=<div|</div>)', content, re.DOTALL):
        sid = m.group(1)
        block = m.group(2)
        h3 = re.search(r'<h3[^>]*>(.*?)</h3>', block)
        title = strip_html(h3.group(1)) if h3 else ''
        pos = m.start()
        h2_matches = list(re.finditer(r'<h2[^>]*>(.*?)</h2>', content[:pos]))
        h2_title = strip_html(h2_matches[-1].group(1)) if h2_matches else ''
        bullets = extract_text(block)
        preview = ' · '.join(bullets[:3])
        if len(preview) > 200:
            preview = preview[:200] + '...'
        index.append({
            'matchup': slug,
            'file': f,
            'id': sid,
            'h2': h2_title,
            'h3': title,
            'preview': preview,
            'text': ' '.join(bullets).lower()
        })

with open('search-index.json', 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2, ensure_ascii=False)

print(f'Built index with {len(index)} sections')
