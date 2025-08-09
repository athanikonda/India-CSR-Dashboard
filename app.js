// app.revised.js
// Complete CSR Dashboard script with enhanced chart features and map labels
// Includes watermark, dynamic subtitle with dashboard title and selected filters,
// vertical y‑axis labels, bar value labels via Chart.js datalabels plugin,
// and map value labels for selected states.

// NOTE: To use this script you must load Chart.js and the chartjs-plugin-datalabels
// in your HTML. Example:
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>

console.log("Initializing enhanced dashboard...");

const csvUrl = '/api/fetch-sheet';

let rawData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50;

// Chart instances to properly destroy/recreate
let overviewStatesChartInstance = null;
let overviewSectorsChartInstance = null;
let statesChartInstance = null;
let sectorsChartInstance = null;
let companiesChartInstance = null;

// Custom watermark plugin definition
const customWatermark = {
  id: 'customWatermark',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const width = chart.width;
    const height = chart.height;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Prepared by Ashok Thanikonda', width - 10, height /2);
    ctx.restore();
  }
};

// Register plugins when Chart is available
function registerChartPlugins() {
  if (typeof Chart !== 'undefined' && Chart.register) {
    if (typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
    }
    Chart.register(customWatermark);
  }
}

// Resolve CSS variable to a concrete font stack for SVG attributes
function getBaseFont() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--font-family-base')
    .trim();
  return v || '"FKGroteskNeue","Geist","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
}


document.addEventListener("DOMContentLoaded", async () => {
  registerChartPlugins();
  await loadFullDataset();
  initializeTabs();
  initializeFilters();
  initializeEventListeners();
  updateDashboard();
  loadIndiaMap(); // Load the SVG map
});

// UPDATED: State name canonicalization with SVG spellings
function canonicalStateName(name) {
  if (!name || !name.trim()) return 'Unknown';
  const n = name.trim().toLowerCase();
  if (["jammu and kashmir", "jammu & kashmir"].includes(n)) return "Jammu and Kashmir";
  if ([
    "dadra and nagar haveli",
    "daman and diu",
    "dadra & nagar haveli",
    "dadra and nagar haveli and daman and diu",
    "dādra and nagar haveli and damān and diu"
  ].includes(n)) return "Dādra and Nagar Haveli and Damān and Diu";
  if (["odisha", "orissa"].includes(n)) return "Orissa";
  if (["uttarakhand", "uttaranchal"].includes(n)) return "Uttaranchal";
  if (n.startsWith("pan india") || n === "pan india (other centralized funds)") return "PAN India";
  if (n.includes("not mentioned") || n.startsWith("nec") || n === "nec/not mentioned") return "Unspecified geography";
  return name.trim();
}

// Compute human readable label for number of states selected
function formatStatesLabel(selectedStates) {
  const canonicalStates = new Set(selectedStates.map(canonicalStateName));
  if (canonicalStates.has("PAN India")) return "PAN India";
  if (canonicalStates.has("Unspecified geography")) return "Unspecified geography";
  let count = canonicalStates.size;
  return count === 1 ? "1 State/Union Territory" : `${count} States/Union Territories`;
}

// Compute summary of currently selected filters for chart subtitles
function getSelectedFiltersSummary() {
  const statesSelect = document.getElementById('stateFilter');
  const sectorsSelect = document.getElementById('sectorFilter');
  const psuSelect = document.getElementById('psuFilter');
  const companySearchInput = document.getElementById('companySearch');
  const parts = [];
  if (statesSelect) {
    const selected = Array.from(statesSelect.selectedOptions || [])
      .map(opt => opt.value)
      .filter(v => v !== '__ALL__');
    if (selected.length > 0) {
      const names = selected.map(canonicalStateName);
      parts.push(`States: ${names.join(', ')}`);
    }
  }
  if (sectorsSelect) {
    const selected = Array.from(sectorsSelect.selectedOptions || [])
      .map(opt => opt.value)
      .filter(v => v !== '__ALL__');
    if (selected.length > 0) {
      parts.push(`Sectors: ${selected.join(', ')}`);
    }
  }
  if (psuSelect) {
    const selected = Array.from(psuSelect.selectedOptions || [])
      .map(opt => opt.value)
      .filter(v => v !== '__ALL__');
    if (selected.length > 0) {
      parts.push(`PSU: ${selected.join(', ')}`);
    }
  }
  if (companySearchInput && companySearchInput.value.trim() !== '') {
    parts.push(`Company: ${companySearchInput.value.trim()}`);
  }
  return parts.join(' | ');
}

