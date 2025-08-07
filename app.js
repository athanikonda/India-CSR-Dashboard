// Complete CSR Dashboard JavaScript - Updated Version
// Includes watermark, dynamic subtitle with dashboard title and selected filters,
// vertical y-axis labels, bar value labels via Chart.js datalabels plugin,
// and map value labels for selected states.

console.log("Initializing enhanced dashboard...");

const csvUrl = '/api/fetch-sheet';
let rawData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 50;

// Chart instances to properly destroy/recreate
let chartInstances = {};

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
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('© India CSR Dashboard 2024 | Prepared by Ashok Thanikonda', width - 10, height - 10);
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

// State name canonicalization with SVG spellings
function canonicalStateName(name) {
    if (!name || !name.trim()) return 'Unknown';
    const n = name.trim().toLowerCase();
    
    if (["jammu and kashmir", "jammu & kashmir"].includes(n)) return "Jammu and Kashmir";
    if (["dadra and nagar haveli", "daman and diu", "dadra & nagar haveli", 
         "dadra and nagar haveli and daman and diu", 
         "dādra and nagar haveli and damān and diu"].includes(n)) {
        return "Dādra and Nagar Haveli and Damān and Diu";
    }
    if (["odisha", "orissa"].includes(n)) return "Orissa";
    if (["uttarakhand", "uttaranchal"].includes(n)) return "Uttaranchal";
    if (n.startsWith("pan india") || n === "pan india (other centralized funds)") return "PAN India";
    if (n.includes("not mentioned") || n.startsWith("nec") || n === "nec/not mentioned") return "Unspecified geography";
    
    return name.trim();
}

// Format states label for display
function formatStatesLabel(selectedStates) {
    const canonicalStates = new Set(selectedStates.map(canonicalStateName));
    
    if (canonicalStates.has("PAN India")) return "PAN India";
    if (canonicalStates.has("Unspecified geography")) return "Unspecified geography";
    
    let count = canonicalStates.size;
    return count === 1 ? "1 State/Union Territory" : `${count} States/Union Territories`;
}

