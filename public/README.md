# India CSR Dashboard (Frontend)

This is the frontend for the India CSR Dashboard. It loads CSR data through the backend `/api/csr-data`, enables filtering by states/sectors/organization type, colors the India SVG map, and enables export of filtered data.

**How it works:**
- Data is fetched live from Google Sheets via the backend API route at `/api/csr-data`.
- No CORS or client security issues.
- Dashboard is 100% static and safe to deploy to Vercel as the root `public/` folder.

**Deployment:**
- Use Vercel or your preferred static host. All features work with the backend API deployed alongside.

**SVG Map:**
- Ensure each `<path>` in `india-states.svg` has an `id` equal to the state name used in the CSR data's "State/UT" column.
