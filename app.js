// app.js (revised version)
// Last updated: Tue Aug 05, 2025

console.log("Initializing dashboard...");

const csvUrl = '/api/fetch-sheet';

let rawData = [];
let filteredData = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadFullDataset();
  initializeTabs();
  initializeFilters();
  updateDashboard();
});

async function loadFullDataset() {
  console.log("DEBUG: loadFullDataset started");

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
        rawData = parsed.data;
        filteredData = [...rawData];
        console.log("Dataset loaded:", filteredData.length, "records");
        resolve();
      },
      error: function (err) {
        console.error("PapaParse error:", err);
        reject(err);
      }
    });
  });
}
function initializeTabs() {
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(tc => tc.style.display = "none");
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.style.display = "block";
    });
  });

  if (tabs.length > 0) {
    tabs[0].click(); // Open the first tab by default
  }
}

function initializeFilters() {
  const stateSet = new Set();
  const sectorSet = new Set();
  const typeSet = new Set();

  rawData.forEach(row => {
    if (row['CSR State']) stateSet.add(row['CSR State'].trim());
    if (row['CSR Development Sector']) sectorSet.add(row['CSR Development Sector'].trim());
    if (row['PSU/Non-PSU']) typeSet.add(row['PSU/Non-PSU'].trim());
  });

  populateMultiSelect("stateFilter", [...stateSet].sort());
  populateMultiSelect("sectorFilter", [...sectorSet].sort());
  populateMultiSelect("psuFilter", [...typeSet].sort());
}

function populateMultiSelect(selectId, items) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '';
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.text = item;
    option.selected = true;
    select.appendChild(option);
  });
  // Fallback: If selectpicker exists, refresh it
  if (typeof $ !== "undefined" && $(select).selectpicker) {
    $(select).selectpicker('refresh');
  }
}

function updateDashboard() {
    document.querySelectorAll(".loader-wrapper, #loadingIndicator").forEach(el => {
        el.style.display = 'none';
    });

    const dashboard = document.getElementById("mainDashboard");
    if (dashboard) dashboard.style.display = "block";

    console.log("Dashboard display triggered");

    // Calculate stats
    const totalCompanies = new Set(filteredData.map(row => row["Company Name"])).size;
    const totalProjects = filteredData.length;
    const totalSpending = filteredData.reduce((sum, row) => sum + parseFloat(row["Project Amount Spent (In INR Cr.)"] || 0), 0);
    const avgPerProject = totalSpending / (totalProjects || 1);

    // Update top header stats
    document.getElementById("totalCompaniesHeader").textContent = totalCompanies.toLocaleString();
    document.getElementById("totalProjectsHeader").textContent = totalProjects.toLocaleString();
    document.getElementById("totalSpendingHeader").textContent = "₹" + totalSpending.toFixed(2);

    // Update overview metric cards
    document.getElementById("totalCompaniesMetric").textContent = totalCompanies.toLocaleString();
    document.getElementById("totalProjectsMetric").textContent = totalProjects.toLocaleString();
    document.getElementById("totalSpendingMetric").textContent = "₹" + totalSpending.toFixed(2);
    document.getElementById("avgPerProjectMetric").textContent = "₹" + avgPerProject.toFixed(2);

    console.log("Dashboard metrics updated");
}
