/**
 * Matchup section tagging system.
 * Adds tag buttons to .source-section elements on matchup pages.
 * Tags are stored in matchup-tags.json via GitHub API (same token as notes sync).
 */

const GH_REPO = 'megaman111/ssbm-resources';
const GH_FILE = 'matchup-tags.json';
const GH_BRANCH = 'main';

let _matchupTags = {};
let _matchupName = '';

function getGhToken() { return localStorage.getItem('gh_token'); }

async function loadMatchupTags() {
    try {
        const r = await fetch('../matchup-tags.json?_=' + Date.now());
        if (r.ok) _matchupTags = await r.json();
    } catch {}
}

async function saveMatchupTags() {
    const token = getGhToken();
    if (!token) { alert('Connect GitHub token on the Notes page first to save tags.'); return false; }
    try {
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(_matchupTags, null, 2))));
        const fileRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}&_=${Date.now()}`, {
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
        });
        if (!fileRes.ok) throw new Error('Could not fetch SHA');
        const sha = (await fileRes.json()).sha;
        const putRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`, {
            method: 'PUT',
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update matchup tags', content, sha, branch: GH_BRANCH })
        });
        if (!putRes.ok) throw new Error((await putRes.json()).message || putRes.status);
        return true;
    } catch(e) { alert('Tag save failed: ' + e.message); return false; }
}

function getSectionKey(sectionEl) {
    // Build a stable key from the section's h3 text + parent h2 text
    const h3 = sectionEl.querySelector('h3');
    const parent = sectionEl.closest('.matchup-content');
    const h2 = parent ? parent.querySelector('h2') : null;
    const h3Text = h3 ? h3.textContent.trim() : '';
    const h2Text = h2 ? h2.textContent.trim() : '';
    const slug = (h2Text + '/' + h3Text).replace(/[^a-zA-Z0-9 \/]/g, '').replace(/\s+/g, '-').toLowerCase();
    return _matchupName + '/' + slug;
}

function getTagsForSection(key) {
    return _matchupTags[key] || [];
}

function renderSectionTags(sectionEl) {
    const key = getSectionKey(sectionEl);
    const tags = getTagsForSection(key);
    const sectionId = sectionEl.id || '';
    let tagBar = sectionEl.querySelector('.section-tag-bar');
    if (!tagBar) {
        tagBar = document.createElement('div');
        tagBar.className = 'section-tag-bar';
        tagBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid #ddd;';
        sectionEl.appendChild(tagBar);
    }
    const tagHtml = tags.map(t =>
        `<span style="background:#667eea22;color:#667eea;font-size:0.72rem;font-weight:600;padding:0.15rem 0.5rem;border-radius:12px;border:1px solid #667eea44;">#${t}</span>`
    ).join('');
    const shareBtn = sectionId
        ? `<button onclick="shareSection(this,'${sectionId}')" style="background:none;border:1px solid #aaa;color:#888;padding:0.15rem 0.5rem;border-radius:12px;cursor:pointer;font-size:0.72rem;">🔗 share</button>`
        : '';
    tagBar.innerHTML = tagHtml +
        `<button onclick="editSectionTags(this)" data-key="${key}" style="background:none;border:1px solid #aaa;color:#888;padding:0.15rem 0.5rem;border-radius:12px;cursor:pointer;font-size:0.72rem;">🏷️ ${tags.length ? 'edit' : 'add tags'}</button>` +
        shareBtn;
}

window.shareSection = (btn, sectionId) => {
    const url = location.origin + location.pathname + '#' + sectionId;
    navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✅ copied!';
        setTimeout(() => btn.textContent = orig, 2000);
    }).catch(() => prompt('Copy this link:', url));
};

window.editSectionTags = async (btn) => {
    const key = btn.dataset.key;
    const current = (_matchupTags[key] || []).join(', ');
    const input = prompt('Tags for this section (comma-separated):', current);
    if (input === null) return;
    const tags = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length) _matchupTags[key] = tags;
    else delete _matchupTags[key];
    const saved = await saveMatchupTags();
    if (saved) {
        const section = btn.closest('.source-section');
        if (section) renderSectionTags(section);
    }
};

export async function initMatchupTags(matchupName) {
    _matchupName = matchupName;
    await loadMatchupTags();
    document.querySelectorAll('.source-section').forEach(s => renderSectionTags(s));
    // Scroll to section if URL has a hash
    if (location.hash) {
        const el = document.getElementById(location.hash.slice(1));
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.outline = '3px solid #667eea';
                el.style.transition = 'outline 0.3s';
                setTimeout(() => { el.style.outline = 'none'; }, 3000);
            }, 300);
        }
    }
}

/**
 * Search matchup tags. Returns array of {matchup, section, tags, preview}.
 */
export async function searchMatchupTags(query) {
    if (!Object.keys(_matchupTags).length) {
        try {
            const r = await fetch('matchup-tags.json?_=' + Date.now());
            if (r.ok) _matchupTags = await r.json();
        } catch {}
    }
    const q = query.toLowerCase();
    const results = [];
    for (const [key, tags] of Object.entries(_matchupTags)) {
        const matchesTag = tags.some(t => t.includes(q));
        const matchesKey = key.toLowerCase().includes(q);
        if (matchesTag || matchesKey) {
            const parts = key.split('/');
            const matchup = parts[0];
            const section = parts.slice(1).join('/').replace(/-/g, ' ');
            results.push({ matchup, section, tags, key });
        }
    }
    return results;
}
