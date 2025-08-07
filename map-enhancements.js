/*
 * Additional enhancements for the India CSR Spending map.
 *
 * This script is loaded after the main app.js and overrides
 * certain functions to inject a title, subtitle, watermark, filter
 * summary, and improved data labels into the map. It also adds
 * an export button to download the map as a PNG image. These
 * enhancements are isolated here to avoid modifying the original
 * dashboard logic, which may be read‑only.
 */

(function() {
  /**
   * Replace the default label renderer with a two‑line label showing
   * both the state/UT name and its aggregated CSR spending. This
   * function shadows the existing implementation on the global object.
   */
  function overrideLabelFunction() {
    // Guard against missing stateCoordinates or canonical helper
    const coordsMap = window.stateCoordinates || {};
    const canonical = window.canonicalStateName || function(n) { return n; };
    window.labelSelectedStatesWithValues = function(selectedStates, filteredData) {
      const svgContainer = document.getElementById('indiaMap');
      if (!svgContainer) return;
      const svg = svgContainer.querySelector('svg') || svgContainer;
      // Remove previous labels
      svg.querySelectorAll('.map-label').forEach(e => e.remove());
      // Sum spending per canonical state
      const stateTotals = {};
      filteredData.forEach(row => {
        const stateName = canonical(row['CSR State']);
        const amount = parseFloat(row['Project Amount Spent (In INR Cr.)'] || 0);
        stateTotals[stateName] = (stateTotals[stateName] || 0) + amount;
      });
      // Create a label for each selected state
      selectedStates.forEach(state => {
        const coords = coordsMap[state];
        const totalVal = stateTotals[state];
        if (!coords || totalVal === undefined) return;
        const valueStr = totalVal.toFixed(2);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', coords[0]);
        text.setAttribute('y', coords[1]);
        text.setAttribute('class', 'map-label');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#1f7a8c');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '0.5');
        // Name line
        const tspanName = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspanName.setAttribute('x', coords[0]);
        tspanName.setAttribute('dy', '0');
        tspanName.setAttribute('font-size', '12');
        tspanName.setAttribute('font-weight', 'bold');
        tspanName.textContent = state;
        text.appendChild(tspanName);
        // Value line
        const tspanValue = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspanValue.setAttribute('x', coords[0]);
        tspanValue.setAttribute('dy', '1.1em');
        tspanValue.setAttribute('font-size', '10');
        tspanValue.setAttribute('font-weight', 'normal');
        tspanValue.textContent = `₹${valueStr} Cr`;
        text.appendChild(tspanValue);
        svg.appendChild(text);
      });
    };
  }

  /**
   * Inject a new function to update the map header and filters summary.
   * This function reads the current filter selections via the existing
   * getSelectedFiltersSummary helper and updates the DOM accordingly.
   */
  function defineMapDetailsUpdater() {
    window.updateMapDetails = function() {
      const titleEl = document.getElementById('mapTitle');
      const subtitleEl = document.getElementById('mapSubtitle');
      const filtersEl = document.getElementById('mapFiltersApplied');
      if (titleEl) titleEl.textContent = 'India CSR Spending Map';
      const baseSubtitle = 'India CSR Spending Dashboard | FY 2023-24';
      if (subtitleEl) subtitleEl.textContent = baseSubtitle;
      const summary = typeof window.getSelectedFiltersSummary === 'function' ? window.getSelectedFiltersSummary() : '';
      if (filtersEl) {
        filtersEl.textContent = summary ? `Filters: ${summary}` : 'Filters: All';
      }
    };
  }

  /**
   * Extend the existing updateDashboard function so that it also
   * refreshes the map header after performing its original duties.
   */
  function hookIntoUpdateDashboard() {
    if (typeof window.updateDashboard !== 'function') return;
    const original = window.updateDashboard;
    window.updateDashboard = function() {
      original.apply(this, arguments);
      if (typeof window.updateMapDetails === 'function') {
        window.updateMapDetails();
      }
    };
  }

  /**
   * Export the currently displayed SVG map as a PNG file. This
   * implementation serializes the SVG to a Blob, renders it on
   * a temporary canvas, and triggers a download. Only the vector
   * portion (including any labels) is exported.
   */
  function defineExportMap() {
    window.exportMap = function() {
      const svgContainer = document.getElementById('indiaMap');
      if (!svgContainer) return;
      const svgElement = svgContainer.querySelector('svg');
      if (!svgElement) return;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      // Create a canvas sized to the SVG's viewBox or bounding box
      const bbox = svgElement.getBBox();
      const canvas = document.createElement('canvas');
      canvas.width = bbox.width;
      canvas.height = bbox.height;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = function() {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const pngData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngData;
        link.download = 'india_csr_map.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      img.src = url;
    };
  }

  /**
   * Create and insert the map header, subtitle, export button,
   * filters summary container and watermark into the existing
   * DOM structure. This function is idempotent and will only
   * create elements if they are not already present.
   */
  function buildMapUI() {
    const mapTab = document.getElementById('map');
    if (!mapTab) return;
    const mapSection = mapTab.querySelector('.map-section');
    if (!mapSection) return;
    // If header already exists, do nothing
    if (document.getElementById('mapTitle')) return;
    // Fetch some CSS variables for colours
    const rootStyles = getComputedStyle(document.documentElement);
    const textColor = rootStyles.getPropertyValue('--color-text').trim() || '#13343b';
    const secondaryColor = rootStyles.getPropertyValue('--color-text-secondary').trim() || '#52606d';
    const primaryColor = rootStyles.getPropertyValue('--color-primary').trim() || '#1f7a8c';
    const bg5Color = rootStyles.getPropertyValue('--color-bg-5').trim() || 'rgba(236, 72, 153, 0.08)';
    const btnPrimaryText = rootStyles.getPropertyValue('--color-btn-primary-text').trim() || '#ffffff';

    // Construct header container
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'flex-start';
    header.style.marginBottom = '16px';

    // Left side: title and subtitle
    const headingDiv = document.createElement('div');
    // Title
    const title = document.createElement('h3');
    title.id = 'mapTitle';
    title.textContent = 'India CSR Spending Map';
    title.style.margin = '0';
    title.style.fontSize = '20px';
    title.style.fontWeight = '600';
    title.style.color = textColor;
    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.id = 'mapSubtitle';
    subtitle.textContent = 'India CSR Spending Dashboard | FY 2023-24';
    subtitle.style.margin = '4px 0 0 0';
    subtitle.style.fontSize = '12px';
    subtitle.style.color = secondaryColor;
    headingDiv.appendChild(title);
    headingDiv.appendChild(subtitle);
    header.appendChild(headingDiv);

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportMap';
    // Apply similar styling as chart download button
    exportBtn.style.background = bg5Color;
    exportBtn.style.color = primaryColor;
    exportBtn.style.border = `1px solid ${primaryColor}`;
    exportBtn.style.padding = '6px 12px';
    exportBtn.style.borderRadius = '8px';
    exportBtn.style.fontSize = '12px';
    exportBtn.style.fontWeight = '500';
    exportBtn.style.cursor = 'pointer';
    exportBtn.style.display = 'inline-flex';
    exportBtn.style.alignItems = 'center';
    exportBtn.style.gap = '4px';
    exportBtn.textContent = '📥 Download PNG';
    // Add hover effect using inline event listeners
    exportBtn.addEventListener('mouseover', () => {
      exportBtn.style.background = primaryColor;
      exportBtn.style.color = btnPrimaryText;
    });
    exportBtn.addEventListener('mouseout', () => {
      exportBtn.style.background = bg5Color;
      exportBtn.style.color = primaryColor;
    });
    header.appendChild(exportBtn);

    // Insert header at the beginning of mapSection
    mapSection.insertBefore(header, mapSection.firstChild);

    // Map container watermark
    const mapContainer = mapSection.querySelector('.map-container');
    if (mapContainer) {
      // Avoid duplicating watermark
      if (!mapContainer.querySelector('.map-enhancement-watermark')) {
        const watermark = document.createElement('div');
        watermark.className = 'map-enhancement-watermark';
        watermark.textContent = 'Prepared by Ashok Thanikonda';
        watermark.style.position = 'absolute';
        watermark.style.bottom = '8px';
        watermark.style.right = '8px';
        watermark.style.fontSize = '10px';
        watermark.style.color = secondaryColor;
        watermark.style.opacity = '0.5';
        watermark.style.pointerEvents = 'none';
        mapContainer.appendChild(watermark);
      }
    }

    // Filters summary container
    if (!document.getElementById('mapFiltersApplied')) {
      const filtersDiv = document.createElement('div');
      filtersDiv.id = 'mapFiltersApplied';
      filtersDiv.style.marginTop = '8px';
      filtersDiv.style.fontSize = '12px';
      filtersDiv.style.color = secondaryColor;
      mapSection.appendChild(filtersDiv);
    }
  }

  /**
   * Attach event listeners for the map export button and filter inputs.
   * These listeners call updateMapDetails so that the filters summary
   * stays in sync when selections change.
   */
  function attachEventListeners() {
    const exportBtn = document.getElementById('exportMap');
    if (exportBtn) {
      exportBtn.addEventListener('click', function(evt) {
        evt.preventDefault();
        if (typeof window.exportMap === 'function') window.exportMap();
      });
    }
    const filterIds = ['stateFilter', 'sectorFilter', 'psuFilter', 'companySearch'];
    filterIds.forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      const eventName = id === 'companySearch' ? 'input' : 'change';
      element.addEventListener(eventName, () => {
        if (typeof window.updateMapDetails === 'function') window.updateMapDetails();
      });
    });
  }

  // Execute all overrides and initial setup once the DOM is ready
  function init() {
    overrideLabelFunction();
    defineMapDetailsUpdater();
    hookIntoUpdateDashboard();
    defineExportMap();
    // Build the additional UI elements on the map tab (header, filters and watermark)
    buildMapUI();
    attachEventListeners();
    // Attempt an initial update shortly after load. Delay ensures that
    // filters and dataset have been initialised by the main script.
    setTimeout(() => {
      if (typeof window.updateMapDetails === 'function') window.updateMapDetails();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();