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

document.addEventListener("DOMContentLoaded", async () => {
  registerChartPlugins();
  await loadFullDataset();
  initializeTabs();
  initializeFilters();
  initializeEventListeners();
  updateDashboard();
  loadIndiaMap();
  updateMap(); // Initialize map labels and filter summary
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

// Update map with labels and filter summary
function updateMap() {
  const statesSelect = document.getElementById('stateFilter');
  const selectedStates = Array.from(statesSelect.selectedOptions || [])
    .map(opt => opt.value)
    .filter(v => v !== '__ALL__')
    .map(canonicalStateName);
  labelSelectedStatesWithValues(selectedStates, filteredData);
  highlightMapStates(selectedStates);
  const filterSummary = document.getElementById('mapFilterSummary');
  if (filterSummary) {
    const summary = getSelectedFiltersSummary();
    filterSummary.textContent = summary || 'No filters applied';
    filterSummary.classList.toggle('filtered', !!summary);
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
      setTimeout(() => {
        updateCharts();
        if (tab.dataset.tab === 'indiaMapTab') updateMap();
      }, 100);
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

  const stateFilter = document.getElementById('stateFilter');
  const sectorFilter = document.getElementById('sectorFilter');
  const psuFilter = document.getElementById('psuFilter');

  stateFilter.innerHTML = '<option value="__ALL__">All States</option>';
  Array.from(stateSet).sort().forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateFilter.appendChild(option);
  });

  sectorFilter.innerHTML = '<option value="__ALL__">All Sectors</option>';
  Array.from(sectorSet).sort().forEach(sector => {
    const option = document.createElement('option');
    option.value = sector;
    option.textContent = sector;
    sectorFilter.appendChild(option);
  });

  typeSet.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    psuFilter.appendChild(option);
  });

  stateFilter.addEventListener('change', applyFilters);
  sectorFilter.addEventListener('change', applyFilters);
  psuFilter.addEventListener('change', applyFilters);
  document.getElementById('companySearch').addEventListener('input', applyFilters);
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
  document.getElementById('exportFiltered').addEventListener('click', exportFilteredData);
  document.getElementById('exportStates').addEventListener('click', exportStatesData);
  document.getElementById('exportSectors').addEventListener('click', exportSectorsData);
  document.getElementById('exportCompanies').addEventListener('click', exportCompaniesData);
  document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage').addEventListener('click', () => changePage(1));
  document.getElementById('exportMap').addEventListener('click', exportMapToPNG);
}

function applyFilters() {
  const stateFilter = document.getElementById('stateFilter');
  const sectorFilter = document.getElementById('sectorFilter');
  const psuFilter = document.getElementById('psuFilter');
  const companySearch = document.getElementById('companySearch').value.trim().toLowerCase();

  const selectedStates = Array.from(stateFilter.selectedOptions)
    .map(opt => opt.value)
    .filter(v => v !== '__ALL__');
  const selectedSectors = Array.from(sectorFilter.selectedOptions)
    .map(opt => opt.value)
    .filter(v => v !== '__ALL__');
  const selectedPSUs = Array.from(psuFilter.selectedOptions)
    .map(opt => opt.value)
    .filter(v => v !== '__ALL__');

  filteredData = rawData.filter(row => {
    const state = canonicalStateName(row['CSR State']);
    const sector = row['CSR Development Sector']?.trim();
    const psu = row['PSU/Non-PSU']?.trim();
    const company = row['Company Name']?.trim().toLowerCase();

    const statePass = selectedStates.length === 0 || selectedStates.includes(state);
    const sectorPass = selectedSectors.length === 0 || selectedSectors.includes(sector);
    const psuPass = selectedPSUs.length === 0 || selectedPSUs.includes(psu);
    const companyPass = companySearch === '' || company.includes(companySearch);

    return statePass && sectorPass && psuPass && companyPass;
  });

  currentPage = 1;
  updateDashboard();
  updateMap();
}