async function loadFullDataset() {
  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        dynamicTyping: false,
        complete: function (parsed) {
          rawData = parsed.data.filter(row => row['Company Name'] && row['Company Name'].trim() !== '');
          filteredData = [...rawData];
          resolve();
        },
        error: function (err) {
          reject(err);
        }
      });
    });
  } catch (error) {
    console.error("Error loading dataset:", error);
    throw error;
  }
}

async function loadIndiaMap() {
  try {
    const response = await fetch('/india-states.svg');
    const svgText = await response.text();
    const mapContainer = document.querySelector('#indiaMap');
    if (mapContainer) {
      mapContainer.innerHTML = svgText;
      addMapWatermark();
      computeStateCenters();
      updateMapHeader();
      const statePaths = mapContainer.querySelectorAll('path, g[id]');
      statePaths.forEach(path => {
        path.addEventListener('mouseenter', handleMapHover);
        path.addEventListener('mouseleave', handleMapLeave);
        path.addEventListener('click', handleMapClick);
      });
    }
  } catch (error) {
    console.error("Error loading India map:", error);
  }
}

function handleMapHover(event) {
  const tooltip = document.getElementById('mapTooltip');
  if (tooltip) {
    const stateName = event.target.id || event.target.getAttribute('data-state') || 'Unknown';
    const canonicalName = canonicalStateName(stateName);
    const stateData = calculateStateData().find(s => s.name === canonicalName);
    if (stateData) {
      document.getElementById('tooltipState').textContent = stateData.name;
      document.getElementById('tooltipSpending').textContent = `₹${stateData.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;
      document.getElementById('tooltipProjects').textContent = stateData.projects.toLocaleString();
      document.getElementById('tooltipCompanies').textContent = stateData.companies.toLocaleString();
      tooltip.style.display = 'block';
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY - 10 + 'px';
    }
  }
}

function handleMapLeave(event) {
  const tooltip = document.getElementById('mapTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

function handleMapClick(event) {
  const stateName = event.target.id || event.target.getAttribute('data-state');
  if (stateName) {
    const canonicalName = canonicalStateName(stateName);
    const stateFilter = document.getElementById('stateFilter');
    if (stateFilter) {
      const options = Array.from(stateFilter.options);
      const matchingOption = options.find(opt => canonicalStateName(opt.value) === canonicalName);
      if (matchingOption) {
        matchingOption.selected = !matchingOption.selected;
        applyFilters();
      }
    }
  }
}

// State highlighting
function highlightMapStates(canon) {
  const svgContainer = document.querySelector('#indiaMap');
  if (!svgContainer || !canon || canon.length === 0) return;
  const paths = svgContainer.querySelectorAll('path');
  paths.forEach(p => {
    p.style.fill = '#7FB069';
    p.classList.remove('state-selected');
  });
  if (canon.includes('Unspecified geography')) return;
  if (canon.includes('PAN India')) {
    paths.forEach(p => {
      p.style.fill = '#1f7a8c';
      p.classList.add('state-selected');
    });
    return;
  }
  canon.forEach(state => {
    const matches = svgContainer.querySelectorAll(`path[name="${state}"]`);
    matches.forEach(p => {
      p.style.fill = '#1f7a8c';
      p.classList.add('state-selected');
    });
  });
  const counter = document.getElementById('state-count');
  if (counter) {
    counter.innerText = `Selected: ${canon.length}`;
  }
}

function initializeTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(tc => tc.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add("active");
      setTimeout(() => updateCharts(), 100);
    });
  });
  if (tabs.length > 0) {
    tabs[0].click();
  }
}

function initializeFilters() {
  const stateSet = new Set();
  const sectorSet = new Set();
  const typeSet = new Set();
  rawData.forEach(row => {
    const canonicalState = canonicalStateName(row['CSR State']);
    if (canonicalState && canonicalState !== 'Unknown') stateSet.add(canonicalState);
    if (row['CSR Development Sector'] && row['CSR Development Sector'].trim()) {
      sectorSet.add(row['CSR Development Sector'].trim());
    }
    if (row['PSU/Non-PSU'] && row['PSU/Non-PSU'].trim()) {
      typeSet.add(row['PSU/Non-PSU'].trim());
    }
  });
  populateMultiSelect("stateFilter", [...stateSet].sort());
  populateMultiSelect("sectorFilter", [...sectorSet].sort());
  populateMultiSelect("psuFilter", [...typeSet].sort());
}

function populateMultiSelect(selectId, items) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  const allOption = document.createElement("option");
  allOption.value = "__ALL__";
  allOption.text = "All";
  allOption.selected = true;
  select.appendChild(allOption);
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.text = item;
    option.selected = false;
    select.appendChild(option);
  });
}

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
  initializeChartDownloads();
}

function initializeChartDownloads() {
  const downloadButtons = document.querySelectorAll('.chart-download-btn');
  downloadButtons.forEach(button => {
    button.addEventListener('click', function() {
      const chartId = this.getAttribute('data-chart');
      downloadChart(chartId);
    });
  });
}

function downloadChart(chartId) {
  let chartInstance = null;
  let fileName = 'chart.png';
  switch(chartId) {
    case 'map':
      downloadMap();
      return;

    case 'overviewStates':
      chartInstance = window.overviewStatesChartInstance;
      fileName = 'top_15_states.png';
      break;
    case 'overviewSectors':
      chartInstance = window.overviewSectorsChartInstance;
      fileName = 'top_development_sectors.png';
      break;
    case 'states':
      chartInstance = window.statesChartInstance;
      fileName = 'all_states_analysis.png';
      break;
    case 'sectors':
      chartInstance = window.sectorsChartInstance;
      fileName = 'all_sectors_analysis.png';
      break;
    case 'companies':
      chartInstance = window.companiesChartInstance;
      fileName = 'top_companies.png';
      break;
  }
  if (chartInstance) {
    const link = document.createElement('a');
    link.href = chartInstance.toBase64Image('image/png', 1.0);
    link.download = fileName;
    link.click();
  }
}

function applyFilters() {
  const stateFilter = Array.from(document.getElementById('stateFilter')?.selectedOptions || []).map(o => o.value);
  const sectorFilter = Array.from(document.getElementById('sectorFilter')?.selectedOptions || []).map(o => o.value);
  const psuFilter = Array.from(document.getElementById('psuFilter')?.selectedOptions || []).map(o => o.value);
  const companySearch = document.getElementById('companySearch')?.value.toLowerCase() || '';
  const showAllStates = stateFilter.includes("__ALL__");
  const showAllSectors = sectorFilter.includes("__ALL__");
  const showAllPSU = psuFilter.includes("__ALL__");
  filteredData = rawData.filter(row => {
    const canonicalState = canonicalStateName(row['CSR State']);
    const stateMatch = showAllStates || stateFilter.includes(canonicalState);
    const sectorMatch = showAllSectors || sectorFilter.includes(row['CSR Development Sector']);
    const psuMatch = showAllPSU || psuFilter.includes(row['PSU/Non-PSU']);
    const companyMatch = !companySearch || row['Company Name']?.toLowerCase().includes(companySearch);
    return stateMatch && sectorMatch && psuMatch && companyMatch;
  });
  currentPage = 1;
  updateDashboard();
  updateFilterResults();
  const selectedStates = showAllStates ? Array.from(new Set(rawData.map(r => canonicalStateName(r['CSR State'])))) : stateFilter.filter(s => s !== "__ALL__");
  highlightMapStates(selectedStates);
  // Update map value labels
  labelSelectedStatesWithValues(selectedStates, filteredData);
  updateMapHeader();
}

function resetFilters() {
  ['stateFilter', 'sectorFilter', 'psuFilter'].forEach(filterId => {
    const select = document.getElementById(filterId);
    if (select) {
      Array.from(select.options).forEach(option => {
        option.selected = option.value === "__ALL__";
      });
    }
  });
  const companySearch = document.getElementById('companySearch');
  if (companySearch) companySearch.value = '';
  filteredData = [...rawData];
  currentPage = 1;
  updateDashboard();
  updateFilterResults();
  highlightMapStates([]);
  // Clear map labels
  labelSelectedStatesWithValues([], []);
  updateMapHeader();
}

function updateFilterResults() {
  const filterResults = document.getElementById('filterResults');
  if (filterResults) {
    if (filteredData.length === rawData.length) {
      filterResults.textContent = `Showing all ${filteredData.length.toLocaleString()} records`;
      filterResults.className = 'filter-status';
    } else {
      filterResults.textContent = `Filtered: ${filteredData.length.toLocaleString()} of ${rawData.length.toLocaleString()} records`;
      filterResults.className = 'filter-status filtered';
    }
  }
}

function parseSpending(value) {
  if (!value || value === null || value === undefined) return 0;
  const cleanValue = value.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

function updateDashboard() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';
  const mainDashboard = document.getElementById('mainDashboard');
  if (mainDashboard) mainDashboard.style.display = 'block';
  const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
  const companies = new Set(filteredData.map(r => r['Company Name']).filter(name => name && name.trim()));
  const canonicalStates = new Set(filteredData.map(r => canonicalStateName(r['CSR State'])).filter(state => state && state !== 'Unknown'));
  const totalProjects = filteredData.length;
  const avgPerProject = totalProjects > 0 ? totalSpending / totalProjects : 0;
  const statesArray = Array.from(canonicalStates);
  const statesLabel = formatStatesLabel(statesArray);
  updateElement('totalCompaniesHeader', `${companies.size.toLocaleString('en-IN')} Companies`);
  updateElement('totalStatesHeader', statesLabel);
  updateElement('totalProjectsHeader', `${totalProjects.toLocaleString('en-IN')} Projects`);
  updateElement('totalSpendingHeader', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
  updateElement('totalSpendingMetric', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
  updateElement('totalCompaniesMetric', companies.size.toLocaleString('en-IN'));
  updateElement('totalProjectsMetric', totalProjects.toLocaleString('en-IN'));
  updateElement('avgPerProjectMetric', `₹${avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
  updateStatesTable();
  updateSectorsTable();
  updateCompaniesTable();
  updateCharts();
  updateMapHeader();
}

function updateElement(id, content) {
  const element = document.getElementById(id);
  if (element) element.textContent = content;
}

function updateStatesTable() {
  const statesData = calculateStateData();
  const tbody = document.getElementById('statesTableBody') || document.querySelector('#statesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = statesData.map(state => `
    <tr>
      <td>${state.name}</td>
      <td class="number">₹${state.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      <td class="number">${state.projects.toLocaleString('en-IN')}</td>
      <td class="number">${state.companies.toLocaleString('en-IN')}</td>
      <td class="number">₹${state.average.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      <td class="number">${state.percentage.toFixed(2)}%</td>
    </tr>
  `).join('');
  updateElement('statesCount', `${statesData.length} states/union territories`);
}

function updateSectorsTable() {
  const sectorsData = calculateSectorData();
  const tbody = document.getElementById('sectorsTableBody') || document.querySelector('#sectorsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = sectorsData.map(sector => `
    <tr>
      <td>${sector.name}</td>
      <td class="number">₹${sector.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      <td class="number">${sector.projects.toLocaleString('en-IN')}</td>
      <td class="number">${sector.companies.toLocaleString('en-IN')}</td>
      <td class="number">${sector.percentage.toFixed(2)}%</td>
    </tr>
  `).join('');
  updateElement('sectorsCount', `${sectorsData.length} sectors`);
}

function updateCompaniesTable() {
  const companiesData = calculateCompanyData();
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const pageData = companiesData.slice(startIndex, endIndex);
  const tbody = document.getElementById('companiesTableBody') || document.querySelector('#companiesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = pageData.map((company, index) => `
    <tr>
      <td class="number">${startIndex + index + 1}</td>
      <td>${company.name}</td>
      <td><span class="psu-type ${company.psuType.toLowerCase().replace(/[^a-z]/g, '')}">${company.psuType}</span></td>
      <td>${company.state}</td>
      <td>${company.sector}</td>
      <td class="number">₹${company.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
      <td class="number">${company.projects.toLocaleString('en-IN')}</td>
    </tr>
  `).join('');
  updateElement('companyCount', `${companiesData.length.toLocaleString('en-IN')} companies`);
  updatePagination(companiesData.length);
}

function calculateStateData() {
  const stateMap = new Map();
  const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
  filteredData.forEach(row => {
    const state = canonicalStateName(row['CSR State']);
    const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
    const company = row['Company Name']?.trim();
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        name: state,
        spending: 0,
        projects: 0,
        companies: new Set()
      });
    }
    const stateData = stateMap.get(state);
    stateData.spending += spending;
    stateData.projects += 1;
    if (company) stateData.companies.add(company);
  });
  return Array.from(stateMap.values()).map(state => ({
    ...state,
    companies: state.companies.size,
    average: state.projects > 0 ? state.spending / state.projects : 0,
    percentage: totalSpending > 0 ? (state.spending / totalSpending) * 100 : 0
  })).sort((a, b) => b.spending - a.spending);
}

function calculateSectorData() {
  const sectorMap = new Map();
  const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
  filteredData.forEach(row => {
    const sector = row['CSR Development Sector']?.trim() || 'Unknown';
    const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
    const company = row['Company Name']?.trim();
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        name: sector,
        spending: 0,
        projects: 0,
        companies: new Set()
      });
    }
    const sectorData = sectorMap.get(sector);
    sectorData.spending += spending;
    sectorData.projects += 1;
    if (company) sectorData.companies.add(company);
  });
  return Array.from(sectorMap.values()).map(sector => ({
    ...sector,
    companies: sector.companies.size,
    percentage: totalSpending > 0 ? (sector.spending / totalSpending) * 100 : 0
  })).sort((a, b) => b.spending - a.spending);
}

function calculateCompanyData() {
  const companyMap = new Map();
  filteredData.forEach(row => {
    const company = row['Company Name']?.trim();
    if (!company) return;
    const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
    if (!companyMap.has(company)) {
      companyMap.set(company, {
        name: company,
        spending: 0,
        projects: 0,
        psuType: row['PSU/Non-PSU']?.trim() || 'Unknown',
        state: canonicalStateName(row['CSR State']),
        sector: row['CSR Development Sector']?.trim() || 'Unknown'
      });
    }
    const companyData = companyMap.get(company);
    companyData.spending += spending;
    companyData.projects += 1;
  });
  return Array.from(companyMap.values()).sort((a, b) => b.spending - a.spending);
}

function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
  const companiesData = calculateCompanyData();
  const totalPages = Math.ceil(companiesData.length / rowsPerPage);
  currentPage += direction;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  updateCompaniesTable();
}

function updateCharts() {
  if (typeof Chart === 'undefined') return;
  const statesData = calculateStateData();
  const sectorsData = calculateSectorData();
  const companiesData = calculateCompanyData();
  updateBarChart('overviewStatesChart', 'overviewStatesChartInstance', statesData.slice(0, 15), 'CSR Spending Rankings: Top 15 States/UTs (Curated List)', '#1f7a8c');
  updateBarChart('overviewSectorsChart', 'overviewSectorsChartInstance', sectorsData.slice(0, 10), 'CSR Spending Rankings: Top 10 Development Sectors (Curated List)', '#ff6b35');
  updateBarChart('statesChart', 'statesChartInstance', statesData, 'CSR Spending in States/UTs (Curated List)', '#1f7a8c');
  updateBarChart('sectorsChart', 'sectorsChartInstance', sectorsData, 'CSR Spending in Development Sectors (Curated List)', '#ff6b35');
  updateBarChart('companiesChart', 'companiesChartInstance', companiesData.slice(0, 20), 'CSR Spending Rankings: Top 20 Companies (Curated List)', '#084c61');
}

// Enhanced bar chart update: includes watermark, subtitles and datalabels
function updateBarChart(canvasId, instanceVar, data, title, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (window[instanceVar]) {
    window[instanceVar].destroy();
  }
  const ctx = canvas.getContext('2d');
  const labels = data.map(item => item.name);
  const values = data.map(item => item.spending);
  const filterSummary = getSelectedFiltersSummary();
  window[instanceVar] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'CSR Spending (₹ Cr)',
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title
        },
        subtitle: {
          display: true,
          text: 'India CSR Spending Dashboard | FY 2023-24' + (filterSummary ? ' | ' + filterSummary : '')
        },
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: '#000',
          formatter: function(value) {
            return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' Cr';
          },
          font: { weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '₹\nCr'
          },
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString('en-IN');
            }
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    }
  });
}

// CSV export helpers
function exportFilteredData() { exportToCSV(filteredData, 'filtered_csr_data.csv'); }
function exportStatesData() {
  const statesData = calculateStateData();
  const csvData = statesData.map(state => ({
    'State/Region': state.name,
    'Total Spending (₹ Cr)': state.spending,
    'Number of Projects': state.projects,
    'Number of Companies': state.companies,
    'Avg per Project (₹ Cr)': state.average,
    '% of Total': state.percentage
  }));
  exportToCSV(csvData, 'states_analysis.csv');
}
function exportSectorsData() {
  const sectorsData = calculateSectorData();
  const csvData = sectorsData.map(sector => ({
    'Development Sector': sector.name,
    'Total Spending (₹ Cr)': sector.spending,
    'Number of Projects': sector.projects,
    'Companies Involved': sector.companies,
    '% of Total': sector.percentage
  }));
  exportToCSV(csvData, 'sectors_analysis.csv');
}
function exportCompaniesData() {
  const companiesData = calculateCompanyData();
  const csvData = companiesData.map((company, index) => ({
    'Rank': index + 1,
    'Company Name': company.name,
    'PSU Type': company.psuType,
    'State': company.state,
    'Sector': company.sector,
    'Total Spending (₹ Cr)': company.spending,
    'Projects': company.projects
  }));
  exportToCSV(csvData, 'companies_analysis.csv');
}
function exportToCSV(data, filename) {
  if (!data.length) return;
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Map coordinate positions for value labels
const stateCoordinates = {
  "Andhra Pradesh": [580, 620],
  "Arunachal Pradesh": [950, 260],
  "Assam": [860, 320],
  "Bihar": [700, 310],
  "Chhattisgarh": [640, 440],
  "Goa": [470, 630],
  "Gujarat": [360, 500],
  "Haryana": [560, 280],
  "Himachal Pradesh": [520, 240],
  "Jharkhand": [720, 370],
  "Karnataka": [490, 720],
  "Kerala": [520, 830],
  "Madhya Pradesh": [540, 450],
  "Maharashtra": [460, 580],
  "Manipur": [920, 330],
  "Meghalaya": [880, 340],
  "Mizoram": [920, 400],
  "Nagaland": [950, 300],
  "Odisha": [640, 480],
  "Punjab": [500, 270],
  "Rajasthan": [420, 340],
  "Sikkim": [800, 250],
  "Tamil Nadu": [590, 790],
  "Telangana": [560, 520],
  "Tripura": [900, 370],
  "Uttar Pradesh": [600, 300],
  "Uttarakhand": [570, 250],
  "West Bengal": [760, 410],
  "Andaman and Nicobar Islands": [700, 950],
  "Chandigarh": [530, 270],
  "Dādra and Nagar Haveli and Damān and Diu": [400, 600],
  "Delhi": [570, 260],
  "Jammu and Kashmir": [510, 180],
  "Ladakh": [550, 130],
  "Lakshadweep": [350, 920],
  "Puducherry": [600, 850]
};

// Display spending value labels on selected states
function labelSelectedStatesWithValues(selectedStates, filteredData) {
  const svgRoot = document.querySelector('#indiaMap svg');
  if (!svgRoot) return;
  svgRoot.querySelectorAll('.map-label').forEach(e => e.remove());

  const totals = {};
  filteredData.forEach(row => {
    const s = canonicalStateName(row["CSR State"]);
    const k = normKey(s);
    const v = parseFloat(row["Project Amount Spent (In INR Cr.)"] || 0) || 0;
    totals[k] = (totals[k] || 0) + v;
  });

  const baseFont = getBaseFont();
  selectedStates.forEach(state => {
    const k = normKey(state);
    const center = stateCenters[state] || stateCenters[k];
    const val = totals[k];
    if (!center || val == null) return;

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "map-label");
    text.setAttribute("x", center.x);
    text.setAttribute("y", center.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("style", "paint-order: stroke fill; stroke: rgba(0,0,0,.45); stroke-width: .8px;");

    const nameT = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    nameT.setAttribute("x", center.x);
    nameT.setAttribute("dy", "0");
    nameT.setAttribute("font-weight", "600");
    nameT.textContent = state;

    const valueT = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    valueT.setAttribute("font-family", baseFont);
    valueT.setAttribute("font-size", "11px");
    valueT.setAttribute("font-weight", "600");
    valueT.setAttribute("fill", "#fff");
    valueT.setAttribute("x", center.x);
    valueT.setAttribute("dy", "1.2em");
    valueT.textContent = `₹${val.toFixed(2)} Cr`;

    text.appendChild(nameT);
    text.appendChild(valueT);
    svgRoot.appendChild(text);
  });
}

console.log("Enhanced dashboard script loaded successfully");


// ===== Map label center computation & offsets =====
const normKey = s => (s || '').toLowerCase().replace(/[^a-z]/g,'');
let stateCenters = {};
const STATE_LABEL_OFFSETS = {
  "Goa": {dx: 8, dy: 6},
  "Sikkim": {dx: 10, dy: -6},
  "Tripura": {dx: 8, dy: 6},
  "Manipur": {dx: 8, dy: 6},
  "Meghalaya": {dx: 12, dy: -8},
  "Nagaland": {dx: 12, dy: -6},
  "Mizoram": {dx: 10, dy: 6},
  "Puducherry": {dx: 10, dy: 10},
  "Dadra and Nagar Haveli and Daman and Diu": {dx: 20, dy: 10},
  "Andaman and Nicobar": {dx: 12, dy: 10},
  "Lakshadweep": {dx: 12, dy: 10}
};

function computeStateCenters() {
  stateCenters = {};
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return;

  // Prefer explicit label points embedded in the SVG
  const lp = svg.querySelector('#label_points');
  if (lp) {
    const circles = lp.querySelectorAll('circle[id][cx][cy]');
    circles.forEach(c => {
      const id = c.getAttribute('id');
      const cx = parseFloat(c.getAttribute('cx'));
      const cy = parseFloat(c.getAttribute('cy'));
      if (!isNaN(cx) && !isNaN(cy) && id) {
        stateCenters[id] = { x: cx, y: cy };
        stateCenters[normKey(id)] = { x: cx, y: cy };
      }
    });
  }

  // Fallback: compute from geometry with optional offsets
  const nodes = svg.querySelectorAll('path[id], g[id]');
  nodes.forEach(el => {
    const id = el.getAttribute('id');
    if (!id) return;
    const bb = el.getBBox();
    let cx = bb.x + bb.width / 2;
    let cy = bb.y + bb.height / 2;
    const off = STATE_LABEL_OFFSETS[id];
    if (off) { cx += (off.dx || 0); cy += (off.dy || 0); }
    // do not override label_points if already set
    if (!stateCenters[id]) {
      stateCenters[id] = { x: cx, y: cy };
      stateCenters[normKey(id)] = { x: cx, y: cy };
    }
  });
}    stateCenters[id] = { x: cx, y: cy };
    stateCenters[normKey(id)] = { x: cx, y: cy };
  });
}
function updateMapHeader(){
  const subtitleEl = document.getElementById('mapSubtitle');
  const filtersEl = document.getElementById('mapFilters');
  if (subtitleEl){
    subtitleEl.textContent = 'India CSR Spending Dashboard | FY 2023-24';
  }
  if (filtersEl){
    const summary = getSelectedFiltersSummary();
    if (summary) {
      filtersEl.textContent = summary;
      filtersEl.style.display = 'block';
    } else {
      filtersEl.textContent = '';
      filtersEl.style.display = 'none';
    }
  }
}


function addMapWatermark(){
  const svg = document.querySelector('#indiaMap svg');
  if (!svg) return;
  const existing = svg.querySelector('.map-watermark');
  if (existing) existing.remove();
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '835');
  text.setAttribute('y', '940');
  text.setAttribute('text-anchor', 'end');
  text.setAttribute('class', 'map-watermark');
  text.setAttribute('fill', '#000');
  text.setAttribute('opacity', '0.1');
  text.setAttribute('font-size', '12');
  text.textContent = 'Prepared by Ashok Thanikonda';
  svg.appendChild(text);
}


function downloadMap(){
  const svgElement = document.querySelector('#indiaMap svg');
  if (!svgElement) return;
  const cloned = svgElement.cloneNode(true);

  let width = 1000, height = 1000;
  if (cloned.viewBox && cloned.viewBox.baseVal) {
    width = cloned.viewBox.baseVal.width;
    height = cloned.viewBox.baseVal.height;
  } else {
    width = parseFloat(cloned.getAttribute('width')) || width;
    height = parseFloat(cloned.getAttribute('height')) || height;
  }

  const titleText = document.getElementById('mapTitle')?.textContent || 'CSR Spending Map';
  const subText = document.getElementById('mapSubtitle')?.textContent || '';
  const filtText = document.getElementById('mapFilters')?.textContent || '';

  const title = document.createElementNS('http://www.w3.org/2000/svg','text');
  title.setAttribute('x', width/2);
  title.setAttribute('y', 34);
  title.setAttribute('text-anchor','middle');
  title.setAttribute('font-size','20');
  title.setAttribute('font-weight','bold');
  title.setAttribute('fill','#0f172a');
  title.textContent = titleText;
  cloned.insertBefore(title, cloned.firstChild);

  if (subText) {
    const sub = document.createElementNS('http://www.w3.org/2000/svg','text');
    sub.setAttribute('x', width/2);
    sub.setAttribute('y', 54);
    sub.setAttribute('text-anchor','middle');
    sub.setAttribute('font-size','12');
    sub.setAttribute('fill','#334155');
    sub.textContent = subText;
    cloned.insertBefore(sub, cloned.firstChild);
  }

  if (filtText) {
    const filt = document.createElementNS('http://www.w3.org/2000/svg','text');
    filt.setAttribute('x', width/2);
    filt.setAttribute('y', 70);
    filt.setAttribute('text-anchor','middle');
    filt.setAttribute('font-size','11');
    filt.setAttribute('fill','#475569');
    filt.textContent = filtText;
    cloned.insertBefore(filt, cloned.firstChild);
  }

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(cloned);
  if (!/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svgString)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/^<svg[^>]*xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/.test(svgString)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.onload = function() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(img, 0, 0, width, height);
    const png = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = png;
    a.download = 'csr_spending_map.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  img.src = svgUrl;
}
