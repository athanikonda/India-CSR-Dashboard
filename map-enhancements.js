// ===== MAP ENHANCEMENT FUNCTIONS =====

// Function to add state labels and CSR values to the map
function addMapLabels(svg, stateData) {
  // Remove existing labels
  svg.selectAll('.state-label, .csr-value-label').remove();
  
  // Add state name labels
  svg.selectAll('.state-label')
    .data(stateData)
    .enter()
    .append('text')
    .attr('class', 'state-label')
    .attr('x', d => getStateCentroid(d.state).x)
    .attr('y', d => getStateCentroid(d.state).y - 8)
    .text(d => d.stateAbbr || d.state.substring(0, 3).toUpperCase())
    .style('font-size', '10px');
    
  // Add CSR spending labels (only for selected states or top spending states)
  const filteredData = stateData.filter(d => d.selected || d.csrSpending > 100); // Adjust threshold
  
  svg.selectAll('.csr-value-label')
    .data(filteredData)
    .enter()
    .append('text')
    .attr('class', 'csr-value-label')
    .attr('x', d => getStateCentroid(d.state).x)
    .attr('y', d => getStateCentroid(d.state).y + 8)
    .text(d => formatCurrency(d.csrSpending))
    .style('font-size', '9px');
}

// Function to get state centroid coordinates
function getStateCentroid(stateName) {
  // Map state names to their centroid coordinates
  const centroids = {
    'Maharashtra': {x: 300, y: 280},
    'Karnataka': {x: 280, y: 320},
    'Tamil Nadu': {x: 300, y: 360},
    'Gujarat': {x: 240, y: 240},
    'Rajasthan': {x: 220, y: 200},
    'Uttar Pradesh': {x: 280, y: 180},
    'Madhya Pradesh': {x: 260, y: 240},
    'West Bengal': {x: 360, y: 220},
    'Bihar': {x: 320, y: 180},
    'Andhra Pradesh': {x: 300, y: 340},
    'Telangana': {x: 290, y: 320},
    'Kerala': {x: 270, y: 380},
    'Odisha': {x: 340, y: 260},
    'Haryana': {x: 260, y: 160},
    'Punjab': {x: 240, y: 140},
    'Assam': {x: 400, y: 200},
    'Jharkhand': {x: 340, y: 210},
    'Chhattisgarh': {x: 320, y: 260},
    'Uttarakhand': {x: 270, y: 140},
    'Himachal Pradesh': {x: 250, y: 120},
    'Jammu and Kashmir': {x: 240, y: 100},
    'Delhi': {x: 260, y: 160},
    'Goa': {x: 260, y: 340},
    // Add more states as needed based on your map
  };
  return centroids[stateName] || {x: 0, y: 0};
}

// Function to update applied filters display
function updateAppliedFilters(filters) {
  const filtersList = document.getElementById('appliedFiltersList');
  if (!filtersList) return;
  
  const hasFilters = Object.values(filters).some(filter => 
    filter && (Array.isArray(filter) ? filter.length > 0 : true)
  );
  
  if (!hasFilters) {
    filtersList.innerHTML = '<li class="no-filters-text">No filters applied</li>';
    return;
  }
  
  let filtersHTML = '';
  
  // Year filter
  if (filters.year) {
    filtersHTML += `<li class="filter-tag">
      Year: ${filters.year}
      <button class="filter-tag-remove" onclick="removeFilter('year')" aria-label="Remove year filter">×</button>
    </li>`;
  }
  
  // State filter
  if (filters.states && filters.states.length > 0) {
    const stateText = filters.states.length > 3 
      ? `${filters.states.slice(0, 3).join(', ')} +${filters.states.length - 3} more`
      : filters.states.join(', ');
    filtersHTML += `<li class="filter-tag">
      States: ${stateText}
      <button class="filter-tag-remove" onclick="removeFilter('states')" aria-label="Remove states filter">×</button>
    </li>`;
  }
  
  // Add other filters as needed...
  
  filtersList.innerHTML = filtersHTML;
}

// Export functions
function exportMapAsSVG() {
  const mapElement = document.getElementById('indiaMap');
  if (!mapElement) {
    alert('No map found to export');
    return;
  }
  
  const svgElement = mapElement.querySelector('svg');
  if (!svgElement) {
    alert('No SVG map to export');
    return;
  }
  
  try {
    // Clone SVG and add proper namespaces
    const svgClone = svgElement.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    
    // Create blob and download
    const svgBlob = new Blob([svgClone.outerHTML], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `csr-spending-map-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting SVG:', error);
    alert('Failed to export SVG. Please try again.');
  }
}

function exportMapAsPNG() {
  const mapElement = document.getElementById('indiaMap');
  if (!mapElement) {
    alert('No map found to export');
    return;
  }
  
  const svgElement = mapElement.querySelector('svg');
  if (!svgElement) {
    alert('No SVG map to export');
    return;
  }
  
  try {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svgElement);
    
    // Set canvas size (higher resolution for better quality)
    const rect = svgElement.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    
    // Create image from SVG
    const img = new Image();
    img.onload = function() {
      ctx.fillStyle = 'white'; // White background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Download as PNG
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `csr-spending-map-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    
    img.onerror = function() {
      console.error('Failed to load SVG as image');
      alert('Failed to export PNG. Please try again.');
    };
    
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  } catch (error) {
    console.error('Error exporting PNG:', error);
    alert('Failed to export PNG. Please try again.');
  }
}

// Function to remove specific filters
function removeFilter(filterType) {
  // This function should integrate with your existing filter system
  // You'll need to implement this based on how your filters currently work
  console.log(`Removing filter: ${filterType}`);
  
  // Example implementation - adjust according to your filter structure:
  switch(filterType) {
    case 'year':
      // Reset year filter
      const yearSelect = document.getElementById('yearFilter');
      if (yearSelect) yearSelect.selectedIndex = 0;
      break;
    case 'states':
      // Reset states filter
      const stateSelect = document.getElementById('stateFilter');
      if (stateSelect) {
        for (let option of stateSelect.options) {
          option.selected = false;
        }
      }
      break;
    // Add more cases as needed
  }
  
  // Trigger your existing filter update function
  if (typeof applyFilters === 'function') {
    applyFilters();
  }
}

// Utility function to format currency (if not already available)
function formatCurrency(amount) {
  if (amount >= 10000000) {
    return '₹' + (amount / 10000000).toFixed(1) + 'Cr';
  } else if (amount >= 100000) {
    return '₹' + (amount / 100000).toFixed(1) + 'L';
  } else {
    return '₹' + amount.toLocaleString('en-IN');
  }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Map enhancements loaded');
  
  // Bind export button events
  const exportSvgBtn = document.getElementById('exportMapSvg');
  if (exportSvgBtn) {
    exportSvgBtn.addEventListener('click', exportMapAsSVG);
  }
  
  const exportPngBtn = document.getElementById('exportMapPng');
  if (exportPngBtn) {
    exportPngBtn.addEventListener('click', exportMapAsPNG);
  }
});

// Global functions that can be called from other scripts
window.addMapLabels = addMapLabels;
window.updateAppliedFilters = updateAppliedFilters;
window.exportMapAsSVG = exportMapAsSVG;
window.exportMapAsPNG = exportMapAsPNG;
window.removeFilter = removeFilter;
