/**
 * Shared module for displaying tagged player notes on matchup pages.
 * Usage: import { buildRelatedNotes } from './note-tags.js';
 *        buildRelatedNotes('container-id', 'Marth');
 */
export async function buildRelatedNotes(containerId, character) {
    const el = document.getElementById(containerId);
    if (!el) return;
    try {
        const r = await fetch('../player-notes.json');
        if (!r.ok) return;
        const notes = await r.json();
        const matched = notes.filter(n =>
            n.character === character ||
            (n.tags || []).some(t => t.toLowerCase() === character.toLowerCase())
        );
        if (!matched.length) { el.innerHTML = '<p style="color:#888;">No tagged notes for this matchup yet.</p>'; return; }
        el.innerHTML = matched.map(n => {
            const tags = (n.tags || []).map(t =>
                `<span style="background:#667eea33;color:#667eea;font-size:0.7rem;padding:0.1rem 0.4rem;border-radius:8px;margin-left:0.25rem;">#${t}</span>`
            ).join('');
            const date = new Date(n.date).toLocaleDateString();
            return `<a href="../player-notes.html?note=${n.id}" style="display:block;background:#f0f1f3;padding:0.75rem 1rem;border-radius:8px;margin-bottom:0.5rem;text-decoration:none;color:#333;border-left:3px solid #667eea;">
                <div style="font-weight:700;color:#667eea;">${n.playerName}${tags}</div>
                <div style="font-size:0.8rem;color:#888;margin-top:0.25rem;">${date} · ${n.character}</div>
            </a>`;
        }).join('');
    } catch(e) { console.warn('Failed to load notes:', e); }
}
