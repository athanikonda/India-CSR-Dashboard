const Papa = require("papaparse");

module.exports = async function (req, res) {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch CSV");
    const csvText = await response.text();
    const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    const { state, sector, psu, search, page = 1, pageSize = 100 } = req.query;
    let rows = results.data;

    rows = rows.filter((row) => {
      return (
        (!state || row["CSR State"] === state) &&
        (!sector || row["CSR Development Sector"] === sector) &&
        (!psu || row["PSU/Non-PSU"] === psu) &&
        (!search || row["Company Name"].toLowerCase().includes(search.toLowerCase()))
      );
    });

    const totals = {
      companies: new Set(rows.map((r) => r["Company Name"])).size,
      projects: rows.length,
      spending: rows.reduce((sum, r) => sum + parseFloat(r["Project Amount Spent (In INR Cr.)"] || 0), 0)
    };

    const charts = { byState: {}, bySector: {} };
    rows.forEach((row) => {
      const stateName = row["CSR State"] || "Unknown";
      const sectorName = row["CSR Development Sector"] || "Unknown";
      const amount = parseFloat(row["Project Amount Spent (In INR Cr.)"] || 0);
      charts.byState[stateName] = (charts.byState[stateName] || 0) + amount;
      charts.bySector[sectorName] = (charts.bySector[sectorName] || 0) + amount;
    });

    const startIndex = (page - 1) * pageSize;
    const paginatedData = rows.slice(startIndex, startIndex + parseInt(pageSize));

    res.status(200).json({
      totals,
      charts: {
        byState: Object.entries(charts.byState).map(([state, amount]) => ({ state, amount })),
        bySector: Object.entries(charts.bySector).map(([sector, amount]) => ({ sector, amount }))
      },
      data: paginatedData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
