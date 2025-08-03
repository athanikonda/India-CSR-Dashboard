# India CSR Dashboard Frontend

## Overview

This is the frontend for the India CSR Dashboard. It loads live CSR data via a backend proxy, enables filtering, displays metrics, colors the Indian states map accordingly, and allows XLSX export of filtered data.

## Setup

- Edit `app.js` and replace the fetch URL `/csr-data` with your backend proxy URL if different.

## Files

- `index.html` — Dashboard HTML page
- `app.js` — Main JavaScript logic and data handling
- `style.css` — Styling for the dashboard
- `india-states.svg` — SVG map of Indian states. Make sure this SVG IDs match your data states exactly.

## Deployment

Deploy these frontend files to any static hosting platform (e.g., Vercel, Netlify). Remember to keep backend proxy URL accessible from your frontend.

## Notes

- The backend proxy serves the Google Sheets CSV with CORS headers.
- Make sure your backend proxy server is running and reachable by the frontend to avoid CORS issues.
