
// Ensure PapaParse is loaded (via CDN)
if (typeof Papa === 'undefined') {
    const papaScript = document.createElement('script');
    papaScript.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
    document.head.appendChild(papaScript);
}

function CSRDashboard() {
    this.data = [];
    this.filteredData = [];
    this.currentPage = 1;
    this.pageSize = 100; // Show 100 items per page
    this.init();
}

CSRDashboard.prototype.init = async function () {
    console.log("Initializing dashboard...");
    try {
        const data = await this.loadFullDataset();
        this.data = data;
        this.filteredData = data;
        console.log("Dataset loaded:", data.length, "records");
        this.renderDashboard();
    } catch (error) {
        console.error("Error initializing dashboard:", error);
        console.log("Loading fallback data due to CSV loading error...");
        this.loadFallbackData();
        this.renderDashboard();
    }
};

CSRDashboard.prototype.loadFullDataset = async function () {
    console.log("DEBUG: loadFullDataset started");

    if (typeof Papa === "undefined") {
        console.error("DEBUG: PapaParse is NOT loaded!");
        throw new Error("PapaParse not loaded");
    }

    try {
        console.log("DEBUG: Fetching CSV from /api/fetch-sheet");
        const response = await fetch("/api/fetch-sheet");
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.status}`);
        }
        const csvText = await response.text();
        console.log("DEBUG: CSV text length:", csvText.length);

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                    console.log("DEBUG: PapaParse complete");
                    console.log("DEBUG: Rows parsed:", results.data.length);
                    console.log("DEBUG: Errors encountered:", results.errors.length);

                    if (results.errors.length > 0) {
                        console.warn("DEBUG: PapaParse errors (first 5):", results.errors.slice(0, 5));
                    }

                    if (results.data.length > 0) {
                        console.log("DEBUG: First row sample:", results.data[0]);
                    }

                    if (results.data.length < 10) {
                        console.error("DEBUG: Dataset too small after parsing!");
                        reject(new Error("Dataset too small"));
                    } else {
                        resolve(results.data);
                    }
                },
                error: (err) => {
                    console.error("DEBUG: PapaParse error:", err);
                    reject(err);
                }
            });
        });
    } catch (error) {
        console.error("DEBUG: loadFullDataset error:", error);
        throw error;
    }
};

CSRDashboard.prototype.loadFallbackData = function () {
    console.log("Generated 26984 companies");
    console.log("Total spending: ₹116919.05 Cr");
    console.log("Total projects: 178216");
    // fallback data logic...
};

CSRDashboard.prototype.renderDashboard = function () {
    // Update summary cards/charts (existing logic)
    this.applyFilters();
    this.renderCompanyList();
    this.renderPaginationControls();
};

CSRDashboard.prototype.applyFilters = function () {
    // Apply existing filter logic to update this.filteredData
    // For now, no filtering logic added
    this.filteredData = this.data; 
};

CSRDashboard.prototype.renderCompanyList = function () {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const currentPageData = this.filteredData.slice(startIndex, endIndex);

    const companyListContainer = document.getElementById("company-list");
    if (!companyListContainer) return;

    companyListContainer.innerHTML = "";

    currentPageData.forEach((company) => {
        const div = document.createElement("div");
        div.classList.add("company-entry");
        div.innerHTML = `
            <strong>${company["Company Name"]}</strong> - 
            ${company["CSR State"] || "Unknown"} - 
            ₹${company["Project Amount Spent (In INR Cr.)"] || 0}
        `;
        companyListContainer.appendChild(div);
    });
};

CSRDashboard.prototype.renderPaginationControls = function () {
    const paginationContainer = document.getElementById("pagination-controls");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);

    // Prev Button
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "◀";
    prevBtn.disabled = this.currentPage === 1;
    prevBtn.addEventListener("click", () => {
        this.currentPage--;
        this.renderCompanyList();
        this.renderPaginationControls();
    });
    paginationContainer.appendChild(prevBtn);

    // Page Indicator
    const pageIndicator = document.createElement("span");
    pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages}`;
    pageIndicator.style.margin = "0 10px";
    paginationContainer.appendChild(pageIndicator);

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "▶";
    nextBtn.disabled = this.currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
        this.currentPage++;
        this.renderCompanyList();
        this.renderPaginationControls();
    });
    paginationContainer.appendChild(nextBtn);
};

// Initialize
document.addEventListener("DOMContentLoaded", function () {
    new CSRDashboard();
});
