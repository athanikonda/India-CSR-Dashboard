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
  console.log("DEBUG: PapaParse complete");
  console.log("DEBUG: Rows parsed:", parsed.data.length);
  console.log("DEBUG: Errors encountered:", parsed.errors.length);
  console.log("DEBUG: First row sample:", parsed.data[0]);

  rawData = parsed.data;
  filteredData = [...rawData];

  console.log("Dataset loaded:", filteredData.length, "records");
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
  document.querySelectorAll(".loader-wrapper").forEach(el => {
    if (el) el.style.display = 'none';
  });

  const dashboard = document.getElementById("mainDashboard");
  if (dashboard) {
    dashboard.style.display = 'block';
    // ✅ Hide the spinner overlay
    // Fix: Use querySelector to support class-based overlay (or assign matching id in HTML)
    const overlay = document.querySelector('.loading-overlay'); // ← FIXED
    if (overlay) overlay.style.display = 'none';
  } else {
    console.warn("mainDashboard element not found in DOM.");
  }

  console.log("Dashboard display triggered");
  // Place your chart rendering logic here
}