// Get selected filters summary for chart subtitles
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
            parts.push(`States: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}`);
        }
    }
    
    if (sectorsSelect) {
        const selected = Array.from(sectorsSelect.selectedOptions || [])
            .map(opt => opt.value)
            .filter(v => v !== '__ALL__');
        if (selected.length > 0) {
            parts.push(`Sectors: ${selected.slice(0, 2).join(', ')}${selected.length > 2 ? '...' : ''}`);
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

// Update active filters display
function updateActiveFiltersDisplay() {
    const activeFiltersText = document.getElementById('activeFiltersText');
    if (activeFiltersText) {
        const summary = getSelectedFiltersSummary();
        activeFiltersText.textContent = summary || 'All data - No filters applied';
    }
    
    // Update map subtitle
    const mapSubtitle = document.querySelector('.map-subtitle');
    if (mapSubtitle) {
        const filterSummary = getSelectedFiltersSummary();
        const baseText = 'Interactive visualization of CSR spending distribution across Indian states and union territories';
        if (filterSummary) {
            mapSubtitle.textContent = `${baseText} | Current filters: ${filterSummary}`;
        } else {
            mapSubtitle.textContent = baseText;
        }
    }
}

async function loadFullDataset() {
    try {
        console.log('Loading dataset...');
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                worker: false, // Changed to false for better compatibility
                dynamicTyping: false,
                complete: function (parsed) {
                    rawData = parsed.data.filter(row => 
                        row['Company Name'] && 
                        row['Company Name'].trim() !== '' &&
                        row["Project Amount Spent (In INR Cr.)"] &&
                        !isNaN(parseFloat(row["Project Amount Spent (In INR Cr.)"]))
                    );
                    filteredData = [...rawData];
                    console.log(`Loaded ${rawData.length} records`);
                    resolve();
                },
                error: function (err) {
                    console.error('CSV parsing error:', err);
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
            
            // Add map watermark
            const watermark = document.createElement('div');
            watermark.className = 'map-watermark';
            watermark.textContent = '© India CSR Dashboard 2024 | Data: MCA Gov of India';
            mapContainer.appendChild(watermark);
            
            const statePaths = mapContainer.querySelectorAll('path, g[id]');
            statePaths.forEach(path => {
                path.addEventListener('mouseenter', handleMapHover);
                path.addEventListener('mouseleave', handleMapLeave);
                path.addEventListener('click', handleMapClick);
            });
        }
    } catch (error) {
        console.error("Error loading India map:", error);
        // Fallback map display
        const mapContainer = document.querySelector('#indiaMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--color-bg-1); border-radius: 8px;">
                    <div style="text-align: center; padding: 20px;">
                        <h3>India CSR Map</h3>
                        <p>Interactive map unavailable - showing data summary</p>
                        <div id="mapDataSummary"></div>
                    </div>
                </div>
            `;
            updateMapDataSummary();
        }
    }
}

function updateMapDataSummary() {
    const summaryContainer = document.getElementById('mapDataSummary');
    if (summaryContainer) {
        const stateData = calculateStateData();
        const totalSpending = stateData.reduce((sum, state) => sum + state.spending, 0);
        
        summaryContainer.innerHTML = `
            <p><strong>Total CSR Spending: ₹${totalSpending.toFixed(2)} Cr</strong></p>
            <p>Across ${stateData.length} States/UTs</p>
            <div style="margin-top: 15px;">
                <strong>Top 5 States:</strong><br>
                ${stateData.slice(0, 5).map(state => 
                    `${state.name}: ₹${state.spending.toFixed(2)} Cr`
                ).join('<br>')}
            </div>
        `;
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
            document.getElementById('tooltipSpending').textContent = 
                `₹${stateData.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`;
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

// State highlighting function
function highlightMapStates(selectedStates) {
    const svgContainer = document.querySelector('#indiaMap');
    if (!svgContainer || !selectedStates || selectedStates.length === 0) return;
    
    const paths = svgContainer.querySelectorAll('path');
    paths.forEach(p => {
        p.style.fill = '#7FB069';
        p.classList.remove('state-selected');
    });
    
    if (selectedStates.includes('Unspecified geography')) return;
    
    if (selectedStates.includes('PAN India')) {
        paths.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
        });
        return;
    }
    
    selectedStates.forEach(state => {
        const matches = svgContainer.querySelectorAll(`path[name="${state}"]`);
        matches.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
        });
    });
}

// Update map data labels for selected states
function updateMapDataLabels(selectedStates, data) {
    const labelsContainer = document.querySelector('.map-data-labels .labels-grid');
    if (!labelsContainer) return;
    
    if (!selectedStates || selectedStates.length === 0) {
        labelsContainer.innerHTML = '<div class="data-label-item"><div class="data-label-title">No states selected</div><div class="data-label-value">Select states to view data</div></div>';
        return;
    }
    
    const stateData = calculateStateData().filter(state => selectedStates.includes(state.name));
    
    labelsContainer.innerHTML = stateData.map(state => `
        <div class="data-label-item">
            <div class="data-label-title">${state.name}</div>
            <div class="data-label-value">₹${state.spending.toFixed(2)} Cr</div>
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 4px;">
                ${state.projects} projects, ${state.companies} companies
            </div>
        </div>
    `).join('');
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
        // Use the correct column names from your data
        const canonicalState = canonicalStateName(row['State/UT'] || row['CSR State']);
        if (canonicalState && canonicalState !== 'Unknown') stateSet.add(canonicalState);
        
        const sector = row['CSR Sector'] || row['CSR Development Sector'];
        if (sector && sector.trim()) {
            sectorSet.add(sector.trim());
        }
        
        const psuType = row['PSU_Type'] || row['PSU/Non-PSU'];
        if (psuType && psuType.trim()) {
            typeSet.add(psuType.trim());
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
    // Filter event listeners
    document.getElementById('stateFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sectorFilter')?.addEventListener('change', applyFilters);
    document.getElementById('psuFilter')?.addEventListener('change', applyFilters);
    document.getElementById('companySearch')?.addEventListener('input', debounce(applyFilters, 300));
    
    // Button event listeners
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
    
    // Export event listeners
    document.getElementById('exportFilteredData')?.addEventListener('click', exportFilteredData);
    document.getElementById('exportStatesData')?.addEventListener('click', exportStatesData);
    document.getElementById('exportSectorsData')?.addEventListener('click', exportSectorsData);
    document.getElementById('exportCompaniesData')?.addEventListener('click', exportCompaniesData);
    
    initializeChartDownloads();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
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
    const chartInstance = chartInstances[chartId];
    if (chartInstance) {
        const link = document.createElement('a');
        link.href = chartInstance.toBase64Image('image/png', 1.0);
        link.download = `${chartId}_chart.png`;
        link.click();
    }
}

function applyFilters() {
    const stateFilter = Array.from(document.getElementById('stateFilter')?.selectedOptions || [])
        .map(o => o.value);
    const sectorFilter = Array.from(document.getElementById('sectorFilter')?.selectedOptions || [])
        .map(o => o.value);
    const psuFilter = Array.from(document.getElementById('psuFilter')?.selectedOptions || [])
        .map(o => o.value);
    const companySearch = document.getElementById('companySearch')?.value.toLowerCase() || '';
    
    const showAllStates = stateFilter.includes("__ALL__");
    const showAllSectors = sectorFilter.includes("__ALL__");
    const showAllPSU = psuFilter.includes("__ALL__");
    
    filteredData = rawData.filter(row => {
        const canonicalState = canonicalStateName(row['State/UT'] || row['CSR State']);
        const stateMatch = showAllStates || stateFilter.includes(canonicalState);
        
        const sector = row['CSR Sector'] || row['CSR Development Sector'];
        const sectorMatch = showAllSectors || sectorFilter.includes(sector);
        
        const psuType = row['PSU_Type'] || row['PSU/Non-PSU'];
        const psuMatch = showAllPSU || psuFilter.includes(psuType);
        
        const companyMatch = !companySearch || 
            row['Company Name']?.toLowerCase().includes(companySearch);
        
        return stateMatch && sectorMatch && psuMatch && companyMatch;
    });
    
    currentPage = 1;
    updateDashboard();
    updateFilterResults();
    updateActiveFiltersDisplay();
    
    const selectedStates = showAllStates ? 
        Array.from(new Set(rawData.map(r => canonicalStateName(r['State/UT'] || r['CSR State'])))) :
        stateFilter.filter(s => s !== "__ALL__");
    
    highlightMapStates(selectedStates);
    updateMapDataLabels(selectedStates, filteredData);
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
    updateActiveFiltersDisplay();
    
    highlightMapStates([]);
    updateMapDataLabels([], []);
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
    // Hide loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    const mainDashboard = document.getElementById('mainDashboard');
    if (mainDashboard) mainDashboard.style.display = 'block';
    
    // Calculate metrics
    const totalSpending = filteredData.reduce((sum, row) => 
        sum + parseSpending(row["Project Amount Spent (In INR Cr.)"]), 0);
    const companies = new Set(filteredData.map(r => r['Company Name']).filter(name => name && name.trim()));
    const canonicalStates = new Set(filteredData.map(r => 
        canonicalStateName(r['State/UT'] || r['CSR State'])).filter(state => state && state !== 'Unknown'));
    const totalProjects = filteredData.length;
    const avgPerProject = totalProjects > 0 ? totalSpending / totalProjects : 0;
    
    const statesArray = Array.from(canonicalStates);
    const statesLabel = formatStatesLabel(statesArray);
    
    // Update header badges
    updateElement('totalCompaniesHeader', `${companies.size.toLocaleString('en-IN')} Companies`);
    updateElement('totalStatesHeader', statesLabel);
    updateElement('totalProjectsHeader', `${totalProjects.toLocaleString('en-IN')} Projects`);
    updateElement('totalSpendingHeader', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
    
    // Update metric cards
    updateElement('totalSpendingMetric', `₹${totalSpending.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
    updateElement('totalCompaniesMetric', companies.size.toLocaleString('en-IN'));
    updateElement('totalProjectsMetric', totalProjects.toLocaleString('en-IN'));
    updateElement('avgPerProjectMetric', `₹${avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})} Cr`);
    
    // Update tables and charts
    updateStatesTable();
    updateSectorsTable();
    updateCompaniesTable();
    updateCharts();
}

function updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) element.textContent = content;
}

function calculateStateData() {
    const stateMap = {};
    
    filteredData.forEach(row => {
        const state = canonicalStateName(row['State/UT'] || row['CSR State']);
        if (state && state !== 'Unknown') {
            if (!stateMap[state]) {
                stateMap[state] = {
                    name: state,
                    spending: 0,
                    projects: 0,
                    companies: new Set()
                };
            }
            stateMap[state].spending += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
            stateMap[state].projects += 1;
            stateMap[state].companies.add(row['Company Name']);
        }
    });
    
    return Object.values(stateMap)
        .map(state => ({
            name: state.name,
            spending: state.spending,
            projects: state.projects,
            companies: state.companies.size
        }))
        .sort((a, b) => b.spending - a.spending);
}

function calculateSectorData() {
    const sectorMap = {};
    
    filteredData.forEach(row => {
        const sector = row['CSR Sector'] || row['CSR Development Sector'];
        if (sector && sector.trim()) {
            if (!sectorMap[sector]) {
                sectorMap[sector] = {
                    name: sector,
                    spending: 0,
                    projects: 0,
                    companies: new Set()
                };
            }
            sectorMap[sector].spending += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
            sectorMap[sector].projects += 1;
            sectorMap[sector].companies.add(row['Company Name']);
        }
    });
    
    return Object.values(sectorMap)
        .map(sector => ({
            name: sector.name,
            spending: sector.spending,
            projects: sector.projects,
            companies: sector.companies.size
        }))
        .sort((a, b) => b.spending - a.spending);
}

function updateStatesTable() {
    const statesData = calculateStateData();
    const tbody = document.getElementById('statesTableBody') || document.querySelector('#statesTable tbody');
    if (!tbody) return;
    
    const totalSpending = statesData.reduce((sum, state) => sum + state.spending, 0);
    
    tbody.innerHTML = statesData.map(state => `
        <tr>
            <td>${state.name}</td>
            <td class="number">${state.spending.toFixed(2)}</td>
            <td class="number">${state.projects.toLocaleString()}</td>
            <td class="number">${state.companies.toLocaleString()}</td>
            <td class="number">${(state.spending / state.projects).toFixed(2)}</td>
            <td class="number">${((state.spending / totalSpending) * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
}

function updateSectorsTable() {
    const sectorsData = calculateSectorData();
    const tbody = document.getElementById('sectorsTableBody') || document.querySelector('#sectorsTable tbody');
    if (!tbody) return;
    
    const totalSpending = sectorsData.reduce((sum, sector) => sum + sector.spending, 0);
    
    tbody.innerHTML = sectorsData.map(sector => `
        <tr>
            <td>${sector.name}</td>
            <td class="number">${sector.spending.toFixed(2)}</td>
            <td class="number">${sector.projects.toLocaleString()}</td>
            <td class="number">${sector.companies.toLocaleString()}</td>
            <td class="number">${((sector.spending / totalSpending) * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
}

function updateCompaniesTable() {
    const companyMap = {};
    
    filteredData.forEach(row => {
        const company = row['Company Name'];
        if (company && company.trim()) {
            if (!companyMap[company]) {
                companyMap[company] = {
                    name: company,
                    spending: 0,
                    projects: 0,
                    state: row['State/UT'] || row['CSR State'] || '',
                    sector: row['CSR Sector'] || row['CSR Development Sector'] || '',
                    psuType: row['PSU_Type'] || row['PSU/Non-PSU'] || ''
                };
            }
            companyMap[company].spending += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
            companyMap[company].projects += 1;
        }
    });
    
    const companiesData = Object.values(companyMap).sort((a, b) => b.spending - a.spending);
    const tbody = document.getElementById('companiesTableBody') || document.querySelector('#companiesTable tbody');
    if (!tbody) return;
    
    // Pagination
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedCompanies = companiesData.slice(startIndex, endIndex);
    
    tbody.innerHTML = paginatedCompanies.map((company, index) => {
        const rank = startIndex + index + 1;
        const psuClass = company.psuType.toLowerCase().includes('psu') ? 'psu' : 'non-psu';
        
        return `
            <tr>
                <td>${rank}</td>
                <td>${company.name}</td>
                <td><span class="psu-type ${psuClass}">${company.psuType}</span></td>
                <td>${canonicalStateName(company.state)}</td>
                <td>${company.sector}</td>
                <td class="number">${company.spending.toFixed(2)}</td>
                <td class="number">${company.projects.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePagination(companiesData.length);
}

function updatePagination(totalRecords) {
    const totalPages = Math.ceil(totalRecords / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

function changePage(direction) {
    const companiesData = Object.values(filteredData.reduce((acc, row) => {
        const company = row['Company Name'];
        if (company && company.trim()) {
            if (!acc[company]) {
                acc[company] = { spending: 0, projects: 0 };
            }
            acc[company].spending += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
            acc[company].projects += 1;
        }
        return acc;
    }, {}));
    
    const totalPages = Math.ceil(companiesData.length / rowsPerPage);
    
    if (direction === -1 && currentPage > 1) {
        currentPage--;
        updateCompaniesTable();
    } else if (direction === 1 && currentPage < totalPages) {
        currentPage++;
        updateCompaniesTable();
    }
}

function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    // Destroy existing chart
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Default configuration with data labels
    const defaultConfig = {
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: config.options?.plugins?.legend?.display !== false,
                    position: 'top'
                },
                datalabels: {
                    display: function(context) {
                        return context.chart.width > 400; // Hide labels on small screens
                    },
                    anchor: 'end',
                    align: 'top',
                    formatter: function(value) {
                        return parseFloat(value).toFixed(1); // No "Cr." unit on chart labels
                    },
                    color: '#666',
                    font: {
                        size: 10,
                        weight: 'bold'
                    }
                }
            },
            scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return parseFloat(value).toFixed(1);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Amount (₹ Crores)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            } : undefined
        },
        ...config
    };
    
    // Merge custom options
    if (config.options) {
        defaultConfig.options = { ...defaultConfig.options, ...config.options };
    }
    
    const chart = new Chart(ctx, defaultConfig);
    chartInstances[canvasId] = chart;
    
    return chart;
}

function updateCharts() {
    try {
        updateOverviewCharts();
        updateDetailCharts();
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

function updateOverviewCharts() {
    const statesData = calculateStateData();
    const sectorsData = calculateSectorData();
    
    // Top 15 States Chart
    const topStates = statesData.slice(0, 15);
    createChart('overviewStatesChart', {
        type: 'bar',
        data: {
            labels: topStates.map(state => state.name),
            datasets: [{
                label: 'CSR Spending',
                data: topStates.map(state => state.spending),
                backgroundColor: 'rgba(33, 128, 141, 0.8)',
                borderColor: 'rgba(33, 128, 141, 1)',
                borderWidth: 1
            }]
        }
    });
    
    // Top 10 Development Sectors Chart
    const topSectors = sectorsData.slice(0, 10);
    createChart('overviewSectorsChart', {
        type: 'horizontalBar',
        data: {
            labels: topSectors.map(sector => 
                sector.name.length > 25 ? sector.name.substring(0, 25) + '...' : sector.name
            ),
            datasets: [{
                label: 'CSR Spending',
                data: topSectors.map(sector => sector.spending),
                backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
                ],
                borderWidth: 1
            }]
        }
    });
}

function updateDetailCharts() {
    const statesData = calculateStateData();
    const sectorsData = calculateSectorData();
    
    // All States Chart
    createChart('statesChart', {
        type: 'bar',
        data: {
            labels: statesData.map(state => state.name),
            datasets: [{
                label: 'CSR Spending',
                data: statesData.map(state => state.spending),
                backgroundColor: 'rgba(33, 128, 141, 0.8)',
                borderColor: 'rgba(33, 128, 141, 1)',
                borderWidth: 1
            }]
        }
    });
    
    // All Sectors Chart (Doughnut)
    createChart('sectorsChart', {
        type: 'doughnut',
        data: {
            labels: sectorsData.map(sector => 
                sector.name.length > 20 ? sector.name.substring(0, 20) + '...' : sector.name
            ),
            datasets: [{
                data: sectorsData.map(sector => sector.spending),
                backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                    '#F8C471', '#82E0AA', '#AED6F1', '#E8DAEF', '#FADBD8'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
    
    // Top Companies Chart
    const companyMap = {};
    filteredData.forEach(row => {
        const company = row['Company Name'];
        if (company && company.trim()) {
            if (!companyMap[company]) {
                companyMap[company] = 0;
            }
            companyMap[company] += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        }
    });
    
    const topCompanies = Object.entries(companyMap)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20);
    
    createChart('companiesChart', {
        type: 'bar',
        data: {
            labels: topCompanies.map(([company]) => 
                company.length > 15 ? company.substring(0, 15) + '...' : company
            ),
            datasets: [{
                label: 'CSR Spending',
                data: topCompanies.map(([, spending]) => spending),
                backgroundColor: 'rgba(33, 128, 141, 0.8)',
                borderColor: 'rgba(33, 128, 141, 1)',
                borderWidth: 1
            }]
        }
    });
}

// Export functions
function exportFilteredData() {
    downloadCSV(filteredData, 'india-csr-filtered-data.csv');
}

function exportStatesData() {
    const statesData = calculateStateData();
    downloadCSV(statesData, 'india-csr-states-analysis.csv');
}

function exportSectorsData() {
    const sectorsData = calculateSectorData();
    downloadCSV(sectorsData, 'india-csr-sectors-analysis.csv');
}

function exportCompaniesData() {
    const companyMap = {};
    filteredData.forEach(row => {
        const company = row['Company Name'];
        if (company && company.trim()) {
            if (!companyMap[company]) {
                companyMap[company] = {
                    name: company,
                    spending: 0,
                    projects: 0,
                    state: row['State/UT'] || row['CSR State'] || '',
                    sector: row['CSR Sector'] || row['CSR Development Sector'] || '',
                    psuType: row['PSU_Type'] || row['PSU/Non-PSU'] || ''
                };
            }
            companyMap[company].spending += parseSpending(row["Project Amount Spent (In INR Cr.)"]);
            companyMap[company].projects += 1;
        }
    });
    
    const companiesData = Object.values(companyMap);
    downloadCSV(companiesData, 'india-csr-companies-analysis.csv');
}

function downloadCSV(data, filename) {
    if (!data || data.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            let value = row[header] || '';
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}
