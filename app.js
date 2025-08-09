document.addEventListener("DOMContentLoaded", async () => {
  if (typeof registerChartPlugins === 'function') registerChartPlugins();
  await loadFullDataset();
  if (typeof initializeTabs === 'function') initializeTabs();
  if (typeof initializeFilters === 'function') initializeFilters();
  if (typeof initializeEventListeners === 'function') initializeEventListeners();

  const stateSel = document.getElementById('stateFilter');
  const selValues = Array.from(stateSel?.selectedOptions || []).map(o => o.value);
  const showAllStates = selValues.includes('__ALL__');
  const selectedStates = showAllStates ? [] : selValues.filter(v => v !== '__ALL__');
  if (typeof highlightMapStates === 'function') highlightMapStates(selectedStates);
  if (typeof labelSelectedStatesWithValues === 'function') labelSelectedStatesWithValues(selectedStates, filteredData);
  if (typeof setMapSubtitleAndFilters === 'function') setMapSubtitleAndFilters();
});


// === Helpers: DOM-safe utils ===
function parseSpending(value) {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function canonicalStateName(name) {
  if (!name) return 'Unknown';
  const n = String(name).trim().toLowerCase();
  if (["jammu and kashmir","jammu & kashmir"].includes(n)) return "Jammu and Kashmir";
  if ([
    "dadra and nagar haveli","daman and diu","dadra & nagar haveli",
    "dadra and nagar haveli and daman and diu","dādra and nagar haveli and damān and diu"
  ].includes(n)) return "Dādra and Nagar Haveli and Damān and Diu";
  if (["orissa","odisha"].includes(n)) return "Odisha";
  if (["uttaranchal","uttarakhand"].includes(n)) return "Uttarakhand";
  if (n.startsWith("pan india")) return "PAN India";
  if (n.includes("not mentioned") || n.startsWith("nec")) return "Unspecified geography";
  return String(name).trim();
}

function getSelectedFiltersSummary() {
  const statesSelect  = document.getElementById('stateFilter');
  const sectorsSelect = document.getElementById('sectorFilter');
  const psuSelect     = document.getElementById('psuFilter');
  const companyInput  = document.getElementById('companySearch');
  const parts = [];
  if (statesSelect) {
    const sel = Array.from(statesSelect.selectedOptions||[]).map(o=>o.value).filter(v=>v!=='__ALL__');
    if (sel.length) parts.push(`States: ${sel.join(', ')}`);
  }
  if (sectorsSelect) {
    const sel = Array.from(sectorsSelect.selectedOptions||[]).map(o=>o.value).filter(v=>v!=='__ALL__');
    if (sel.length) parts.push(`Sectors: ${sel.join(', ')}`);
  }
  if (psuSelect) {
    const sel = Array.from(psuSelect.selectedOptions||[]).map(o=>o.value).filter(v=>v!=='__ALL__');
    if (sel.length) parts.push(`PSU: ${sel.join(', ')}`);
  }
  if (companyInput && companyInput.value.trim()) parts.push(`Company: ${companyInput.value.trim()}`);
  return parts.join(' | ');
}

function setMapSubtitleAndFilters() {
  const mapTitleEl    = document.getElementById('mapTitle');
  const mapSubtitleEl = document.getElementById('mapSubtitle');
  const mapFiltersEl  = document.getElementById('mapFiltersApplied');
  if (mapTitleEl) mapTitleEl.textContent = 'India CSR Spending Map';
  const summary = getSelectedFiltersSummary();
  if (mapSubtitleEl) mapSubtitleEl.textContent = summary ? `FY 2023–24 • ${summary}` : 'FY 2023–24 • All data';
  if (mapFiltersEl)  mapFiltersEl.textContent  = summary ? `Filters applied: ${summary}` : 'Filters applied: None';
}

// === Globals ===
const csvUrl = '/api/fetch-sheet';
let rawData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50;

// === Map helpers ===
function ensureSvgLayers() {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return null;
  let layer = svg.querySelector('#labelsLayer');
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg','g');
    layer.setAttribute('id','labelsLayer');
    layer.setAttribute('pointer-events','none');
    svg.appendChild(layer);
  }
  return layer;
}

function buildStateIndex() {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return;
  const map = {};
  svg.querySelectorAll('path, g[id]').forEach(el=>{
    const key = (el.getAttribute('name') || el.getAttribute('id') || '').toLowerCase().replace(/[_-]+/g,' ').trim();
    if (key) map[key] = el;
  });
  window.__stateElByName = map;
}

