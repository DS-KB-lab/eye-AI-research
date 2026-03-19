const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const PRIORITY_ORDER = ["S", "A", "B", "C"];

function repoBase() {
  const depth = location.pathname.split("/").filter(Boolean).length;
  if (location.pathname.endsWith(".html") && depth >= 2) return "../";
  if (location.pathname.includes("/papers/") || location.pathname.includes("/topics/") || location.pathname.includes("/updates/")) return "../";
  return "";
}

const BASE = repoBase();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function figurePath(path) {
  if (!path) return `${BASE}assets/images/placeholder-model.svg`;
  if (path.startsWith("http")) return path;
  return `${BASE}${path}`;
}

function hasPublicFigure(path) {
  return Boolean(path) && !path.includes("placeholder");
}

function priorityRank(priority) {
  const idx = PRIORITY_ORDER.indexOf(priority);
  return idx === -1 ? PRIORITY_ORDER.length : idx;
}

function sortPapers(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority) || b.year - a.year || a.title.localeCompare(b.title);
}

function topicMap(data) {
  return new Map((data.meta.topics || []).map((topic) => [topic.id, topic.label]));
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))];
}

function statsFor(data) {
  const papers = data.papers || [];
  return {
    paperCount: papers.length,
    venueCount: new Set(papers.map((paper) => paper.venue).filter(Boolean)).size,
    figureCount: papers.filter((paper) => hasPublicFigure(paper.model_figure_url_or_path)).length,
    topicCounts: Object.fromEntries((data.meta.topics || []).map((topic) => [topic.id, papers.filter((paper) => (paper.topics || []).includes(topic.id)).length]))
  };
}

function setDatasetStats(data) {
  const stats = statsFor(data);
  $$("[data-paper-count]").forEach((el) => { el.textContent = String(stats.paperCount); });
  $$("[data-venue-count]").forEach((el) => { el.textContent = String(stats.venueCount); });
  $$("[data-figure-count]").forEach((el) => { el.textContent = String(stats.figureCount); });
  Object.entries(stats.topicCounts).forEach(([topicId, count]) => {
    $$(`[data-topic-stat="${topicId}"]`).forEach((el) => { el.textContent = String(count); });
  });
}

function pillMarkup(items, className = "badge") {
  return items.map((item) => `<span class="${className}">${escapeHtml(item)}</span>`).join("");
}

function paperCard(paper, labels) {
  const topics = (paper.topics || []).map((topicId) => labels.get(topicId) || topicId);
  const modalities = (paper.modality || []).length ? paper.modality : ["n/a"];
  const source = paper.link
    ? `<a class="btn" href="${paper.link}" target="_blank" rel="noopener">Official source</a>`
    : `<span class="small">Official source pending</span>`;
  const code = paper.code_url
    ? `<a class="btn" href="${paper.code_url}" target="_blank" rel="noopener">Code</a>`
    : "";
  const figureClass = hasPublicFigure(paper.model_figure_url_or_path) ? "paper-visual" : "paper-visual is-placeholder";
  const note = paper.notes ? `<p class="paper-note">${escapeHtml(paper.notes)}</p>` : "";
  const highlight = paper.highlight && paper.highlight !== "none" ? `<span class="badge">${escapeHtml(paper.highlight)}</span>` : "";

  return `
    <article class="card paper-card">
      <div class="${figureClass}">
        <img src="${figurePath(paper.model_figure_url_or_path)}" alt="${escapeHtml(paper.short_title || paper.title)} model figure" loading="lazy">
      </div>
      <div class="card-body paper-card-body">
        <div class="paper-topline">
          <span class="flag priority-${escapeHtml(paper.priority || "C")}">${escapeHtml(paper.priority || "C")}</span>
          <span class="badge">${escapeHtml(paper.venue_type || "paper")}</span>
          ${highlight}
        </div>
        <p class="paper-short-title">${escapeHtml(paper.short_title || paper.title)}</p>
        <div>
          <h3>${escapeHtml(paper.title)}</h3>
          <p class="paper-citation">${escapeHtml(paper.venue)} · ${escapeHtml(paper.year)}</p>
        </div>
        <p class="paper-summary">${escapeHtml(paper.summary || "")}</p>
        <div class="paper-meta-grid">
          <div>
            <span class="field-label">Topics</span>
            <div class="tags">${pillMarkup(topics)}</div>
          </div>
          <div>
            <span class="field-label">Modalities</span>
            <div class="tags">${pillMarkup(modalities)}</div>
          </div>
        </div>
        ${note}
        <div class="actions">${source}${code}</div>
      </div>
    </article>`;
}

function featuredPapers(data) {
  const papers = [...(data.papers || [])].sort(sortPapers);
  const picks = [];
  const seen = new Set();
  for (const topic of data.meta.topics || []) {
    const pick = papers.find((paper) => (paper.topics || []).includes(topic.id) && !seen.has(paper.id));
    if (!pick) continue;
    picks.push(pick);
    seen.add(pick.id);
    if (picks.length === 4) return picks;
  }
  for (const paper of papers) {
    if (seen.has(paper.id)) continue;
    picks.push(paper);
    if (picks.length === 4) break;
  }
  return picks;
}

function syncThemeButton(button) {
  if (!button) return;
  button.textContent = document.documentElement.dataset.theme === "light" ? "Dark theme" : "Light theme";
}

