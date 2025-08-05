// app.js (Complete Revised CSR Dashboard with PROPER SVG State Name Fixes and Watermarks)
// Last updated: Tue Aug 05, 2025

console.log("Initializing dashboard...");

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

document.addEventListener("DOMContentLoaded", async () => {
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
  
  // Handle Jammu and Kashmir variations
  if (["jammu and kashmir", "jammu & kashmir"].includes(n)) {
    return "Jammu and Kashmir";
  }
  
  // Handle Dadra/Daman merger (SVG uses different spelling)
  if ([
    "dadra and nagar haveli", "daman and diu", "dadra & nagar haveli",
    "dadra and nagar haveli and daman and diu", 
    "dādra and nagar haveli and damān and diu"
  ].includes(n)) {
    return "Dādra and Nagar Haveli and Damān and Diu";
  }
  
  // Handle Odisha/Orissa (SVG uses Orissa)
  if (["odisha", "orissa"].includes(n)) {
    return "Orissa";
  }
  
  // Handle Uttarakhand/Uttaranchal (SVG uses Uttaranchal)
  if (["uttarakhand", "uttaranchal"].includes(n)) {
    return "Uttaranchal";
  }
  
  // Handle PAN India variations
  if (n.startsWith("pan india") || n === "pan india (other centralized funds)") {
    return "PAN India";
  }
  
  // Handle unspecified geography
  if (n.includes("not mentioned") || n.startsWith("nec") || n === "nec/not mentioned") {
    return "Unspecified geography";
  }
  
  return name.trim();
}

// State label formatting for summary panel
function formatStatesLabel(selectedStates) {
  const canonicalStates = new Set(selectedStates.map(canonicalStateName));
  
  if (canonicalStates.has("PAN India")) {
    return "PAN India";
  }
  
  if (canonicalStates.has("Unspecified geography")) {
    return "Unspecified geography";
  }
  
  // Count Dadra and Nagar Haveli and Daman and Diu as 1
  let count = canonicalStates.size;
  
  return count === 1 ? "1 State/Union Territory" : `${count} States/Union Territories`;
}

async function loadFullDataset() {
  console.log("DEBUG: loadFullDataset started");

  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();

    console.log("DEBUG: CSV text length:", csvText.length);

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        worker: true,
        dynamicTyping: false,
        complete: function (parsed) {
          console.log("DEBUG: PapaParse complete");
          console.log("DEBUG: Rows parsed:", parsed.data.length);
          console.log("DEBUG: Errors encountered:", parsed.errors.length);
          console.log("DEBUG: First row sample:", parsed.data[0]);
          
          rawData = parsed.data.filter(row => row['Company Name'] && row['Company Name'].trim() !== '');
          filteredData = [...rawData];
          
          console.log("Dataset loaded:", filteredData.length, "records");
          console.log("Sample spending values:", rawData.slice(0, 5).map(r => r["Project Amount Spent (In INR Cr.)"]));
          resolve();
        },
        error: function (err) {
          console.error("PapaParse error:", err);
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
      
      // Add event listeners to state paths for interactivity
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
    
    // Toggle state selection in filter
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

// COMPLETELY REWRITTEN: Proper state highlighting function
function highlightMapStates(selectedStates) {
  // Purpose: reset and then highlight paths in the India map SVG based on the
  // currently selected state names. The original implementation attempted to
  // approximate highlighting by selecting an arbitrary subset of all paths
  // because it could not associate filter names with the SVG paths. This led
  // to confusing behaviour where unrelated parts of the map were highlighted.
  //
  // The updated implementation performs the following steps:
  //  1. Reset styling on all paths in the SVG to their default fill and stroke.
  //  2. Convert incoming state names to canonical form via canonicalStateName().
  //  3. Handle special cases: "PAN India" (highlight all) and "Unspecified geography"
  //     (clear highlighting).
  //  4. For each canonical state in the selection, search the SVG for any
  //     <path> elements whose 'name' attribute matches the canonical state
  //     exactly. Highlight these paths.
  //  5. Update or hide a small on-map indicator showing how many states are
  //     highlighted.
  const mapContainer = document.querySelector('#indiaMap');
  if (!mapContainer) {
    console.warn('Map container not found');
    return;
  }

  const allPaths = mapContainer.querySelectorAll('path');
  // Reset styling on all paths
  allPaths.forEach(path => {
    path.style.fill = '#7FB069';
    path.style.stroke = '#fff';
    path.style.strokeWidth = '1';
    path.classList.remove('state-selected');
  });

  // If nothing is selected, hide indicator and return
  if (!selectedStates || selectedStates.length === 0) {
    const indicator = document.getElementById('mapIndicator');
    if (indicator) indicator.style.display = 'none';
    return;
  }

  // Compute canonical names
  const canonicalStates = selectedStates.map(canonicalStateName);

  // Special case: highlight entire map for PAN India
  if (canonicalStates.includes('PAN India')) {
    allPaths.forEach(path => {
      path.style.fill = '#1f7a8c';
      path.style.stroke = '#0d5561';
      path.style.strokeWidth = '2';
      path.classList.add('state-selected');
    });
    let indicator = document.getElementById('mapIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'mapIndicator';
      indicator.style.cssText =
        'position: absolute; top: 10px; left: 10px; background: rgba(31, 122, 140, 0.9); ' +
        'color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; ' +
        'z-index: 1000; pointer-events: none;';
      mapContainer.style.position = 'relative';
      mapContainer.appendChild(indicator);
    }
    indicator.textContent = 'PAN India selected';
    indicator.style.display = 'block';
    return;
  }

  // Special case: if Unspecified geography is selected, do nothing
  if (canonicalStates.includes('Unspecified geography')) {
    const indicator = document.getElementById('mapIndicator');
    if (indicator) indicator.style.display = 'none';
    return;
  }

  // Determine which paths to highlight by matching 'name' attributes
  let highlightedCount = 0;
  canonicalStates.forEach(stateName => {
    const matchingPaths = mapContainer.querySelectorAll(`path[name="${stateName.replace(/"/g, '\\"')}"]`);
    matchingPaths.forEach(path => {
      path.style.fill = '#1f7a8c';
      path.style.stroke = '#0d5561';
      path.style.strokeWidth = '2';
      path.classList.add('state-selected');
      highlightedCount += 1;
    });
  });

  // Update indicator: number of states highlighted
  let indicator = document.getElementById('mapIndicator');
  if (highlightedCount > 0) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'mapIndicator';
      indicator.style.cssText =
        'position: absolute; top: 10px; left: 10px; background: rgba(31, 122, 140, 0.9); ' +
        'color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; ' +
        'z-index: 1000; pointer-events: none;';
      mapContainer.style.position = 'relative';
      mapContainer.appendChild(indicator);
    }
    const uniqueStates = [...new Set(canonicalStates)];
    indicator.textContent = `${uniqueStates.length} ${uniqueStates.length === 1 ? 'state' : 'states'} selected`;
    indicator.style.display = 'block';
  } else {
    if (indicator) indicator.style.display = 'none';
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
      
      // Update charts when switching tabs
      setTimeout(() => updateCharts(), 100);
    });
  });

  // Initialize first tab as active
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
  
  // Add "All" option
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
  // Filter change listeners
  document.getElementById('stateFilter')?.addEventListener('change', applyFilters);
  document.getElementById('sectorFilter')?.addEventListener('change', applyFilters);
  document.getElementById('psuFilter')?.addEventListener('change', applyFilters);
  document.getElementById('companySearch')?.addEventListener('input', applyFilters);
  
  // Reset filters
  document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
  
  // Pagination
  document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
  
  // Export buttons
  document.getElementById('exportFilteredData')?.addEventListener('click', exportFilteredData);
  document.getElementById('exportStatesData')?.addEventListener('click', exportStatesData);
  document.getElementById('exportSectorsData')?.addEventListener('click', exportSectorsData);
  document.getElementById('exportCompaniesData')?.addEventListener('click', exportCompaniesData);
  
  // Chart download buttons
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
  } else {
    console.warn(`Chart instance not found for ${chartId}`);
  }
}

