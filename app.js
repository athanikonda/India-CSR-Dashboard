
function CSRDashboard() {
  this.currentPage = 1;
  this.pageSize = 100;
  this.filters = { state: "", sector: "", psu: "", search: "" };
  this.init();
}

CSRDashboard.prototype.init = async function () {
  console.log("Initializing dashboard...");
  await this.loadData();
  this.attachFilterListeners();
};

CSRDashboard.prototype.attachFilterListeners = function() {
  document.getElementById("filter-reset").addEventListener("click", () => {
    this.filters = { state: "", sector: "", psu: "", search: "" };
    this.currentPage = 1;
    this.loadData();
  });
  document.getElementById("filter-state").addEventListener("change", (e) => {
    this.filters.state = e.target.value; this.currentPage = 1; this.loadData();
  });
  document.getElementById("filter-sector").addEventListener("change", (e) => {
    this.filters.sector = e.target.value; this.currentPage = 1; this.loadData();
  });
  document.getElementById("filter-psu").addEventListener("change", (e) => {
    this.filters.psu = e.target.value; this.currentPage = 1; this.loadData();
  });
  document.getElementById("filter-search").addEventListener("input", (e) => {
    this.filters.search = e.target.value; this.currentPage = 1; this.loadData();
  });
};

CSRDashboard.prototype.loadData = async function () {
  const params = new URLSearchParams({
    ...this.filters,
    page: this.currentPage,
    pageSize: this.pageSize
  }).toString();

  const response = await fetch(`/api/fetch-sheet?${params}`);
  if (!response.ok) {
    console.error("Failed to fetch data");
    return;
  }

  const json = await response.json();
  console.log("Data loaded:", json);

  this.renderCompanyList(json.data);
  this.renderPagination(json.totalPages);
  this.renderTotals(json.totals);
  this.renderCharts(json.charts);
};

CSRDashboard.prototype.renderCompanyList = function (rows) {
  const container = document.getElementById("company-list");
  container.innerHTML = "";

  rows.forEach((row) => {
    const div = document.createElement("div");
    div.classList.add("company-entry");
    div.innerHTML = `<strong>${row["Company Name"]}</strong> - ${row["CSR State"]} - ₹${row["Project Amount Spent (In INR Cr.)"] || 0}`;
    container.appendChild(div);
  });
};

CSRDashboard.prototype.renderPagination = function (totalPages) {
  const container = document.getElementById("pagination-controls");
  container.innerHTML = "";

  const prev = document.createElement("button");
  prev.textContent = "◀";
  prev.disabled = this.currentPage === 1;
  prev.addEventListener("click", () => {
    this.currentPage--;
    this.loadData();
  });

  const next = document.createElement("button");
  next.textContent = "▶";
  next.disabled = this.currentPage === totalPages;
  next.addEventListener("click", () => {
    this.currentPage++;
    this.loadData();
  });

  const span = document.createElement("span");
  span.textContent = `Page ${this.currentPage} of ${totalPages}`;
  span.style.margin = "0 10px";

  container.appendChild(prev);
  container.appendChild(span);
  container.appendChild(next);
};

CSRDashboard.prototype.renderTotals = function (totals) {
  document.getElementById("total-companies").textContent = totals.companies;
  document.getElementById("total-projects").textContent = totals.projects;
  document.getElementById("total-spending").textContent = `₹${totals.spending.toFixed(2)} Cr`;
};

CSRDashboard.prototype.renderCharts = function (charts) {
  // State chart
  const ctxState = document.getElementById("chart-by-state").getContext("2d");
  new Chart(ctxState, {
    type: "bar",
    data: {
      labels: charts.byState.map((d) => d.state),
      datasets: [{ label: "CSR Spending (Cr)", data: charts.byState.map((d) => d.amount) }]
    }
  });

  // Sector chart
  const ctxSector = document.getElementById("chart-by-sector").getContext("2d");
  new Chart(ctxSector, {
    type: "bar",
    data: {
      labels: charts.bySector.map((d) => d.sector),
      datasets: [{ label: "CSR Spending (Cr)", data: charts.bySector.map((d) => d.amount) }]
    }
  });
};

document.addEventListener("DOMContentLoaded", function () {
  new CSRDashboard();
});
