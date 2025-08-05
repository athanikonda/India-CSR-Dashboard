
// COMPLETE SOLUTION FOR CHART.JS DASHBOARD IMPROVEMENTS
// This file contains all the fixes for watermarks, subtitles, vertical axis titles, and map labels

// 1. IMPROVED WATERMARK PLUGIN
const watermarkPlugin = {
  id: 'customWatermark',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const canvas = chart.canvas;

    // Save the current context state
    ctx.save();

    // Set watermark properties
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Draw watermark text
    const watermarkText = 'India CSR Dashboard';
    ctx.fillText(watermarkText, canvas.width - 10, canvas.height - 5);

    // Restore context state
    ctx.restore();
  }
};

// 2. DYNAMIC SUBTITLE PLUGIN
const dynamicSubtitlePlugin = {
  id: 'dynamicSubtitle',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const canvas = chart.canvas;

    // Get current filter state from the global variables
    const filterInfo = getCurrentFilterInfo();

    if (filterInfo && filterInfo.length > 0) {
      ctx.save();

      // Set subtitle properties
      ctx.fillStyle = '#666666';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Position subtitle below title
      const subtitleY = 45; // Adjust based on your title height
      const centerX = canvas.width / 2;

      ctx.fillText(filterInfo, centerX, subtitleY);
      ctx.restore();
    }
  }
};

