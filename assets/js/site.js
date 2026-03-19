const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function repoBase() {
  const depth = location.pathname.split('/').filter(Boolean).length;
  if (location.pathname.endsWith('.html') && depth >= 2) return '../';
  if (location.pathname.includes('/papers/') || location.pathname.includes('/topics/') || location.pathname.includes('/updates/')) return '../';
  return '';
}

const BASE = repoBase();

function toggleTheme() {
  const key = 'eye-ai-theme';
  const saved = localStorage.getItem(key);
  if (saved) document.documentElement.dataset.theme = saved;
  const btn = $('[data-theme-toggle]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(key, next);
  });
}

async function loadPapers() {
  const res = await fetch(`${BASE}data/papers.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load papers.json: ${res.status}`);
  return res.json();
}

function figurePath(path) {
  if (!path) return `${BASE}assets/images/placeholder-model.svg`;
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

function paperCard(p) {
  const tags = (p.topics || []).map(t => `<span class="badge">${t}</span>`).join('');
  const modalities = (p.modality || []).join(', ');
  const link = p.link ? `<a class="btn secondary" href="${p.link}" target="_blank" rel="noopener">Original link</a>` : `<span class="small">Original link pending</span>`;
  const code = p.code_url ? `<a class="btn secondary" href="${p.code_url}" target="_blank" rel="noopener">Code</a>` : '';
  return `
    <article class="card paper-card">
      <div class="card-media"><img src="${figurePath(p.model_figure_url_or_path)}" alt="${p.short_title || p.title} model figure" loading="lazy"></div>
      <div class="card-body">
        <div class="paper-meta-row"><span class="flag">${p.priority}</span><span class="small">${p.highlight}</span></div>
        <h3>${p.title}</h3>
        <p class="small">${p.venue} · ${p.year} · ${p.venue_type}</p>
        <p>${p.summary}</p>
        <p class="small"><strong>Modality:</strong> ${modalities || 'n/a'}</p>
        <div class="tags">${tags}</div>
        <p class="small muted">${p.notes || ''}</p>
        <div class="actions">${link}${code}</div>
      </div>
    </article>`;
}

function renderHome(data) {
  const root = $('#home-highlights');
  if (!root) return;
  const picks = [...data.papers].sort((a, b) => ['S','A','B','C'].indexOf(a.priority) - ['S','A','B','C'].indexOf(b.priority)).slice(0, 4);
  root.innerHTML = picks.map(paperCard).join('');
  const stamp = $('[data-last-updated]');
  if (stamp) stamp.textContent = data.meta.generated_at.slice(0, 10);
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))];
}

function renderPapersPage(data) {
  const root = $('#papers-grid');
  if (!root) return;
  const search = $('#search');
  const topic = $('#topic-filter');
  const modality = $('#modality-filter');
  const year = $('#year-filter');
  const priority = $('#priority-filter');
  const count = $('#results-count');

  topic.innerHTML += (data.meta.topics || []).map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  modality.innerHTML += unique(data.papers.map(p => p.modality || [])).sort().map(m => `<option value="${m}">${m}</option>`).join('');
  year.innerHTML += [...new Set(data.papers.map(p => p.year))].sort((a,b)=>b-a).map(y => `<option value="${y}">${y}</option>`).join('');

  function apply() {
    const q = (search.value || '').trim().toLowerCase();
    let items = [...data.papers].filter(p => {
      const hay = [p.title, p.short_title, p.summary, p.venue, ...(p.topics || []), ...(p.modality || []), ...(p.task_tags || []), ...(p.disease_tags || [])].join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (topic.value && !(p.topics || []).includes(topic.value)) return false;
      if (modality.value && !(p.modality || []).includes(modality.value)) return false;
      if (year.value && String(p.year) !== year.value) return false;
      if (priority.value && p.priority !== priority.value) return false;
      return true;
    });
    items.sort((a, b) => ['S','A','B','C'].indexOf(a.priority) - ['S','A','B','C'].indexOf(b.priority) || b.year - a.year);
    root.innerHTML = items.map(paperCard).join('') || '<p class="small">No papers match the current filters.</p>';
    count.textContent = `${items.length} / ${data.papers.length} papers`;
  }

  [search, topic, modality, year, priority].forEach(el => el.addEventListener('input', apply));
  [topic, modality, year, priority].forEach(el => el.addEventListener('change', apply));
  apply();
}

function renderTopicPage(data) {
  const page = $('main[data-topic]');
  if (!page) return;
  const topicId = page.dataset.topic;
  const grid = $('#topic-grid');
  const count = $('[data-topic-count]');
  const items = data.papers.filter(p => (p.topics || []).includes(topicId));
  grid.innerHTML = items.map(paperCard).join('') || '<p class="small">This topic currently has few ophthalmic-native papers; the page is ready for expansion.</p>';
  if (count) count.textContent = String(items.length);
}

function renderUpdates(data) {
  const root = $('#updates-root');
  if (!root) return;
  root.innerHTML = `
    <div class="card">
      <h3>Automation-ready update log</h3>
      <p>This page is prepared for future cron-based updates. A daily or weekly job can append newly verified papers, refreshed metadata, figure assets, and ranking notes.</p>
      <ul>
        <li>Latest dataset refresh: <strong>${data.meta.generated_at.slice(0, 10)}</strong></li>
        <li>Current seed papers: <strong>${data.papers.length}</strong></li>
        <li>Next step: add validated visual grounding, PEFT, and hyperbolic entries from the last five years.</li>
      </ul>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  toggleTheme();
  try {
    const data = await loadPapers();
    renderHome(data);
    renderPapersPage(data);
    renderTopicPage(data);
    renderUpdates(data);
  } catch (err) {
    console.error(err);
    $$('.js-data-error').forEach(el => el.textContent = 'Failed to load dataset.');
  }
});