function applyFilters() {
  const stateFilter = Array.from(document.getElementById('stateFilter')?.selectedOptions || []).map(o => o.value);
  const sectorFilter = Array.from(document.getElementById('sectorFilter')?.selectedOptions || []).map(o => o.value);
  const psuFilter = Array.from(document.getElementById('psuFilter')?.selectedOptions || []).map(o => o.value);
  const companySearch = document.getElementById('companySearch')?.value.toLowerCase() || '';

  // Check if "All" is selected for each filter
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
  
  // Update map highlighting with detailed logging
  console.log("=== APPLYING FILTERS ===");
  console.log("showAllStates:", showAllStates);
  console.log("stateFilter:", stateFilter);
  
  const selectedStates = showAllStates ? 
    Array.from(new Set(rawData.map(r => canonicalStateName(r['CSR State'])))) : 
    stateFilter.filter(s => s !== "__ALL__");
    
  console.log("selectedStates for highlighting:", selectedStates);
  highlightMapStates(selectedStates);
}

function resetFilters() {
  // Reset all filters to "All" selected only
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
  
  // Convert to string and remove all non-numeric characters except decimal point
  const cleanValue = value.toString().replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanValue);
  
  return isNaN(parsed) ? 0 : parsed;
}

function updateDashboard() {
  // Hide loading overlay and show dashboard
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';
  
  const mainDashboard = document.getElementById('mainDashboard');
  if (mainDashboard) mainDashboard.style.display = 'block';

  // Calculate metrics with canonical state names
  const totalSpending = filteredData.reduce((sum, row) => {
    return sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]);
  }, 0);

  const companies = new Set(filteredData.map(r => r['Company Name']).filter(name => name && name.trim()));
  const canonicalStates = new Set(filteredData.map(r => canonicalStateName(r['CSR State'])).filter(state => state && state !== 'Unknown'));
  const totalProjects = filteredData.length;
  const avgPerProject = totalProjects > 0 ? totalSpending / totalProjects : 0;

  console.log("DEBUG: Calculated metrics:", {
    totalSpending,
    totalCompanies: companies.size,
    totalStates: canonicalStates.size,
    totalProjects,
    avgPerProject
  });

  // Create states label with special handling
  const statesArray = Array.from(canonicalStates);
  const statesLabel = formatStatesLabel(statesArray);

  // Update header stats with proper number formatting
  updateElement('totalCompaniesHeader', `${companies.size.toLocaleString('en-IN')} Companies`);
  updateElement('totalStatesHeader', statesLabel);
  updateElement('totalProjectsHeader', `${totalProjects.toLocaleString('en-IN')} Projects`);
  updateElement('totalSpendingHeader', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);

  // Update metric cards
  updateElement('totalSpendingMetric', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
  updateElement('totalCompaniesMetric', companies.size.toLocaleString('en-IN'));
  updateElement('totalProjectsMetric', totalProjects.toLocaleString('en-IN'));
  updateElement('avgPerProjectMetric', `₹${avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);

  // Update tables
  updateStatesTable();
  updateSectorsTable();
  updateCompaniesTable();
  
  // Update charts
  updateCharts();

  console.log("Dashboard updated with filtered data:", filteredData.length, "records");
}

function updateElement(id, content) {
  const element = document.getElementById(id);
  if (element) element.textContent = content;
}

function updateStatesTable() {
  const statesData = calculateStateData();
  const tbody = document.getElementById('statesTableBody') || document.querySelector('#statesTable tbody');
  
  if (!tbody) return;

  tbody.innerHTML = statesData.map((state, index) => `
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
  const totalSpending = filteredData.reduce((sum, row) => {
    return sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]);
  }, 0);

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

  return Array.from(stateMap.values())
    .map(state => ({
      ...state,
      companies: state.companies.size,
      average: state.projects > 0 ? state.spending / state.projects : 0,
      percentage: totalSpending > 0 ? (state.spending / totalSpending) * 100 : 0
    }))
    .sort((a, b) => b.spending - a.spending);
}

