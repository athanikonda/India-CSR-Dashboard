const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv";

let rawData = [];
let filteredData = [];

document.addEventListener("DOMContentLoaded", () => {
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        complete: function(parsed) {
            console.log("DEBUG: PapaParse complete");
            console.log("DEBUG: Rows parsed:", parsed.data.length);
            console.log("DEBUG: Errors encountered:", parsed.errors.length);
            console.log("DEBUG: First row sample:", parsed.data[0]);

            rawData = parsed.data;
            filteredData = [...rawData];

            initializeFilters();
            renderSummaryCards();
            renderCharts();
            renderTable(1);
            updateDashboard();
        }
    });

    setupTabs();
    setupFilterListeners();
});

function initializeFilters() {
    // Filter population logic
    // This is a stub — restore your logic here as needed
}

function renderSummaryCards() {
    // If you had metric cards (e.g., sectors, PSUs), restore chart logic here
}

function renderCharts() {
    // Render pie charts, bar charts, or others here
}

function renderTable(page) {
    // Table rendering logic for pagination
}

function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            tabButtons.forEach((b) => b.classList.remove("active"));
            tabContents.forEach((c) => c.style.display = "none");

            btn.classList.add("active");
            const target = btn.getAttribute("data-tab");
            document.getElementById(target).style.display = "block";
        });
    });

    // Trigger first tab by default
    if (tabButtons.length > 0) tabButtons[0].click();
}

function setupFilterListeners() {
    // Wire up dropdowns/filters — restore this section as needed
}

function updateDashboard() {
    document.querySelectorAll(".loader-wrapper, #loadingIndicator").forEach(el => {
        el.style.display = 'none';
    });

    const dashboard = document.getElementById("mainDashboard");
    if (dashboard) dashboard.style.display = "block";

    // Stats
    const totalCompanies = new Set(filteredData.map(row => row["Company Name"])).size;
    const totalProjects = filteredData.length;
    const totalSpending = filteredData.reduce((sum, row) => {
        const val = parseFloat(row["Project Amount Spent (In INR Cr.)"]);
        return isNaN(val) ? sum : sum + val;
    }, 0);
    const avgPerProject = totalSpending / (totalProjects || 1);

    const updateText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    updateText("totalCompaniesHeader", totalCompanies.toLocaleString());
    updateText("totalProjectsHeader", totalProjects.toLocaleString());
    updateText("totalSpendingHeader", "₹" + totalSpending.toFixed(2));
    updateText("totalCompaniesMetric", totalCompanies.toLocaleString());
    updateText("totalProjectsMetric", totalProjects.toLocaleString());
    updateText("totalSpendingMetric", "₹" + totalSpending.toFixed(2));
    updateText("avgPerProjectMetric", "₹" + avgPerProject.toFixed(2));

    console.log("Dashboard metrics updated");
}
