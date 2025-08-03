export default async function handler(req, res) {
  const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv";

  try {
    console.log("Fetching fresh CSV data from Google Sheets...");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Sheets fetch failed: ${response.status}`);
    }

    const data = await response.text();
    console.log(`Fetched data length: ${data.length}`);

    // Show a sample of the CSV content for debugging
    console.log("CSV sample (first 500 chars):", data.substring(0, 500));

    // Lower validation threshold for debugging
    if (data.length < 10) {
      console.error("CSV data too small, possibly empty or invalid");
      throw new Error("CSV data too small");
    }

    // Send response (no caching)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).send(data);

  } catch (error) {
    console.error("Error fetching CSV:", error);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
}
