// app.js (Complete Revised CSR Dashboard with Enhanced Features)
// Last updated: Wed Aug 06, 2025
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

// Register ChartDataLabels plugin globally
Chart.register(ChartDataLabels);

// Dashboard Watermark Plugin
const dashboardWatermarkPlugin = {
    id: 'dashboardWatermark',
    afterDraw: (chart) => {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        if (!chartArea) return;
        
        ctx.save();
        ctx.font = 'bold 12px Arial';
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Prepared by Ashok Thanikonda', chartArea.right - 10, chartArea.bottom - 5);
        ctx.globalAlpha = 1;
        ctx.restore();
    }
};
Chart.register(dashboardWatermarkPlugin);

document.addEventListener("DOMContentLoaded", async () => {
    await loadFullDataset();
    initializeTabs();
    initializeFilters();
    initializeEventListeners();
    updateDashboard();
    loadIndiaMap();
});

// Function to get selected filters summary for chart subtitles
function getSelectedFiltersSummary() {
    const stateFilter = Array.from(document.getElementById('stateFilter')?.selectedOptions || []).map(o => o.value);
    const sectorFilter = Array.from(document.getElementById('sectorFilter')?.selectedOptions || []).map(o => o.value);
    const psuFilter = Array.from(document.getElementById('psuFilter')?.selectedOptions || []).map(o => o.value);
    const companySearch = document.getElementById('companySearch')?.value || '';

    const showAllStates = stateFilter.includes("__ALL__");
    const showAllSectors = sectorFilter.includes("__ALL__");
    const showAllPSU = psuFilter.includes("__ALL__");

    let summaryParts = [];
    
    if (!showAllStates && stateFilter.length > 0) {
        const count = stateFilter.length;
        summaryParts.push(`${count} State${count > 1 ? 's' : ''}`);
    }
    
    if (!showAllSectors && sectorFilter.length > 0) {
        const count = sectorFilter.length;
        summaryParts.push(`${count} Sector${count > 1 ? 's' : ''}`);
    }
    
    if (!showAllPSU && psuFilter.length > 0) {
        summaryParts.push(psuFilter.join(', '));
    }
    
    if (companySearch.trim()) {
        summaryParts.push(`"${companySearch.trim()}"`);
    }

    return summaryParts.length > 0 ? `Filtered: ${summaryParts.join(', ')}` : '';
}

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
        "dadra and nagar haveli", 
        "daman and diu", 
        "dadra & nagar haveli", 
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

// Function to add data labels to map states
function addStateDataLabel(svgPath, label) {
    const svgNS = "http://www.w3.org/2000/svg";
    const bbox = svgPath.getBBox();
    let text = svgPath.parentNode.querySelector(`text[data-for='${svgPath.id}']`);
    
    if (!text) {
        text = document.createElementNS(svgNS, 'text');
        text.setAttribute('data-for', svgPath.id);
        text.setAttribute('fill', '#08233a');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-weight', 'bold');
        svgPath.parentNode.appendChild(text);
    }
    
    text.setAttribute('x', bbox.x + bbox.width/2);
    text.setAttribute('y', bbox.y + bbox.height/2 + 3);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('pointer-events', 'none');
    text.setAttribute('opacity', '0.8');
    text.textContent = label;
}

