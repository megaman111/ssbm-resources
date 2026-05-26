import re, os

path = 'concepts.html'
content = open(path, encoding='utf-8').read()

# Add IDs to source-sections
def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:60]

lines = content.split('\n')
current_h2 = ''
changed = False
for i, line in enumerate(lines):
    m = re.search(r'<h2[^>]*>(.*?)</h2>', line)
    if m:
        current_h2 = re.sub(r'<[^>]+>', '', m.group(1)).strip()
    if 'class="source-section"' in line and 'id="' not in line:
        h3_text = ''
        for j in range(i+1, min(i+5, len(lines))):
            m3 = re.search(r'<h3[^>]*>(.*?)</h3>', lines[j])
            if m3:
                h3_text = re.sub(r'<[^>]+>', '', m3.group(1)).strip()
                break
        section_name = h3_text if h3_text else current_h2
        sid = slugify('concepts-' + section_name)
        lines[i] = line.replace('class="source-section"', 'class="source-section" id="' + sid + '"', 1)
        changed = True

content = '\n'.join(lines)

# Add related notes section and script before footer
if 'relatedNotes' not in content:
    section = """
    <section class="container" style="margin-top:2rem;">
        <div class="matchup-content" style="background:#ededf0;padding:2rem;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);margin-bottom:2rem;">
            <h2 style="color:#667eea;border-bottom:3px solid #667eea;padding-bottom:0.5rem;margin-bottom:1.5rem;">Related Notes</h2>
            <div id="relatedNotes"><p style="color:#888;">Loading...</p></div>
        </div>
    </section>
"""
    content = content.replace('    </main>\n\n    <footer>', '    </main>\n' + section + '\n    <footer>')

# Add script section before </body>
if 'matchup-tags-ui' not in content:
    script = """    <script type="module">
        import { buildRelatedNotes } from './note-tags.js';
        buildRelatedNotes('relatedNotes', 'Fox');
        import { initMatchupTags } from './matchup-tags-ui.js';
        initMatchupTags('concepts');
    </script>
"""
    content = content.replace('</body>', script + '</body>')

open(path, 'w', encoding='utf-8').write(content)
print('concepts.html updated')