function calculateSectorData() {
  const sectorMap = new Map();
  const totalSpending = filteredData.reduce((sum, row) => {
    return sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]);
  }, 0);

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

  return Array.from(sectorMap.values())
    .map(sector => ({
      ...sector,
      companies: sector.companies.size,
      percentage: totalSpending > 0 ? (sector.spending / totalSpending) * 100 : 0
    }))
    .sort((a, b) => b.spending - a.spending);
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

  return Array.from(companyMap.values())
    .sort((a, b) => b.spending - a.spending);
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
  if (typeof Chart === 'undefined') {
    console.log("Chart.js not loaded, skipping chart updates");
    return;
  }

  const statesData = calculateStateData();
  const sectorsData = calculateSectorData();
  const companiesData = calculateCompanyData();

  // Update Overview States Chart
  updateBarChart('overviewStatesChart', 'overviewStatesChartInstance', 
    statesData.slice(0, 15), 'Top 15 States by CSR Spending', '#1f7a8c');

  // Update Overview Sectors Chart  
  updateBarChart('overviewSectorsChart', 'overviewSectorsChartInstance',
    sectorsData.slice(0, 10), 'Top Development Sectors', '#ff6b35');

  // Update States Chart (full data)
  updateBarChart('statesChart', 'statesChartInstance',
    statesData, 'All States by CSR Spending', '#1f7a8c');

  // Update Sectors Chart (full data)
  updateBarChart('sectorsChart', 'sectorsChartInstance',
    sectorsData, 'All Development Sectors', '#ff6b35');

  // Update Companies Chart
  updateBarChart('companiesChart', 'companiesChartInstance',
    companiesData.slice(0, 20), 'Top 20 Companies by CSR Spending', '#084c61');
}

// UPDATED: Added watermark to all charts
function updateBarChart(canvasId, instanceVar, data, title, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing chart instance
  if (window[instanceVar]) {
    window[instanceVar].destroy();
  }

  const ctx = canvas.getContext('2d');
  const labels = data.map(item => item.name);
  const values = data.map(item => item.spending);

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
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
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
      },
      // Add watermark plugin
      onAnimationComplete: function() {
        addWatermarkToChart(ctx, canvas);
      }
    }
  });
  
  // Add watermark immediately after chart creation
  setTimeout(() => {
    addWatermarkToChart(ctx, canvas);
  }, 100);
}

// NEW: Function to add transparent watermark to charts
function addWatermarkToChart(ctx, canvas) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Prepared by Ashok Thanikonda', canvas.width - 10, canvas.height - 10);
  ctx.restore();
}

// Export functions
function exportFilteredData() {
  exportToCSV(filteredData, 'filtered_csr_data.csv');
}

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

console.log("Dashboard script loaded successfully");
