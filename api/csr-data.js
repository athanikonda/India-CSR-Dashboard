// Vercel Serverless API - CSV Proxy
const axios = require('axios');

module.exports = async (req, res) => {
  const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRaDCGxkQyoqBF6_genJT1KztlWoeY8cNLMlIRSlSKSvRLidz_449ZFzbrO0sCQFf9HGiYdySFa8weC/pub?output=csv';
  try {
    const response = await axios.get(GOOGLE_SHEET_CSV_URL);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv');
    res.send(response.data);
  } catch {
    res.status(500).send('Failed to fetch CSV');
  }
};
