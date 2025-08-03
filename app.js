// Global data holders
let csrData = [];
let filteredData = [];
let statesList = new Set();
let sectorsList = new Set();

// Fetch CSV from backend proxy
fetch('/csr-data')
  .then(res => res.text())
  .then(csvText => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        csrData = results.data;
        initFilters();
        applyFilters();
        setupEventListeners();
      },
      error: function(err) {
        console.error('Failed to parse CSV:', err);
      }
    });
  });

// Initialize filter options from data
function initFilters() {
  // Populate unique states and sectors sets
  csrData.forEach(item => {
    if (item['State/UT']) {
      statesList.add(item['State/UT'].trim());
    }
    if (item['Development Sector']) {
      sectorsList.add(item['Development Sector'].trim());
    }
  });

  // Populate state filter select options
  const stateFilter = document.getElementById('stateFilter');
  Array.from(statesList).sort().forEach(state => {
    let option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateFilter.appendChild(option);
  });

  // Populate sector filter select options
  const sectorFilter = document.getElementById('sectorFilter');
  Array.from(sectorsList).sort().forEach(sector => {
    let option = document.createElement('option');
    option.value = sector;
    option.textContent = sector;
    sectorFilter.appendChild(option);
  });
}

// Apply all filters and refresh dashboard views
function applyFilters() {
  const selectedStates = getSelectedValues('stateFilter');
  const selectedSectors = getSelectedValues('sectorFilter');
  const selectedPSU = getSelectedValues('psuFilter');
  const companySearchText = document.getElementById('companySearch').value.trim().toLowerCase();

  filteredData = csrData.filter(item => {
    let stateMatch = selectedStates.length === 0 || selectedStates.includes(item['State/UT']);
    let sectorMatch = selectedSectors.length === 0 || selectedSectors.includes(item['Development Sector']);
    let psuMatch = selectedPSU.length === 0 || selectedPSU.includes(item['PSU/Non-PSU']);
    let companyMatch = item['Company Name'] && item['Company Name'].toLowerCase().includes(companySearchText);

    return stateMatch && sectorMatch && psuMatch && companyMatch;
  });

  renderMetrics();
  updateMapColors();
  renderCompanyTable();
}

// Helper: get selected options from multiple select
function getSelectedValues(selectId) {
  const selectElem = document.getElementById(selectId);
  return Array.from(selectElem.selectedOptions).map(opt => opt.value);
}

// Render summary metrics
function renderMetrics() {
  const metricsDiv = document.getElementById('metrics');
  // Calculate totals
  const totalCompanies = new Set(filteredData.map(d => d['Company Name'])).size;
  const totalProjects = filteredData.length;
  const totalSpending = filteredData.reduce((sum, d) => {
    const amt = parseFloat(d['Spending (₹ Cr)'].replace(/,/g, '') || '0');
    return !isNaN(amt) ? sum + amt : sum;
  }, 0);

  metricsDiv.innerHTML = `
    <h2>Summary Metrics</h2>
    <p><strong>Total Companies:</strong> ${totalCompanies}</p>
    <p><strong>Total Projects:</strong> ${totalProjects}</p>
    <p><strong>Total CSR Spending:</strong> ₹${totalSpending.toFixed(2)} Cr</p>
  `;
}

// Update map colors based on filtered data CSR spend by state
function updateMapColors() {
  const svgObject = document.getElementById('svgMap');
  const svgDoc = svgObject.contentDocument;
  if (!svgDoc) return;

  // Aggregate spend by state
  const spendByState = {};
  filteredData.forEach(item => {
    const state = item['State/UT'];
    const amt = parseFloat(item['Spending (₹ Cr)'].replace(/,/g, '') || '0');
    if (!spendByState[state]) spendByState[state] = 0;
    if (!isNaN(amt)) spendByState[state] += amt;
  });

  // Define color scale for shading (simple)
  const maxSpend = Math.max(...Object.values(spendByState), 1);
  
  for (let state in spendByState) {
    const path = svgDoc.getElementById(state);
    if (path) {
      const intensity = Math.min(1, spendByState[state] / maxSpend);
      const color = `rgba(0, 123, 255, ${intensity})`; // blue shade growing with intensity
      path.style.fill = color;
      path.style.stroke = '#000';
      path.style.strokeWidth = '0.5';
      path.title = `${state}: ₹${spendByState[state].toFixed(2)} Cr`;
    }
  }
}

// Render company data table (paginated for performance)
function renderCompanyTable() {
  const tableDiv = document.getElementById('company-table');

  // Limit rows to 50 for performance
  const displayData = filteredData.slice(0, 50);

  let html = `<h2>Companies (Showing first 50 filtered)</h2>`;
  html += `<table border="1" cellspacing="0" cellpadding="5">
  <thead>
    <tr><th>Company Name</th><th>Total Spending (₹ Cr)</th><th>State/UT</th><th>Sector</th><th>PSU/Non-PSU</th></tr>
  </thead>
  <tbody>
  `;

  displayData.forEach(row => {
    const spending = parseFloat(row['Spending (₹ Cr)'].replace(/,/g, '') || '0').toFixed(2);
    html += `<tr>
      <td>${row['Company Name'] || ''}</td>
      <td>₹${spending}</td>
      <td>${row['State/UT'] || ''}</td>
      <td>${row['Development Sector'] || ''}</td>
      <td>${row['PSU/Non-PSU'] || ''}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  tableDiv.innerHTML = html;
}

// Setup event listeners for filters
function setupEventListeners() {
  ['stateFilter', 'sectorFilter', 'psuFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => applyFilters());
  });

  document.getElementById('companySearch').addEventListener('input', debounce(() => {
    applyFilters();
  }, 300));

  document.getElementById('clearFilters').addEventListener('click', () => {
    ['stateFilter', 'sectorFilter', 'psuFilter'].forEach(id => {
      const select = document.getElementById(id);
      Array.from(select.options).forEach(opt => opt.selected = false);
    });
    document.getElementById('companySearch').value = '';
    applyFilters();
  });

  // Export XLSX button
  document.getElementById('export-xlsx').addEventListener('click', () => {
    exportToXLSX(filteredData);
  });
}

// Helper - debounce function for input events
function debounce(fn, delay) {
  let timeoutID;
  return function(...args) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Export filtered data to XLSX file using SheetJS
function exportToXLSX(data) {
  if (!data.length) {
    alert('No data to export!');
    return;
  }

  // Format data for export with selected columns
  const exportData = data.map(row => ({
    'Company Name': row['Company Name'],
    'Spending (₹ Cr)': row['Spending (₹ Cr)'],
    'State/UT': row['State/UT'],
    'Development Sector': row['Development Sector'],
    'PSU/Non-PSU': row['PSU/Non-PSU']
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CSR Data');

  XLSX.writeFile(workbook, `csr-dashboard-export-${Date.now()}.xlsx`);
}
