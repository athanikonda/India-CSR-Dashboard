// app.revised.js - Complete CSR Dashboard script with enhanced chart features and map labels
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
        ctx.fillText('Prepared by Ashok Thanikonda', width - 10, height - 2);
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
    loadIndiaMap(); // Load the SVG map
});

// UPDATED: State name canonicalization with SVG spellings
function canonicalStateName(name) {
    if (!name || !name.trim()) return 'Unknown';
    const n = name.trim().toLowerCase();
    
    if (["jammu and kashmir", "jammu & kashmir"].includes(n)) return "Jammu and Kashmir";
    if ([
        "dadra and nagar haveli", "daman and diu", "dadra & nagar haveli",
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
                    rawData = parsed.data.filter(row => 
                        row['Company Name'] && row['Company Name'].trim() !== ''
                    );
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

// NEW: Load India SVG map and set up interactions
async function loadIndiaMap() {
    try {
        const response = await fetch('/india-states.svg');
        const svgText = await response.text();
        const mapContainer = document.querySelector('#indiaMap');
        
        if (mapContainer) {
            mapContainer.innerHTML = svgText;
            
            // Add event listeners to state paths
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

// NEW: Handle map hover events
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

// NEW: Handle map leave events
function handleMapLeave(event) {
    const tooltip = document.getElementById('mapTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// NEW: Handle map click events
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

// NEW: State highlighting function
function highlightMapStates(canonicalStates) {
    const svgContainer = document.querySelector('#indiaMap');
    if (!svgContainer || !canonicalStates || canonicalStates.length === 0) return;
    
    const paths = svgContainer.querySelectorAll('path');
    
    // Reset all states to default color
    paths.forEach(p => {
        p.style.fill = '#7FB069';
        p.classList.remove('state-selected');
    });
    
    // Special cases
    if (canonicalStates.includes('Unspecified geography')) return;
    
    if (canonicalStates.includes('PAN India')) {
        paths.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
        });
        return;
    }
    
    // Highlight selected states
    canonicalStates.forEach(state => {
        const matches = svgContainer.querySelectorAll(`path[name="${state}"]`);
        matches.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
        });
    });
    
    // Update counter if exists
    const counter = document.getElementById('state-count');
    if (counter) {
        counter.innerText = `Selected: ${canonicalStates.length}`;
    }
}

// NEW: Add value labels to selected states on map
function labelSelectedStatesWithValues(selectedStates, data) {
    const svgContainer = document.querySelector('#indiaMap');
    if (!svgContainer) return;
    
    // Remove existing labels
    const existingLabels = svgContainer.querySelectorAll('.state-value-label');
    existingLabels.forEach(label => label.remove());
    
    if (!selectedStates || selectedStates.length === 0 || !data || data.length === 0) return;
    
    // Calculate state data for selected states
    const stateData = calculateStateDataForStates(selectedStates, data);
    
    stateData.forEach(state => {
        // Find the path element for this state
        const statePath = svgContainer.querySelector(`path[name="${state.name}"]`);
        if (!statePath) return;
        
        // Get the bounding box of the state path
        const bbox = statePath.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        
        // Create text element for value label
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', centerX);
        textElement.setAttribute('y', centerY);
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.setAttribute('class', 'state-value-label');
        textElement.style.fontSize = '10px';
        textElement.style.fontWeight = 'bold';
        textElement.style.fill = '#ffffff';
        textElement.style.pointerEvents = 'none';
        textElement.textContent = `₹${state.spending.toLocaleString('en-IN', {maximumFractionDigits: 1})}Cr`;
        
        svgContainer.appendChild(textElement);
    });
}

function calculateStateDataForStates(states, data) {
    const stateMap = new Map();
    
    data.forEach(row => {
        const state = canonicalStateName(row['CSR State']);
        if (!states.includes(state)) return;
        
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const company = row['Company Name'];
        
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
        stateData.companies.add(company);
    });
    
    return Array.from(stateMap.values()).map(state => ({
        ...state,
        companies: state.companies.size
    }));
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

    // NEW: Update map highlighting
    const selectedStates = showAllStates ? 
        Array.from(new Set(rawData.map(r => canonicalStateName(r['CSR State'])))) :
        stateFilter.filter(s => s !== "__ALL__");
    
    highlightMapStates(selectedStates);
    // Update map value labels
    labelSelectedStatesWithValues(selectedStates, filteredData);
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

    // NEW: Clear map highlighting and labels
    highlightMapStates([]);
    labelSelectedStatesWithValues([], []);
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

    const totalSpending = filteredData.reduce((sum, row) => 
        sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
    
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
            <td class="number">₹${state.avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td class="number">${state.percentage.toFixed(2)}%</td>
        </tr>
    `).join('');
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
}

function updateCompaniesTable() {
    const companiesData = calculateCompanyData();
    const totalPages = Math.ceil(companiesData.length / rowsPerPage);
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
            <td>${company.primaryState}</td>
            <td>${company.primarySector}</td>
            <td class="number">₹${company.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td class="number">${company.projects.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    // Update pagination
    updateElement('currentPage', currentPage);
    updateElement('totalPages', totalPages);

    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function calculateStateData() {
    const stateMap = new Map();
    const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);

    filteredData.forEach(row => {
        const state = canonicalStateName(row['CSR State']);
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const company = row['Company Name'];

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
        stateData.companies.add(company);
    });

    return Array.from(stateMap.values())
        .map(state => ({
            ...state,
            companies: state.companies.size,
            avgPerProject: state.projects > 0 ? state.spending / state.projects : 0,
            percentage: totalSpending > 0 ? (state.spending / totalSpending) * 100 : 0
        }))
        .sort((a, b) => b.spending - a.spending);
}

function calculateSectorData() {
    const sectorMap = new Map();
    const totalSpending = filteredData.reduce((sum, row) => sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);

    filteredData.forEach(row => {
        const sector = row['CSR Development Sector'] || 'Unknown';
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const company = row['Company Name'];

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
        sectorData.companies.add(company);
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
        const company = row['Company Name'];
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const state = canonicalStateName(row['CSR State']);
        const sector = row['CSR Development Sector'] || 'Unknown';
        const psuType = row['PSU/Non-PSU'] || 'Unknown';

        if (!companyMap.has(company)) {
            companyMap.set(company, {
                name: company,
                spending: 0,
                projects: 0,
                states: new Map(),
                sectors: new Map(),
                psuType: psuType
            });
        }

        const companyData = companyMap.get(company);
        companyData.spending += spending;
        companyData.projects += 1;

        // Track states and sectors for this company
        companyData.states.set(state, (companyData.states.get(state) || 0) + spending);
        companyData.sectors.set(sector, (companyData.sectors.get(sector) || 0) + spending);
    });

    return Array.from(companyMap.values())
        .map(company => {
            // Find primary state and sector (highest spending)
            const primaryState = [...company.states.entries()]
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
            const primarySector = [...company.sectors.entries()]
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

            return {
                name: company.name,
                spending: company.spending,
                projects: company.projects,
                primaryState,
                primarySector,
                psuType: company.psuType
            };
        })
        .sort((a, b) => b.spending - a.spending);
}

function updateCharts() {
    updateOverviewCharts();
    updateStatesChart();
    updateSectorsChart();
    updateCompaniesChart();
}

// ENHANCED: Overview Charts with improved features
function updateOverviewCharts() {
    const statesData = calculateStateData().slice(0, 15);
    const sectorsData = calculateSectorData().slice(0, 10);
    
    // Enhanced subtitle with filter information
    const filtersSummary = getSelectedFiltersSummary();
    const chartSubtitle = filtersSummary ? 
        `CSR Dashboard Analysis | ${filtersSummary}` : 
        'CSR Dashboard Analysis | All Data';

    // Top 15 States Chart - ENHANCED
    const statesCtx = document.getElementById('overviewStatesChart');
    if (statesCtx) {
        if (overviewStatesChartInstance) {
            overviewStatesChartInstance.destroy();
        }
        
        overviewStatesChartInstance = new Chart(statesCtx, {
            type: 'bar',
            data: {
                labels: statesData.map(s => s.name),
                datasets: [{
                    label: 'Total Spending (₹ Cr)',
                    data: statesData.map(s => s.spending),
                    backgroundColor: 'rgba(31, 122, 140, 0.8)',
                    borderColor: 'rgba(31, 122, 140, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'Top 15 States/UTs by CSR Spending',
                            chartSubtitle
                        ],
                        font: { size: 14, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => `₹${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}Cr`,
                        font: { size: 10, weight: 'bold' },
                        color: 'rgba(31, 122, 140, 0.9)'
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            font: { size: 10 }
                        },
                        title: {
                            display: true,
                            text: 'States/Union Territories',
                            font: { size: 12, weight: 'bold' }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'CSR Spending (₹ Crores)',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: function(value) {
                                return `₹${value.toLocaleString('en-IN')}Cr`;
                            }
                        }
                    }
                }
            },
            plugins: [customWatermark]
        });
        
        // Make chart instance globally available
        window.overviewStatesChartInstance = overviewStatesChartInstance;
    }

    // Top Development Sectors Chart - ENHANCED  
    const sectorsCtx = document.getElementById('overviewSectorsChart');
    if (sectorsCtx) {
        if (overviewSectorsChartInstance) {
            overviewSectorsChartInstance.destroy();
        }
        
        overviewSectorsChartInstance = new Chart(sectorsCtx, {
            type: 'doughnut',
            data: {
                labels: sectorsData.map(s => s.name),
                datasets: [{
                    data: sectorsData.map(s => s.spending),
                    backgroundColor: [
                        'rgba(31, 122, 140, 0.8)', 'rgba(45, 166, 178, 0.8)',
                        'rgba(50, 184, 198, 0.8)', 'rgba(127, 176, 105, 0.8)',
                        'rgba(168, 75, 47, 0.8)', 'rgba(230, 129, 97, 0.8)',
                        'rgba(192, 21, 47, 0.8)', 'rgba(255, 84, 89, 0.8)',
                        'rgba(98, 108, 113, 0.8)', 'rgba(167, 169, 169, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'Top Development Sectors by CSR Spending',
                            chartSubtitle
                        ],
                        font: { size: 14, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: {
                        position: 'right',
                        labels: { 
                            boxWidth: 12,
                            font: { size: 10 }
                        }
                    },
                    datalabels: {
                        formatter: (value, context) => {
                            const percentage = ((value / sectorsData.reduce((sum, s) => sum + s.spending, 0)) * 100).toFixed(1);
                            return percentage > 3 ? `${percentage}%` : '';
                        },
                        font: { size: 10, weight: 'bold' },
                        color: 'white'
                    }
                }
            },
            plugins: [customWatermark]
        });
        
        // Make chart instance globally available
        window.overviewSectorsChartInstance = overviewSectorsChartInstance;
    }
}

// ENHANCED: States Analysis Chart
function updateStatesChart() {
    const statesData = calculateStateData();
    const filtersSummary = getSelectedFiltersSummary();
    const chartSubtitle = filtersSummary ? 
        `CSR Dashboard Analysis | ${filtersSummary}` : 
        'CSR Dashboard Analysis | All Data';

    const ctx = document.getElementById('statesChart');
    if (ctx) {
        if (statesChartInstance) {
            statesChartInstance.destroy();
        }
        
        statesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: statesData.map(s => s.name),
                datasets: [{
                    label: 'Total Spending (₹ Cr)',
                    data: statesData.map(s => s.spending),
                    backgroundColor: 'rgba(31, 122, 140, 0.8)',
                    borderColor: 'rgba(31, 122, 140, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'All States/UTs CSR Spending Analysis',
                            chartSubtitle
                        ],
                        font: { size: 14, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: { display: false },
                    datalabels: {
                        display: function(context) {
                            return context.dataIndex < 10; // Show labels only for top 10
                        },
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value > 0 ? `₹${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}Cr` : '',
                        font: { size: 9, weight: 'bold' },
                        color: 'rgba(31, 122, 140, 0.9)'
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 90,
                            font: { size: 8 }
                        },
                        title: {
                            display: true,
                            text: 'States/Union Territories',
                            font: { size: 12, weight: 'bold' }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'CSR Spending (₹ Crores)',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: function(value) {
                                return `₹${value.toLocaleString('en-IN')}Cr`;
                            }
                        }
                    }
                }
            },
            plugins: [customWatermark]
        });
        
        // Make chart instance globally available
        window.statesChartInstance = statesChartInstance;
    }
}

// ENHANCED: Sectors Analysis Chart
function updateSectorsChart() {
    const sectorsData = calculateSectorData();
    const filtersSummary = getSelectedFiltersSummary();
    const chartSubtitle = filtersSummary ? 
        `CSR Dashboard Analysis | ${filtersSummary}` : 
        'CSR Dashboard Analysis | All Data';

    const ctx = document.getElementById('sectorsChart');
    if (ctx) {
        if (sectorsChartInstance) {
            sectorsChartInstance.destroy();
        }
        
        sectorsChartInstance = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: sectorsData.map(s => s.name.length > 40 ? s.name.substring(0, 37) + '...' : s.name),
                datasets: [{
                    label: 'Total Spending (₹ Cr)',
                    data: sectorsData.map(s => s.spending),
                    backgroundColor: 'rgba(50, 184, 198, 0.8)',
                    borderColor: 'rgba(50, 184, 198, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'All Development Sectors CSR Analysis',
                            chartSubtitle
                        ],
                        font: { size: 14, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        formatter: (value) => value > 0 ? `₹${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}Cr` : '',
                        font: { size: 9, weight: 'bold' },
                        color: 'rgba(50, 184, 198, 0.9)'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'CSR Spending (₹ Crores)',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: function(value) {
                                return `₹${value.toLocaleString('en-IN')}Cr`;
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Development Sectors',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: { font: { size: 9 } }
                    }
                }
            },
            plugins: [customWatermark]
        });
        
        // Make chart instance globally available
        window.sectorsChartInstance = sectorsChartInstance;
    }
}

// ENHANCED: Companies Analysis Chart
function updateCompaniesChart() {
    const companiesData = calculateCompanyData().slice(0, 20);
    const filtersSummary = getSelectedFiltersSummary();
    const chartSubtitle = filtersSummary ? 
        `CSR Dashboard Analysis | ${filtersSummary}` : 
        'CSR Dashboard Analysis | All Data';

    const ctx = document.getElementById('companiesChart');
    if (ctx) {
        if (companiesChartInstance) {
            companiesChartInstance.destroy();
        }
        
        companiesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: companiesData.map(c => c.name.length > 25 ? c.name.substring(0, 22) + '...' : c.name),
                datasets: [{
                    label: 'Total Spending (₹ Cr)',
                    data: companiesData.map(c => c.spending),
                    backgroundColor: 'rgba(168, 75, 47, 0.8)',
                    borderColor: 'rgba(168, 75, 47, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: [
                            'Top 20 Companies by CSR Spending',
                            chartSubtitle
                        ],
                        font: { size: 14, weight: 'bold' },
                        padding: { top: 10, bottom: 20 }
                    },
                    legend: { display: false },
                    datalabels: {
                        display: function(context) {
                            return context.dataIndex < 10; // Show labels only for top 10
                        },
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value > 0 ? `₹${value.toLocaleString('en-IN', {maximumFractionDigits: 1})}Cr` : '',
                        font: { size: 9, weight: 'bold' },
                        color: 'rgba(168, 75, 47, 0.9)'
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 90,
                            font: { size: 8 }
                        },
                        title: {
                            display: true,
                            text: 'Companies',
                            font: { size: 12, weight: 'bold' }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'CSR Spending (₹ Crores)',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: function(value) {
                                return `₹${value.toLocaleString('en-IN')}Cr`;
                            }
                        }
                    }
                }
            },
            plugins: [customWatermark]
        });
        
        // Make chart instance globally available
        window.companiesChartInstance = companiesChartInstance;
    }
}

function changePage(direction) {
    const companiesData = calculateCompanyData();
    const totalPages = Math.ceil(companiesData.length / rowsPerPage);

    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        updateCompaniesTable();
    }
}

function exportFilteredData() {
    exportData(filteredData, 'filtered_csr_data.csv');
}

function exportStatesData() {
    const statesData = calculateStateData();
    const csvData = statesData.map(state => ({
        'State/Region': state.name,
        'Total Spending (₹ Cr)': state.spending.toFixed(2),
        'Number of Projects': state.projects,
        'Number of Companies': state.companies,
        'Average per Project (₹ Cr)': state.avgPerProject.toFixed(2),
        'Percentage of Total': state.percentage.toFixed(2) + '%'
    }));
    exportData(csvData, 'states_analysis.csv');
}

function exportSectorsData() {
    const sectorsData = calculateSectorData();
    const csvData = sectorsData.map(sector => ({
        'Development Sector': sector.name,
        'Total Spending (₹ Cr)': sector.spending.toFixed(2),
        'Number of Projects': sector.projects,
        'Companies Involved': sector.companies,
        'Percentage of Total': sector.percentage.toFixed(2) + '%'
    }));
    exportData(csvData, 'sectors_analysis.csv');
}

function exportCompaniesData() {
    const companiesData = calculateCompanyData();
    const csvData = companiesData.map((company, index) => ({
        'Rank': index + 1,
        'Company Name': company.name,
        'PSU Type': company.psuType,
        'Primary State': company.primaryState,
        'Primary Sector': company.primarySector,
        'Total Spending (₹ Cr)': company.spending.toFixed(2),
        'Number of Projects': company.projects
    }));
    exportData(csvData, 'companies_analysis.csv');
}

function exportData(data, filename) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