function toggleTheme() {
  const key = "eye-ai-theme";
  const saved = localStorage.getItem(key);
  const preferred = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.dataset.theme = preferred;
  const button = $("[data-theme-toggle]");
  syncThemeButton(button);
  if (!button) return;
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(key, next);
    syncThemeButton(button);
  });
}

async function loadPapers() {
  const res = await fetch(`${BASE}data/papers.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load papers.json: ${res.status}`);
  return res.json();
}

function renderHome(data, labels) {
  const root = $("#home-highlights");
  if (!root) return;
  root.innerHTML = featuredPapers(data).map((paper) => paperCard(paper, labels)).join("");
  const stamp = $("[data-last-updated]");
  if (stamp) stamp.textContent = data.meta.generated_at.slice(0, 10);
}

function renderPapersPage(data, labels) {
  const root = $("#papers-grid");
  if (!root) return;

  const search = $("#search");
  const topic = $("#topic-filter");
  const venue = $("#venue-filter");
  const modality = $("#modality-filter");
  const year = $("#year-filter");
  const priority = $("#priority-filter");
  const count = $("#results-count");
  const activeFilters = $("#active-filters");
  const reset = $("#reset-filters");

  topic.innerHTML += (data.meta.topics || []).map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("");
  venue.innerHTML += [...new Set(data.papers.map((paper) => paper.venue).filter(Boolean))]
    .sort()
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  modality.innerHTML += unique(data.papers.map((paper) => paper.modality || []))
    .sort()
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  year.innerHTML += [...new Set(data.papers.map((paper) => paper.year))]
    .sort((a, b) => b - a)
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("");

  function clearFilters() {
    search.value = "";
    topic.value = "";
    venue.value = "";
    modality.value = "";
    year.value = "";
    priority.value = "";
    apply();
  }

  function activeFilterList(query) {
    const items = [];
    if (query) items.push(`Search: ${query}`);
    if (topic.value) items.push(`Topic: ${labels.get(topic.value) || topic.value}`);
    if (venue.value) items.push(`Venue: ${venue.value}`);
    if (modality.value) items.push(`Modality: ${modality.value}`);
    if (year.value) items.push(`Year: ${year.value}`);
    if (priority.value) items.push(`Priority: ${priority.value}`);
    return items;
  }

  function apply() {
    const query = (search.value || "").trim().toLowerCase();
    const items = [...data.papers].filter((paper) => {
      const haystack = [
        paper.title,
        paper.short_title,
        paper.summary,
        paper.venue,
        ...(paper.topics || []),
        ...(paper.modality || []),
        ...(paper.task_tags || []),
        ...(paper.disease_tags || [])
      ].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (topic.value && !(paper.topics || []).includes(topic.value)) return false;
      if (venue.value && paper.venue !== venue.value) return false;
      if (modality.value && !(paper.modality || []).includes(modality.value)) return false;
      if (year.value && String(paper.year) !== year.value) return false;
      if (priority.value && paper.priority !== priority.value) return false;
      return true;
    }).sort(sortPapers);

    const visibleVenues = new Set(items.map((paper) => paper.venue).filter(Boolean)).size;
    const filters = activeFilterList(query);
    root.innerHTML = items.map((paper) => paperCard(paper, labels)).join("") || '<div class="empty-state">No papers match the current filters.</div>';
    count.textContent = `${items.length} of ${data.papers.length} papers visible${items.length ? ` · ${visibleVenues} venues in view` : ""}`;
    activeFilters.innerHTML = filters.length ? pillMarkup(filters) : '<span class="small">No filters active.</span>';
    if (reset) reset.disabled = filters.length === 0;
  }

  if (reset) reset.addEventListener("click", clearFilters);
  [search, topic, venue, modality, year, priority].filter(Boolean).forEach((element) => {
    element.addEventListener("input", apply);
    element.addEventListener("change", apply);
  });

  apply();
}

function renderTopicPage(data, labels) {
  const page = $("main[data-topic]");
  if (!page) return;
  const topicId = page.dataset.topic;
  const grid = $("#topic-grid");
  const count = $("[data-topic-count]");
  const items = data.papers.filter((paper) => (paper.topics || []).includes(topicId)).sort(sortPapers);
  grid.innerHTML = items.map((paper) => paperCard(paper, labels)).join("") || '<div class="empty-state">This topic is ready for more whitelist-compliant papers.</div>';
  if (count) count.textContent = String(items.length);
}

function renderUpdates(data) {
  const root = $("#updates-root");
  if (!root) return;
  const stats = statsFor(data);
  root.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h3>Automation-ready update log</h3>
        <p>The public catalog now follows a strict venue-first policy. Local PDFs, extraction cache, and candidate figures stay local until a clean public figure is promoted into <code>assets/figures/</code>.</p>
        <ul>
          <li>Latest dataset refresh: <strong>${escapeHtml(data.meta.generated_at.slice(0, 10))}</strong></li>
          <li>Current public papers: <strong>${stats.paperCount}</strong></li>
          <li>Approved venues represented: <strong>${stats.venueCount}</strong></li>
          <li>Public cards with promoted figures: <strong>${stats.figureCount}</strong></li>
        </ul>
      </div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  toggleTheme();
  try {
    const data = await loadPapers();
    const labels = topicMap(data);
    setDatasetStats(data);
    renderHome(data, labels);
    renderPapersPage(data, labels);
    renderTopicPage(data, labels);
    renderUpdates(data);
  } catch (error) {
    console.error(error);
    $$(".js-data-error").forEach((el) => { el.textContent = "Failed to load dataset."; });
  }
});
