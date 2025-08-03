let cache = null;
let cacheTimestamp = 0;

export default async function handler(req, res) {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv";
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  try {
    // Serve from cache if fresh
    if (cache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      console.log("Serving cached CSV data");
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/csv');
      return res.status(200).send(cache);
    }

    // Fetch fresh data from Google Sheets
    console.log("Fetching fresh CSV data from Google Sheets...");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Sheets fetch failed: ${response.status}`);
    }

    const data = await response.text();
    console.log(`Fetched data length: ${data.length}`);

    // Validate data (basic check)
    if (data.length < 100) {
      console.error("CSV data too small, possibly empty or invalid");
      throw new Error("CSV data too small");
    }

    // Cache the data
    cache = data;
    cacheTimestamp = Date.now();

    // Send response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).send(data);

  } catch (error) {
    console.error("Error fetching CSV:", error);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
}