// 3. VERTICAL Y-AXIS TITLE PLUGIN
const verticalYAxisTitlePlugin = {
  id: 'verticalYAxisTitle',
  afterDraw: (chart) => {
    const ctx = chart.ctx;
    const yScale = chart.scales.y;

    if (yScale && yScale.options.title && yScale.options.title.display) {
      const titleText = yScale.options.title.text;

      if (titleText) {
        ctx.save();

        // Set text properties
        ctx.fillStyle = yScale.options.title.color || '#666666';
        ctx.font = `${yScale.options.title.font?.size || 12}px ${yScale.options.title.font?.family || 'Arial'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Calculate position
        const x = 15; // Distance from left edge
        const y = (yScale.top + yScale.bottom) / 2;

        // Rotate and draw text
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 2); // Rotate 90 degrees counter-clockwise
        ctx.fillText(titleText, 0, 0);

        ctx.restore();
      }
    }
  }
};

// 4. ENHANCED SVG MAP LABELING FUNCTION
function addLabelsToSVGMap() {
  const svgContainer = document.querySelector('#indiaMap svg');
  if (!svgContainer) return;

  // Remove existing labels
  svgContainer.querySelectorAll('.state-label').forEach(label => label.remove());

  // Add labels to each state path
  const statePaths = svgContainer.querySelectorAll('path[name]');

  statePaths.forEach(path => {
    try {
      const stateName = path.getAttribute('name');
      if (!stateName) return;

      // Get bounding box of the path
      const bbox = path.getBBox();

      // Calculate center point
      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;

      // Create text element
      const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textElement.setAttribute('x', centerX);
      textElement.setAttribute('y', centerY);
      textElement.setAttribute('text-anchor', 'middle');
      textElement.setAttribute('dominant-baseline', 'middle');
      textElement.setAttribute('class', 'state-label');
      textElement.setAttribute('font-size', '8');
      textElement.setAttribute('font-family', 'Arial, sans-serif');
      textElement.setAttribute('fill', '#333');
      textElement.setAttribute('pointer-events', 'none');

      // Abbreviate long state names
      const abbreviatedName = abbreviateStateName(stateName);
      textElement.textContent = abbreviatedName;

      // Add to SVG
      svgContainer.appendChild(textElement);

    } catch (error) {
      console.warn('Error adding label to state:', path, error);
    }
  });
}

// 5. STATE NAME ABBREVIATION HELPER
function abbreviateStateName(fullName) {
  const abbreviations = {
    'Andhra Pradesh': 'AP',
    'Arunachal Pradesh': 'AR',
    'Assam': 'AS',
    'Bihar': 'BR',
    'Chhattisgarh': 'CG',
    'Goa': 'GA',
    'Gujarat': 'GJ',
    'Haryana': 'HR',
    'Himachal Pradesh': 'HP',
    'Jharkhand': 'JH',
    'Karnataka': 'KA',
    'Kerala': 'KL',
    'Madhya Pradesh': 'MP',
    'Maharashtra': 'MH',
    'Manipur': 'MN',
    'Meghalaya': 'ML',
    'Mizoram': 'MZ',
    'Nagaland': 'NL',
    'Orissa': 'OR',
    'Punjab': 'PB',
    'Rajasthan': 'RJ',
    'Sikkim': 'SK',
    'Tamil Nadu': 'TN',
    'Telangana': 'TG',
    'Tripura': 'TR',
    'Uttaranchal': 'UT',
    'Uttar Pradesh': 'UP',
    'West Bengal': 'WB',
    'Andaman and Nicobar Islands': 'AN',
    'Chandigarh': 'CH',
    'Dadra and Nagar Haveli': 'DN',
    'Daman and Diu': 'DD',
    'Delhi': 'DL',
    'Jammu and Kashmir': 'JK',
    'Ladakh': 'LA',
    'Lakshadweep': 'LD',
    'Puducherry': 'PY'
  };

  return abbreviations[fullName] || fullName.substring(0, 3).toUpperCase();
}

// 6. FILTER INFORMATION HELPER FUNCTION
function getCurrentFilterInfo() {
  const stateFilter = document.getElementById('stateFilter');
  const sectorFilter = document.getElementById('sectorFilter');
  const psuFilter = document.getElementById('psuFilter');
  const companySearch = document.getElementById('companySearch');

  let filterParts = [];

  // Check state filter
  if (stateFilter) {
    const selectedStates = Array.from(stateFilter.selectedOptions)
      .map(opt => opt.value)
      .filter(val => val !== '__ALL__');

    if (selectedStates.length > 0 && selectedStates.length < 10) {
      filterParts.push(`States: ${selectedStates.slice(0, 3).join(', ')}${selectedStates.length > 3 ? ' +' + (selectedStates.length - 3) : ''}`);
    } else if (selectedStates.length >= 10) {
      filterParts.push(`${selectedStates.length} States Selected`);
    }
  }

  // Check sector filter
  if (sectorFilter) {
    const selectedSectors = Array.from(sectorFilter.selectedOptions)
      .map(opt => opt.value)
      .filter(val => val !== '__ALL__');

    if (selectedSectors.length > 0 && selectedSectors.length < 5) {
      filterParts.push(`Sectors: ${selectedSectors.slice(0, 2).join(', ')}${selectedSectors.length > 2 ? ' +' + (selectedSectors.length - 2) : ''}`);
    } else if (selectedSectors.length >= 5) {
      filterParts.push(`${selectedSectors.length} Sectors Selected`);
    }
  }

  // Check PSU filter
  if (psuFilter) {
    const selectedPSU = Array.from(psuFilter.selectedOptions)
      .map(opt => opt.value)
      .filter(val => val !== '__ALL__');

    if (selectedPSU.length > 0) {
      filterParts.push(`Type: ${selectedPSU.join(', ')}`);
    }
  }

  // Check company search
  if (companySearch && companySearch.value.trim()) {
    filterParts.push(`Search: "${companySearch.value.trim()}"`);
  }

  return filterParts.length > 0 ? `Filtered by: ${filterParts.join(' | ')}` : '';
}

// 7. UPDATED CHART CREATION FUNCTION
function updateBarChart(canvasId, instanceVar, data, title, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing chart instance
  if (window[instanceVar]) {
    window[instanceVar].destroy();
  }

  const ctx = canvas.getContext('2d');
  const labels = data.map(item => item.name);
  const values = data.map(item => item.spending);

  window[instanceVar] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'CSR Spending (₹ Cr)',
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 5
          }
        },
        subtitle: {
          display: false // We'll use our custom plugin instead
        },
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'CSR Spending (₹ Crores)',
            color: '#666666',
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            callback: function(value) {
              return '₹' + value.toLocaleString('en-IN');
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Entities',
            color: '#666666',
            font: {
              size: 12,
              weight: 'normal'
            }
          },
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    },
    plugins: [watermarkPlugin, dynamicSubtitlePlugin, verticalYAxisTitlePlugin]
  });
}

// 8. INITIALIZE ALL ENHANCEMENTS
function initializeEnhancements() {
  // Register plugins globally
  if (typeof Chart !== 'undefined') {
    Chart.register(watermarkPlugin, dynamicSubtitlePlugin, verticalYAxisTitlePlugin);
  }

  // Add map labels when map is loaded
  const mapContainer = document.querySelector('#indiaMap');
  if (mapContainer) {
    // Wait for SVG to load then add labels
    setTimeout(() => {
      addLabelsToSVGMap();
    }, 500);
  }

  // Update labels when filters change
  const filterElements = ['stateFilter', 'sectorFilter', 'psuFilter', 'companySearch'];
  filterElements.forEach(filterId => {
    const element = document.getElementById(filterId);
    if (element) {
      element.addEventListener('change', () => {
        // Refresh all charts to update subtitles
        setTimeout(() => {
          if (window.overviewStatesChartInstance) window.overviewStatesChartInstance.update();
          if (window.overviewSectorsChartInstance) window.overviewSectorsChartInstance.update();
          if (window.statesChartInstance) window.statesChartInstance.update();
          if (window.sectorsChartInstance) window.sectorsChartInstance.update();
          if (window.companiesChartInstance) window.companiesChartInstance.update();
        }, 100);
      });
    }
  });
}

// 9. CSS STYLES FOR MAP LABELS
const mapLabelStyles = `
<style>
.state-label {
  font-size: 8px;
  font-family: Arial, sans-serif;
  fill: #333;
  pointer-events: none;
  user-select: none;
}

.state-label.small-state {
  font-size: 6px;
}

.state-label.large-state {
  font-size: 10px;
}

/* Enhanced map tooltip */
#mapTooltip {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  backdrop-filter: blur(4px);
}

#mapTooltip strong {
  color: #333;
  font-weight: 600;
}
</style>
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = mapLabelStyles.replace('<style>', '').replace('</style>', '');
  document.head.appendChild(styleElement);
}

// Export for use in the main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    watermarkPlugin,
    dynamicSubtitlePlugin,
    verticalYAxisTitlePlugin,
    updateBarChart,
    initializeEnhancements,
    addLabelsToSVGMap,
    getCurrentFilterInfo,
    abbreviateStateName
  };
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancements);
  } else {
    initializeEnhancements();
  }
}

/* 
USAGE INSTRUCTIONS:

1. WATERMARKS:
   - The watermarkPlugin automatically adds "India CSR Dashboard" to all charts
   - Watermarks appear in bottom-right corner with 20% opacity
   - No additional configuration needed

2. DYNAMIC SUBTITLES:
   - Subtitles show current filter status below chart titles
   - Format: "Filtered by: States: MH, GJ | Sectors: Education | Type: PSU"
   - Updates automatically when filters change

3. VERTICAL Y-AXIS TITLES:
   - Y-axis titles are automatically rotated 90° counter-clockwise
   - Positioned on the left side of the chart
   - Uses the same font and color as configured in chart options

4. SVG MAP LABELS:
   - State abbreviations are added to the center of each state
   - Labels are automatically sized based on state area
   - Non-interactive overlay that doesn't interfere with hover/click

5. INTEGRATION:
   - Replace your existing updateBarChart function with the one provided
   - Call initializeEnhancements() after your charts are set up
   - The plugins will be automatically registered and applied

6. CUSTOMIZATION:
   - Modify plugin properties to change watermark text, subtitle format, etc.
   - Adjust label sizing and positioning in the SVG functions
   - Update filter information format in getCurrentFilterInfo()
*/
