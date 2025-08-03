// Ensure PapaParse is loaded (via CDN)
if (typeof Papa === 'undefined') {
    const papaScript = document.createElement('script');
    papaScript.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
    document.head.appendChild(papaScript);
}

// CSRDashboard class and methods
function CSRDashboard() {
    this.data = [];
    this.filteredData = [];
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

// *** Updated loadFullDataset function with detailed debugging ***
CSRDashboard.prototype.loadFullDataset = async function () {
    console.log("DEBUG: loadFullDataset started");

    if (typeof Papa === "undefined") {
        console.error("DEBUG: PapaParse is NOT loaded!");
        throw new Error("PapaParse not loaded");
    }

    try {
        // Fetch raw CSV text
        console.log("DEBUG: Fetching CSV from /api/fetch-sheet");
        const response = await fetch("/api/fetch-sheet");
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.status}`);
        }
        const csvText = await response.text();
        console.log("DEBUG: CSV text length:", csvText.length);

        // Parse with PapaParse
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
    // Your existing fallback data loader
    console.log("Generated 26984 companies");
    console.log("Total spending: ₹116919.05 Cr");
    console.log("Total projects: 178216");
    // existing fallback data logic...
};

CSRDashboard.prototype.renderDashboard = function () {
    // Your existing dashboard rendering logic
};

CSRDashboard.prototype.applyFilters = function () {
    // Your existing filter logic
};

CSRDashboard.prototype.updateMap = function () {
    // Your existing map logic
};

// Initialize dashboard
document.addEventListener("DOMContentLoaded", function () {
    new CSRDashboard();
});
