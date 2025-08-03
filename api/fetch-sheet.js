import Papa from "papaparse";

export default async function handler(req, res) {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv";

  try {
    const { state, sector, psu, search, page = 1, pageSize = 100 } = req.query;

    // Fetch CSV
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch CSV");
    const csvText = await response.text();

    // Parse CSV
    const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    let rows = results.data;

    // Apply filters dynamically
    rows = rows.filter((row) => {
      return (
        (!state || row["CSR State"] === state) &&
        (!sector || row["CSR Development Sector"] === sector) &&
        (!psu || row["PSU/Non-PSU"] === psu) &&
        (!search || row["Company Name"].toLowerCase().includes(search.toLowerCase()))
      );
    });

    // Calculate totals
    const totals = {
      companies: new Set(rows.map((r) => r["Company Name"])).size,
      projects: rows.length,
      spending: rows.reduce((sum, r) => sum + parseFloat(r["Project Amount Spent (In INR Cr.)"] || 0), 0)
    };

    // Calculate charts
    const charts = {
      byState: {},
      bySector: {}
    };

    rows.forEach((row) => {
      const stateName = row["CSR State"] || "Unknown";
      const sectorName = row["CSR Development Sector"] || "Unknown";
      const amount = parseFloat(row["Project Amount Spent (In INR Cr.)"] || 0);

      charts.byState[stateName] = (charts.byState[stateName] || 0) + amount;
      charts.bySector[sectorName] = (charts.bySector[sectorName] || 0) + amount;
    });

    // Pagination
    const startIndex = (page - 1) * pageSize;
    const paginatedData = rows.slice(startIndex, startIndex + parseInt(pageSize));

    // Return JSON
    res.status(200).json({
      totals,
      charts: {
        byState: Object.entries(charts.byState).map(([state, amount]) => ({ state, amount })),
        bySector: Object.entries(charts.bySector).map(([sector, amount]) => ({ sector, amount }))
      },
      data: paginatedData,
      totalPages: Math.ceil(rows.length / pageSize)
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Failed to process request", details: error.message });
  }
}