function resetFilters() {
  const stateFilter = document.getElementById('stateFilter');
  const sectorFilter = document.getElementById('sectorFilter');
  const psuFilter = document.getElementById('psuFilter');
  const companySearch = document.getElementById('companySearch');

  stateFilter.querySelectorAll('option').forEach(opt => opt.selected = opt.value === '__ALL__');
  sectorFilter.querySelectorAll('option').forEach(opt => opt.selected = opt.value === '__ALL__');
  psuFilter.querySelectorAll('option').forEach(opt => opt.selected = true);
  companySearch.value = '';

  filteredData = [...rawData];
  currentPage = 1;
  updateDashboard();
  updateMap();
}

function updateDashboard() {
  updateStats();
  updateCharts();
  updateCompaniesTable();
}

function updateStats() {
  const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
  const totalProjects = filteredData.length;
  const totalCompanies = new Set(filteredData.map(row => row['Company Name']?.trim())).size;
  const avgPerProject = totalProjects > 0 ? totalSpending / totalProjects : 0;

  document.getElementById('totalSpending').textContent = `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;
  document.getElementById('totalCompanies').textContent = totalCompanies.toLocaleString();
  document.getElementById('totalProjects').textContent = totalProjects.toLocaleString();
  document.getElementById('avgPerProject').textContent = `₹${avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;

  document.getElementById('loadingOverlay').classList.add('hidden');
}

function parseSpending(value) {
  if (!value || value.trim() === '') return 0;
  const cleanedValue = value.replace(/[^0-9.]/g, '');
  return parseFloat(cleanedValue) || 0;
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

function exportMapToPNG() {
  const mapContainer = document.getElementById('indiaMap');
  const svgElement = mapContainer.querySelector('svg');
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);
  svgString = svgString.replace(/<svg/, `<svg xmlns="http://www.w3.org/2000/svg"`);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  canvas.width = mapContainer.offsetWidth;
  canvas.height = mapContainer.offsetHeight;

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = function () {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob(function (blob) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'india_csr_map.png';
      link.click();
      URL.revokeObjectURL(link.href);
    });
  };

  img.src = url;
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
  const svg = document.getElementById("indiaMap");
  if (!svg) return;
  // Remove old labels
  svg.querySelectorAll('.map-label').forEach(e => e.remove());
  const stateTotals = {};
  filteredData.forEach(row => {
    const state = canonicalStateName(row["CSR State"]);
    const amt = parseFloat(row["Project Amount Spent (In INR Cr.)"] || 0);
    stateTotals[state] = (stateTotals[state] || 0) + amt;
  });
  selectedStates.forEach(state => {
    const coords = stateCoordinates[state];
    const val = stateTotals[state]?.toFixed(2);
    if (coords && val) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", coords[0]);
      text.setAttribute("y", coords[1] - 10);
      text.setAttribute("class", "map-label");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "14");
      text.setAttribute("fill", "#333");
      text.setAttribute("stroke", "white");
      text.setAttribute("stroke-width", "0.5");
      text.textContent = state;
      svg.appendChild(text);
      const valueText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      valueText.setAttribute("x", coords[0]);
      valueText.setAttribute("y", coords[1] + 10);
      valueText.setAttribute("class", "map-label");
      valueText.setAttribute("text-anchor", "middle");
      valueText.setAttribute("font-size", "14");
      valueText.setAttribute("fill", "#333");
      valueText.setAttribute("stroke", "white");
      valueText.setAttribute("stroke-width", "0.5");
      valueText.textContent = `₹${val} Cr`;
      svg.appendChild(valueText);
    }
  });
}

function initializeEventListeners() {
  const downloadButtons = document.querySelectorAll('.chart-download-btn');
  downloadButtons.forEach(button => {
    button.addEventListener('click', () => {
      const chartId = button.getAttribute('data-chart');
      if (chartId) {
        const chart = window[`${chartId}Instance`];
        if (chart) {
          const url = chart.toBase64Image();
          const link = document.createElement('a');
          link.href = url;
          link.download = `${chartId}.png`;
          link.click();
        }
      }
    });
  });
}

console.log("Enhanced dashboard script loaded successfully");