function findStateElementByName(stateName) {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg || !stateName) return null;
  const key = stateName.toLowerCase().replace(/\s+/g,' ').trim();
  const m = window.__stateElByName || {};
  if (m[key]) return m[key];
  return svg.querySelector(`path[id="${stateName}"], path[name="${stateName}"], g[id="${stateName}"]`);
}

function getElementCenter(el) {
  const b = el.getBBox();
  return { x: b.x + b.width/2, y: b.y + b.height/2 };
}

function labelSelectedStatesWithValues(selectedStates, data) {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return;
  const layer = ensureSvgLayers();
  if (!layer) return;
  layer.innerHTML = '';

  // totals
  const totals = new Map();
  (data || []).forEach(r=>{
    const st = canonicalStateName(r['CSR State']);
    const amt = parseSpending(r['Project Amount Spent (In INR Cr.)']);
    totals.set(st, (totals.get(st)||0) + amt);
  });

  const targets = (selectedStates && selectedStates.length)
    ? selectedStates
    : Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n])=>n);

  targets.forEach(name=>{
    const el = findStateElementByName(name);
    if (!el) return;
    const {x,y} = getElementCenter(el);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','map-label');

    const nTxt = document.createElementNS('http://www.w3.org/2000/svg','text');
    nTxt.setAttribute('x', x);
    nTxt.setAttribute('y', y-8);
    nTxt.textContent = name;

    const vTxt = document.createElementNS('http://www.w3.org/2000/svg','text');
    vTxt.setAttribute('x', x);
    vTxt.setAttribute('y', y+10);
    const val = totals.get(name) || 0;
    vTxt.textContent = `₹${val.toLocaleString('en-IN',{maximumFractionDigits:2})} Cr`;
    vTxt.setAttribute('class','value');

    if (!selectedStates || !selectedStates.length) g.classList.add('map-label-muted');

    g.appendChild(nTxt);
    g.appendChild(vTxt);
    layer.appendChild(g);
  });
}

function highlightMapStates(canon) {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg || !Array.isArray(canon)) return;
  const paths = svg.querySelectorAll('path');
  paths.forEach(p=>{ p.style.fill='#7FB069'; p.classList.remove('state-selected'); });
  if (!canon.length) return;
  if (canon.includes('PAN India')) { paths.forEach(p=>{ p.style.fill='#1f7a8c'; p.classList.add('state-selected'); }); return; }
  canon.forEach(st => {
    svg.querySelectorAll(`path[id="${st}"], path[name="${st}"]`).forEach(p=>{
      p.style.fill='#1f7a8c'; p.classList.add('state-selected');
    });
  });
}

// === Data & UI ===
async function loadFullDataset() {
  const resp = await fetch(csvUrl);
  const csvText = await resp.text();
  return new Promise((resolve,reject)=>{
    Papa.parse(csvText, {
      header:true, skipEmptyLines:true, worker:true, dynamicTyping:false,
      complete: (parsed)=>{
        rawData = parsed.data.filter(r=>r['Company Name'] && r['Company Name'].trim());
        filteredData = rawData.slice();
        resolve();
      },
      error: (err)=> reject(err)
    });
  });
}

async function loadIndiaMap() {
  const response = await fetch('/india-states.svg');
  const svgText  = await response.text();
  const container = document.getElementById('indiaMap');
  if (!container) return;
  container.innerHTML = svgText;
  buildStateIndex();
  ensureSvgLayers();
}

function initializeFilters() {
  const stateSet = new Set(), sectorSet = new Set(), typeSet = new Set();
  rawData.forEach(r=>{
    const st = canonicalStateName(r['CSR State']);
    if (st && st !== 'Unknown') stateSet.add(st);
    const sec = r['CSR Development Sector']?.trim(); if (sec) sectorSet.add(sec);
    const typ = r['PSU/Non-PSU']?.trim();          if (typ) typeSet.add(typ);
  });
  populateMultiSelect('stateFilter',  Array.from(stateSet).sort());
  populateMultiSelect('sectorFilter', Array.from(sectorSet).sort());
  populateMultiSelect('psuFilter',    Array.from(typeSet).sort());
}

function populateMultiSelect(id, items) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value='__ALL__'; optAll.text='All'; optAll.selected=true;
  sel.appendChild(optAll);
  items.forEach(item=>{
    const o = document.createElement('option');
    o.value=item; o.text=item; sel.appendChild(o);
  });
}

function getFilterSelection() {
  const get = id => Array.from(document.getElementById(id)?.selectedOptions || []).map(o=>o.value);
  return {
    states:  get('stateFilter'),
    sectors: get('sectorFilter'),
    psu:     get('psuFilter'),
    company: (document.getElementById('companySearch')?.value || '').toLowerCase()
  };
}

