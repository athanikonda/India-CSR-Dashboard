// Ensure PapaParse is loaded (via CDN)
if (typeof Papa === 'undefined') {
    const papaScript = document.createElement('script');
    papaScript.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
    document.head.appendChild(papaScript);
}

// CSRDashboard class (other existing methods remain unchanged)

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

// *** Updated loadFullDataset function ***
CSRDashboard.prototype.loadFullDataset = async function () {
    console.log("Loading CSV data using fetch + PapaParse...");

    try {
        // Fetch raw CSV text
        const response = await fetch("/api/fetch-sheet");
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.status}`);
        }
        const csvText = await response.text();
        console.log("Fetched CSV text length:", csvText.length);

        // Parse with PapaParse
        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                    console.log("PapaParse parsing complete.");
                    console.log("Rows parsed:", results.data.length);
                    console.log("Errors encountered:", results.errors.length);

                    if (results.errors.length > 0) {
                        console.warn("PapaParse errors:", results.errors.slice(0, 5));
                    }

                    if (results.data.length > 0) {
                        console.log("First row sample:", results.data[0]);
                    }

                    if (results.data.length < 10) {
                        reject(new Error("Dataset too small"));
                    } else {
                        resolve(results.data);
                    }
                },
                error: (err) => {
                    console.error("PapaParse error:", err);
                    reject(err);
                }
            });
        });
    } catch (error) {
        console.error("Error loading CSV data:", error);
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

// Other methods (filters, updateMap, renderDashboard, etc.) remain unchanged
// Ensure you still have updateMap, applyFilters, renderDashboard, etc. here

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", function () {
    new CSRDashboard();
});