// Function to remove all state data labels
function removeStateDataLabels() {
    const svgContainer = document.querySelector('#indiaMap');
    if (svgContainer) {
        const labels = svgContainer.querySelectorAll('text[data-for]');
        labels.forEach(label => label.remove());
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

// COMPLETELY REWRITTEN: Proper state highlighting function with data labels
function highlightMapStates(canon) {
    const svgContainer = document.querySelector('#indiaMap');
    if (!svgContainer || !canon || canon.length === 0) {
        removeStateDataLabels();
        return;
    }
    
    const paths = svgContainer.querySelectorAll('path');
    
    // Reset all highlights and remove existing labels
    removeStateDataLabels();
    paths.forEach(p => {
        p.style.fill = '#7FB069';
        p.classList.remove('state-selected');
    });
    
    // Handle "Unspecified geography" – skip highlighting
    if (canon.includes('Unspecified geography')) return;
    
    // Handle "PAN India" – highlight everything
    if (canon.includes('PAN India')) {
        paths.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
        });
        return;
    }
    
    // Get state data for labels
    const stateData = calculateStateData();
    
    // Highlight only matching state paths by name and add data labels
    canon.forEach(state => {
        const matches = svgContainer.querySelectorAll(`path[name="${state}"]`);
        matches.forEach(p => {
            p.style.fill = '#1f7a8c';
            p.classList.add('state-selected');
            
            // Add data label
            const data = stateData.find(s => s.name === state);
            if (data && data.spending > 0) {
                const label = data.spending >= 100 ? 
                    `₹${Math.round(data.spending)}` : 
                    `₹${data.spending.toFixed(1)}`;
                addStateDataLabel(p, label);
            }
        });
    });
    
    console.log("Highlighting these states:", canon);
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
    
    // Update map highlighting
    const selectedStates = showAllStates ? 
        Array.from(new Set(rawData.map(r => canonicalStateName(r['CSR State'])))) : 
        stateFilter.filter(s => s !== "__ALL__");
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

function calculateStateData() {
    const stateMap = new Map();
    
    filteredData.forEach(row => {
        const stateName = canonicalStateName(row['CSR State']);
        if (!stateName || stateName === 'Unknown') return;
        
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const company = row['Company Name'];
        
        if (!stateMap.has(stateName)) {
            stateMap.set(stateName, {
                name: stateName,
                spending: 0,
                projects: 0,
                companies: new Set()
            });
        }
        
        const stateData = stateMap.get(stateName);
        stateData.spending += spending;
        stateData.projects += 1;
        if (company && company.trim()) {
            stateData.companies.add(company.trim());
        }
    });
    
    // Convert to array and add calculated fields
    const statesData = Array.from(stateMap.values()).map(state => ({
        ...state,
        companies: state.companies.size,
        avgPerProject: state.projects > 0 ? state.spending / state.projects : 0
    }));
    
    // Sort by spending (descending)
    return statesData.sort((a, b) => b.spending - a.spending);
}

function updateCharts() {
    // Get filter summary for subtitles
    const filterSummary = getSelectedFiltersSummary();
    const subtitleText = `India CSR Spending Dashboard | FY 2023-24${filterSummary ? " | " + filterSummary : ""}`;
    
    updateOverviewChartsWithSubtitle(subtitleText);
    updateStatesChartWithSubtitle(subtitleText);
    updateSectorsChartWithSubtitle(subtitleText);
    updateCompaniesChartWithSubtitle(subtitleText);
}

function updateOverviewChartsWithSubtitle(subtitleText) {
    const statesData = calculateStateData().slice(0, 15);
    const sectorsData = calculateSectorData().slice(0, 10);
    
    // Overview States Chart
    const overviewStatesCtx = document.getElementById('overviewStatesChart');
    if (overviewStatesCtx) {
        if (window.overviewStatesChartInstance) {
            window.overviewStatesChartInstance.destroy();
        }
        
        window.overviewStatesChartInstance = new Chart(overviewStatesCtx, {
            type: 'bar',
            data: {
                labels: statesData.map(s => s.name),
                datasets: [{
                    label: 'CSR Spending (₹ Cr)',
                    data: statesData.map(s => s.spending),
                    backgroundColor: '#33808d',
                    borderColor: '#1d4c56',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 15 States by CSR Spending',
                        font: { size: 16, weight: "bold" }
                    },
                    subtitle: {
                        display: true,
                        text: subtitleText,
                        font: { size: 12, style: "italic" },
                        color: "#666",
                        padding: { bottom: 10 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#222',
                        font: { weight: 'bold', size: 11 },
                        formatter: (v) => v === 0 ? '' : `₹${(+v).toLocaleString('en-IN', {maximumFractionDigits: 1})} Cr`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "₹\nCr",
                            font: { size: 14, weight: "bold" }
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
    
    // Overview Sectors Chart
    const overviewSectorsCtx = document.getElementById('overviewSectorsChart');
    if (overviewSectorsCtx) {
        if (window.overviewSectorsChartInstance) {
            window.overviewSectorsChartInstance.destroy();
        }
        
        window.overviewSectorsChartInstance = new Chart(overviewSectorsCtx, {
            type: 'doughnut',
            data: {
                labels: sectorsData.map(s => s.name),
                datasets: [{
                    data: sectorsData.map(s => s.spending),
                    backgroundColor: [
                        '#33808d', '#4a9ca8', '#5fb8c2', '#74d4dd',
                        '#89f0f7', '#1d4c56', '#2a5f6a', '#37727e',
                        '#448592', '#5198a6', '#5eabba'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Development Sectors',
                        font: { size: 16, weight: "bold" }
                    },
                    subtitle: {
                        display: true,
                        text: subtitleText,
                        font: { size: 12, style: "italic" },
                        color: "#666",
                        padding: { bottom: 10 }
                    },
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 10 } }
                    },
                    datalabels: {
                        display: false
                    }
                }
            }
        });
    }
}

function updateStatesChartWithSubtitle(subtitleText) {
    const statesData = calculateStateData();
    const statesCtx = document.getElementById('statesChart');
    
    if (statesCtx) {
        if (window.statesChartInstance) {
            window.statesChartInstance.destroy();
        }
        
        window.statesChartInstance = new Chart(statesCtx, {
            type: 'bar',
            data: {
                labels: statesData.map(s => s.name),
                datasets: [{
                    label: 'CSR Spending (₹ Cr)',
                    data: statesData.map(s => s.spending),
                    backgroundColor: '#33808d',
                    borderColor: '#1d4c56',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'CSR Spending by States/UTs',
                        font: { size: 16, weight: "bold" }
                    },
                    subtitle: {
                        display: true,
                        text: subtitleText,
                        font: { size: 12, style: "italic" },
                        color: "#666",
                        padding: { bottom: 10 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#222',
                        font: { weight: 'bold', size: 10 },
                        formatter: (v) => v === 0 ? '' : `₹${(+v).toLocaleString('en-IN', {maximumFractionDigits: 1})} Cr`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "₹\nCr",
                            font: { size: 14, weight: "bold" }
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
}

function updateSectorsChartWithSubtitle(subtitleText) {
    const sectorsData = calculateSectorData();
    const sectorsCtx = document.getElementById('sectorsChart');
    
    if (sectorsCtx) {
        if (window.sectorsChartInstance) {
            window.sectorsChartInstance.destroy();
        }
        
        window.sectorsChartInstance = new Chart(sectorsCtx, {
            type: 'horizontalBar',
            data: {
                labels: sectorsData.map(s => s.name),
                datasets: [{
                    label: 'CSR Spending (₹ Cr)',
                    data: sectorsData.map(s => s.spending),
                    backgroundColor: '#33808d',
                    borderColor: '#1d4c56',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'CSR Spending by Development Sectors',
                        font: { size: 16, weight: "bold" }
                    },
                    subtitle: {
                        display: true,
                        text: subtitleText,
                        font: { size: 12, style: "italic" },
                        color: "#666",
                        padding: { bottom: 10 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#222',
                        font: { weight: 'bold', size: 10 },
                        formatter: (v) => v === 0 ? '' : `₹${(+v).toLocaleString('en-IN', {maximumFractionDigits: 1})} Cr`
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "CSR Spending (₹ Cr)",
                            font: { size: 14, weight: "bold" }
                        }
                    }
                }
            }
        });
    }
}

function updateCompaniesChartWithSubtitle(subtitleText) {
    const companiesData = calculateCompanyData().slice(0, 20);
    const companiesCtx = document.getElementById('companiesChart');
    
    if (companiesCtx) {
        if (window.companiesChartInstance) {
            window.companiesChartInstance.destroy();
        }
        
        window.companiesChartInstance = new Chart(companiesCtx, {
            type: 'bar',
            data: {
                labels: companiesData.map(c => c.name.length > 25 ? c.name.substring(0, 22) + '...' : c.name),
                datasets: [{
                    label: 'CSR Spending (₹ Cr)',
                    data: companiesData.map(c => c.spending),
                    backgroundColor: '#33808d',
                    borderColor: '#1d4c56',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 20 Companies by CSR Spending',
                        font: { size: 16, weight: "bold" }
                    },
                    subtitle: {
                        display: true,
                        text: subtitleText,
                        font: { size: 12, style: "italic" },
                        color: "#666",
                        padding: { bottom: 10 }
                    },
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        color: '#222',
                        font: { weight: 'bold', size: 9 },
                        formatter: (v) => v === 0 ? '' : `₹${(+v).toLocaleString('en-IN', {maximumFractionDigits: 1})} Cr`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "₹\nCr",
                            font: { size: 14, weight: "bold" }
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            font: { size: 9 }
                        }
                    }
                }
            }
        });
    }
}

function calculateSectorData() {
    const sectorMap = new Map();
    
    filteredData.forEach(row => {
        const sectorName = row['CSR Development Sector']?.trim();
        if (!sectorName) return;
        
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        const company = row['Company Name'];
        
        if (!sectorMap.has(sectorName)) {
            sectorMap.set(sectorName, {
                name: sectorName,
                spending: 0,
                projects: 0,
                companies: new Set()
            });
        }
        
        const sectorData = sectorMap.get(sectorName);
        sectorData.spending += spending;
        sectorData.projects += 1;
        if (company && company.trim()) {
            sectorData.companies.add(company.trim());
        }
    });
    
    const sectorsData = Array.from(sectorMap.values()).map(sector => ({
        ...sector,
        companies: sector.companies.size
    }));
    
    return sectorsData.sort((a, b) => b.spending - a.spending);
}

function calculateCompanyData() {
    const companyMap = new Map();
    
    filteredData.forEach(row => {
        const companyName = row['Company Name']?.trim();
        if (!companyName) return;
        
        const spending = parseSpending(row["Project Amount Spent (In INR Cr.)"]);
        
        if (!companyMap.has(companyName)) {
            companyMap.set(companyName, {
                name: companyName,
                spending: 0,
                projects: 0,
                psuType: row['PSU/Non-PSU'] || 'Unknown',
                state: canonicalStateName(row['CSR State']) || 'Unknown',
                sector: row['CSR Development Sector'] || 'Unknown'
            });
        }
        
        const companyData = companyMap.get(companyName);
        companyData.spending += spending;
        companyData.projects += 1;
    });
    
    return Array.from(companyMap.values()).sort((a, b) => b.spending - a.spending);
}

function updateStatesTable() {
    const statesData = calculateStateData();
    const tbody = document.getElementById('statesTableBody') || document.querySelector('#statesTable tbody');
    if (!tbody) return;
    
    const totalSpending = statesData.reduce((sum, state) => sum + state.spending, 0);
    
    tbody.innerHTML = statesData.map((state, index) => `
        <tr>
            <td>${state.name}</td>
            <td class="number">₹${state.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td class="number">${state.projects.toLocaleString('en-IN')}</td>
            <td class="number">${state.companies.toLocaleString('en-IN')}</td>
            <td class="number">₹${state.avgPerProject.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td class="number">${((state.spending / totalSpending) * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
}

function updateSectorsTable() {
    const sectorsData = calculateSectorData();
    const tbody = document.getElementById('sectorsTableBody') || document.querySelector('#sectorsTable tbody');
    if (!tbody) return;
    
    const totalSpending = sectorsData.reduce((sum, sector) => sum + sector.spending, 0);
    
    tbody.innerHTML = sectorsData.map((sector, index) => `
        <tr>
            <td>${sector.name}</td>
            <td class="number">₹${sector.spending.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
            <td class="number">${sector.projects.toLocaleString('en-IN')}</td>
            <td class="number">${sector.companies.toLocaleString('en-IN')}</td>
            <td class="number">${((sector.spending / totalSpending) * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
}

function updateCompaniesTable() {
    const companiesData = calculateCompanyData();
    const tbody = document.getElementById('companiesTableBody') || document.querySelector('#companiesTable tbody');
    if (!tbody) return;
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = companiesData.slice(startIndex, endIndex);
    
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
    
    // Update pagination
    const totalPages = Math.ceil(companiesData.length / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update pagination buttons
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    if (prevButton) prevButton.disabled = currentPage <= 1;
    if (nextButton) nextButton.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    const companiesData = calculateCompanyData();
    const totalPages = Math.ceil(companiesData.length / rowsPerPage);
    
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    updateCompaniesTable();
}

// Export functions
function exportFilteredData() {
    const csvContent = convertToCSV(filteredData);
    downloadCSV(csvContent, 'filtered_csr_data.csv');
}

function exportStatesData() {
    const statesData = calculateStateData();
    const csvContent = convertToCSV(statesData);
    downloadCSV(csvContent, 'states_csr_analysis.csv');
}

function exportSectorsData() {
    const sectorsData = calculateSectorData();
    const csvContent = convertToCSV(sectorsData);
    downloadCSV(csvContent, 'sectors_csr_analysis.csv');
}

function exportCompaniesData() {
    const companiesData = calculateCompanyData();
    const csvContent = convertToCSV(companiesData);
    downloadCSV(csvContent, 'companies_csr_analysis.csv');
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
        const values = headers.map(header => {
            const val = row[header];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        });
        csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
}

// Initialize when DOM is ready
console.log("CSR Dashboard initialized with all enhancements");