function applyFilters() {
  const f = getFilterSelection();
  const showAllStates  = f.states.includes('__ALL__');
  const showAllSectors = f.sectors.includes('__ALL__');
  const showAllPSU     = f.psu.includes('__ALL__');

  filteredData = rawData.filter(row=>{
    const st = canonicalStateName(row['CSR State']);
    const stateOk  = showAllStates  || f.states.includes(st);
    const sectorOk = showAllSectors || f.sectors.includes(row['CSR Development Sector']);
    const psuOk    = showAllPSU     || f.psu.includes(row['PSU/Non-PSU']);
    const compOk   = !f.company || (row['Company Name']||'').toLowerCase().includes(f.company);
    return stateOk && sectorOk && psuOk && compOk;
  });

  currentPage = 1;
  updateDashboard();
  updateFilterResults();

  const selectedStates = showAllStates ? [] : f.states.filter(v=>v!=='__ALL__');
  highlightMapStates(selectedStates);
  labelSelectedStatesWithValues(selectedStates, filteredData);
  setMapSubtitleAndFilters();
}

function resetFilters() {
  ['stateFilter','sectorFilter','psuFilter'].forEach(id=>{
    const sel = document.getElementById(id); if (!sel) return;
    Array.from(sel.options).forEach(o=> o.selected = (o.value==='__ALL__'));
  });
  const cs = document.getElementById('companySearch'); if (cs) cs.value='';
  filteredData = rawData.slice();
  currentPage = 1;
  updateDashboard();
  updateFilterResults();
  highlightMapStates([]);
  labelSelectedStatesWithValues([], []);
  setMapSubtitleAndFilters();
}

function updateFilterResults() {
  const el = document.getElementById('filterResults');
  if (!el) return;
  if (filteredData.length === rawData.length) {
    el.textContent = `Showing all ${filteredData.length.toLocaleString()} records`;
    el.className = 'filter-status';
  } else {
    el.textContent = `Filtered: ${filteredData.length.toLocaleString()} of ${rawData.length.toLocaleString()} records`;
    el.className = 'filter-status filtered';
  }
}

// === Export PNG ===
function exportMapAsPNG() {
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  const vb = clone.viewBox && clone.viewBox.baseVal ? clone.viewBox.baseVal : null;
  const width  = vb && vb.width  ? vb.width  : (svg.clientWidth  || 1000);
  const height = vb && vb.height ? vb.height : (svg.clientHeight || 1000);
  clone.setAttribute('width', width);
  clone.setAttribute('height', height);
  const ser = new XMLSerializer();
  const url = URL.createObjectURL(new Blob([ser.serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const wm = document.querySelector('.map-watermark');
    if (wm) {
      ctx.globalAlpha = 0.15;
      ctx.font = '12px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim();
      ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillStyle='#000';
      ctx.fillText(wm.textContent || '', width-12, height-12);
      ctx.globalAlpha = 1;
    }
    const a = document.createElement('a');
    a.download='india_csr_map.png';
    a.href = canvas.toDataURL('image/png',1.0);
    a.click();
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// === Event wiring ===
function initializeEventListeners() {
  document.getElementById('stateFilter')?.addEventListener('change', applyFilters);
  document.getElementById('sectorFilter')?.addEventListener('change', applyFilters);
  document.getElementById('psuFilter')?.addEventListener('change', applyFilters);
  document.getElementById('companySearch')?.addEventListener('input', applyFilters);
  document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
  document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
  document.getElementById('exportFilteredData')?.addEventListener('click', exportFilteredData);
  document.getElementById('exportStatesData')?.addEventListener('click', exportStatesData);
  document.getElementById('exportSectorsData')?.addEventListener('click', exportSectorsData);
  document.getElementById('exportCompaniesData')?.addEventListener('click', exportCompaniesData);
  document.getElementById('exportMapPng')?.addEventListener('click', exportMapAsPNG);
}

// === Placeholder no-ops for tables/charts (kept minimal to avoid breaking other parts) ===
function updateDashboard(){ /* keep your existing chart/table update calls here if present */ }
function changePage(){ /* keep paging wired to your existing table */ }
function exportFilteredData(){ /* implemented elsewhere in your codebase */ }
function exportStatesData(){ /* implemented elsewhere */ }
function exportSectorsData(){ /* implemented elsewhere */ }
function exportCompaniesData(){ /* implemented elsewhere */ }

// === Bootstrap ===
