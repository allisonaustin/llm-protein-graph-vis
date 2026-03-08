var isMinimized = false;
var chartWidth = 130;
var chartHeight = 130;
var currentTab = "";

function createProteinTab(seedProtein) {
    const tabsContainer = document.getElementById('protein-tabs');
    const contentContainer = document.getElementById('protein-tab-content');

    contentContainer.style.display = 'block';
    
    const tabId = `tab-${seedProtein.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    const existingTab = document.getElementById(`${tabId}-tab`);
    if (existingTab) {
        existingTab.click(); 
        return document.getElementById(`${tabId}-content`);
    }

    document.querySelectorAll('#protein-tabs .nav-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#protein-tab-content .tab-pane').forEach(p => p.classList.remove('show', 'active'));

    const tabBtn = document.createElement('button');
    tabBtn.className = "nav-link active small py-1 px-2"; 
    tabBtn.id = `${tabId}-tab`;
    tabBtn.setAttribute('data-bs-toggle', 'tab');
    tabBtn.setAttribute('data-bs-target', `#${tabId}`);
    tabBtn.setAttribute('type', 'button');
    tabBtn.setAttribute('onclick', `activateTab('${tabId}')`);
    tabBtn.role = 'tab';
    tabBtn.style.fontSize = "0.8rem";
    tabBtn.innerHTML = `${seedProtein} <span class="ms-2" onclick="event.stopPropagation(); closeTab('${tabId}')">×</span>`;

    const tabPane = document.createElement('div');
    tabPane.className = "tab-pane fade show active"; 
    tabPane.id = tabId;
    tabPane.role = 'tabpanel';
    tabPane.innerHTML = `
      <div class="d-flex justify-content-between align-items-center p-2" style="background: rgba(255,255,255,0.03); border-bottom: 1px solid #333;">
          <span style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Grid View</span>
          <button class="btn btn-outline-secondary btn-sm" 
                  onclick="exportTabToGrid('${seedProtein}')" 
                  title="Expand to Grid View"
                  style="width: 26px; height: 26px; padding: 0; border-radius: 4px; display: flex; align-items: center; justify-content: center; border-color: #555;">
              <i class="bi bi-grid-3x3-gap" style="font-size: 0.8rem; color: #00a2ff;"></i>
          </button>
      </div>
      <div id="${tabId}-content" style="padding: 10px;"></div>`;

    tabsContainer.appendChild(tabBtn);
    contentContainer.appendChild(tabPane);

    activateTab(tabId);
    return document.getElementById(`${tabId}-content`);
}

window.activateTab = function(tabId) {
  currentTab = tabId;
  // console.log("Switching to tab:", tabId); 

  const allButtons = document.querySelectorAll('#protein-tabs .nav-link');
  allButtons.forEach(btn => btn.classList.remove('active'));

  const allPanes = document.querySelectorAll('#protein-tab-content .tab-pane');
  allPanes.forEach(pane => {
    pane.classList.remove('active');
    pane.classList.remove('show');
  });

  const targetBtn = document.getElementById(`${tabId}-tab`);
  const targetPane = document.getElementById(tabId);

  if (targetBtn && targetPane) {
    targetBtn.classList.add('active');
    targetPane.classList.add('show');
    targetPane.classList.add('active');
  }
};

window.closeTab = function(tabId) {
    const btn = document.getElementById(`${tabId}-tab`);
    const pane = document.getElementById(tabId);
    if (btn) btn.remove();
    if (pane) pane.remove();
    
    const remaining = document.querySelectorAll('#protein-tabs .nav-link');
    if (remaining.length > 0) {
        remaining[remaining.length - 1].click();
    }
};

async function getPDBIdFromGene(fullEnspId) {
  try {
    const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${fullEnspId}&format=json&fields=gene_names,organism_name,organism_id,xref_pdb`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) return [];

    const entry = data.results[0]; 
    const structures = [];
    const commonName = entry.organism.commonName || entry.organism.scientificName;
    const geneName = entry.genes[0].geneName.value ? entry.genes[0].geneName.value.toUpperCase() : "";

    if (entry.uniProtKBCrossReferences) {
      entry.uniProtKBCrossReferences
        .filter(ref => ref.database === 'PDB')
        .forEach(ref => {
          structures.push({
            pdbId: ref.id,
            geneName: geneName,
            organism: commonName,
            isAlphaFold: false
          });
        });
    }
    if (structures.length === 0) {
      structures.push({
        pdbId: entry.primaryAccession, 
        geneName: geneName,
        organism: `${commonName} (AlphaFold)`,
        isAlphaFold: true
      });
    }
    return structures;
  } catch (err) {
    console.error("Structure lookup failed:", err);
    return [];
  }
}

function createProteinModal(nodeId) {    
    const cleanId = nodeId.includes('.') ? nodeId.split('.')[1] : nodeId;

    getPDBIdFromGene(nodeId).then(structures => {
      if (!structures || !structures.length) {
        alert(`No 3D structures found for ${cleanId}`);
        focusNode = null;
        return;
      }
      
      // Remove existing modal if it already exists
      closeProteinModal(nodeId);

      let currIdx = 0;

      const modal = document.createElement("div");
      modal.className = "draggable resizable protein-modal";
      modal.id = `protein-modal-${nodeId.replace(/\./g, '_')}`;
      modal.style.cssText = `
        position: fixed; top: 120px; left: 80px; width: 350px; height: 400px;
        background: #1a1a1a; border: 1px solid #444; z-index: 1000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6); overflow: hidden; border-radius: 12px;
      `;

      const header = document.createElement("div");
      header.className = "modal-header";
      header.style.cssText = `
        background: #222; color: white; padding: 12px; cursor: move;
        display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid #333;
      `;

      const title = document.createElement("span");
      title.style.cssText = `font-size: 13px; font-weight: bold; margin-bottom: 6px; color: ${FOCUS_COLOR};`;
      header.appendChild(title);

      const nav = document.createElement("div");
      nav.innerHTML = `
        <button class="nav-btn" id="prevPDB" style="background:none; border:none; color:white; cursor:pointer; font-size:16px;">⟨</button>
        <span id="pdb-counter" style="font-size: 11px; color: #888; margin: 0 10px;"></span>
        <button class="nav-btn" id="nextPDB" style="background:none; border:none; color:white; cursor:pointer; font-size:16px;">⟩</button>
      `;
      header.appendChild(nav);

      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = "&times;";
      closeBtn.style.cssText = `
        position: absolute; top: 8px; right: 12px; background: none; border: none;
        font-size: 22px; color: #666; cursor: pointer; line-height: 1;
      `;

      const frame = document.createElement("iframe");
      frame.setAttribute("allow", "xr-spatial-tracking"); 
      frame.style.cssText = `width: 100%; height: calc(100% - 80px); border: none; background: #000;`;

      modal.appendChild(header);
      modal.appendChild(closeBtn);
      modal.appendChild(frame);
      document.body.appendChild(modal);

      function showStructure(index) {
        const struct = structures[index];
        // Determine if we use PDB or AlphaFold
        const queryParam = struct.isAlphaFold ? `afdb=${struct.pdbId}` : `pdb=${struct.pdbId}`;
        
        frame.src = `https://molstar.org/viewer/?${queryParam}&hide-controls=1&collapse-left-panel=1`;
        title.textContent = struct.isAlphaFold ? `${nodeId} [${struct.geneName}] (AlphaFold)` : `${nodeId} [${struct.geneName}]`;
        nav.querySelector("#pdb-counter").textContent = `${index + 1} / ${structures.length}`;
      }

      nav.querySelector("#prevPDB").onclick = () => { if (currIdx > 0) showStructure(--currIdx); };
      nav.querySelector("#nextPDB").onclick = () => { if (currIdx < structures.length - 1) showStructure(++currIdx); };

      showStructure(currIdx);

      // Make draggable
      interact(modal).draggable({
        allowFrom: '.modal-header',
        listeners: {
          move(event) {
              const target = event.target;
              const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
              const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
              target.style.transform = `translate(${x}px, ${y}px)`;
              target.setAttribute('data-x', x);
              target.setAttribute('data-y', y);
          }
        }
      });
      closeBtn.onclick = () => {
        closeProteinModal(nodeId, modal);
      }
    });
}

function closeProteinModal(fullId, modal) {
    if (modal) {
      modal.remove();
      focusNodes.delete(fullId);
      focusNode = null;
      updateHighlight(); 
    }
}

document.getElementById('menu-show-3d').onclick = function() {
    if (focusNode) {
      focusNodes.add(focusNode);
      createProteinModal(focusNode);
      updateHighlight();
      document.getElementById('context-menu').style.display = 'none';
      focusNode = null; // reset focus node
    }
};

  function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';

    document.addEventListener('click', () => {
      menu.style.display = 'none';
    }, { once: true });
  }

function updateClusterList(nodeClusterMap) {
  const container = d3.select("#cluster-list");
  if (!container) return;
  container.selectAll("*").remove(); 

  const colorCounts = {};
  Object.values(nodeClusterMap).forEach(color => {
      colorCounts[color] = (colorCounts[color] || 0) + 1;
  });

  const uniqueColors = Object.keys(colorCounts);

  const clusterDivs = container.selectAll(".cluster-item")
    .data(uniqueColors)
    .join("div")
    .attr("class", "cluster-item")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "8px")
    .style("padding", "2px 4px")
    .style("cursor", "pointer")
    .on("click", (event, color) => {
        if (typeof searchAndFocusCluster === "function") {
          searchAndFocusCluster(color);
          const table = $('#data-table').DataTable();
  
          $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
              const rowData = table.row(dataIndex).data();
              const node = Graph.graphData().nodes.find(n => n.id === rowData[1]);
              return node && node.clusterColor === color;
            }
          );
          table.draw();
          $.fn.dataTable.ext.search.pop();
        }
    });

  clusterDivs.append("div")
    .style("width", "12px")
    .style("height", "12px")
    .style("margin-right", "8px")
    .style("background-color", d => d)
    .style("border-radius", "50%")
    .style("opacity", "0.5")
    .style("border", "1px solid rgba(255,255,255,0.2)");

  clusterDivs.append("span")
    .text((d, i) => `Cluster ${i + 1} (${colorCounts[d]})`)
    .style("font-size", "12px")
}

function formatGOLink(text) {
  if (!text || text === "None" || text.includes("No shared")) return "None";
  
  const goMatch = text.match(/GO:\d+/);
  if (goMatch) {
    const goId = goMatch[0];
    const url = `http://amigo.geneontology.org/amigo/term/${goId}`;
    return text.replace(goId, `<a href="${url}" target="_blank" style="color: #888; text-decoration: underline; font-weight: normal;">${goId}</a>`);
  }
  return text;
}

function renderChatResponse(fullText, sourceNodeId, predictedNodes, predictedLinks, containerPanel) {
  const container = containerPanel;

  predictedNodes.forEach(node => {
    const targetId = node.id;
    const uniqueSuffix = `${sourceNodeId}-${targetId}`.replace(/[^a-zA-Z0-9]/g, '-');
    const rowId = `row-${uniqueSuffix}`;

    if (document.getElementById(rowId)) {
        console.log(`Skipping duplicate: ${targetId} already rendered for ${sourceNodeId}`);
        return; 
    }

    const link = predictedLinks.find(l => l.target === node.id || l.source === node.id);
    if (!link) return;

    // Try to find a reasoning in the raw text
    let relevantLines = fullText.split('\n').filter(line => {
        return new RegExp(`\\b${targetId}\\b`, 'i').test(line);
    }).join('\n');

    // Remove leading "1. ", or "- "
    relevantLines = relevantLines.replace(/^\s*(\d+\.|-)\s+/gm, '');

    const row = document.createElement('div');
    row.id = `row-${uniqueSuffix}`;
    row.className = `protein-row-container`;
    row.style = "display: flex; flex-direction:column; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #333;";

    const chartSection = document.createElement('div');
    chartSection.style = "display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%;";

    // Text (left side)
    const textPortion = document.createElement('div');
    textPortion.id = `text-${uniqueSuffix}`;
    textPortion.className = 'protein-text-container';
    textPortion.style = "font-size: 14px; color: #eee;";

    const displayId = node.id.includes('.') ? node.id.split('.')[1] : node.id;
    const displayLabel = node.label? ` (${node.label})` : "";
    const linkHtml = `<a href="#" class="gene-link" style="font-weight:bold;" onclick="handleSymbolSelection('${node.id}'); return false;">${displayId}</a>${displayLabel}`;
    let parsedText = marked.parse(relevantLines).replace(new RegExp(`\\b${targetId}\\b`, 'i'), linkHtml);
    if (parsedText != "") {
      textPortion.innerHTML = parsedText
    } else {
      textPortion.innerHTML = linkHtml
    }

    // Radar plot (middle)
    const radarId = `radar-${uniqueSuffix}`;
    const radarPortion = document.createElement('div');
    radarPortion.innerHTML = `<div id="${radarId}" style="width: ${chartWidth + 80}px; height: ${chartHeight + 80}px;"></div>`;

    // Contact heatmap (right)
    const heatmapPortion = document.createElement('div');
    const heatmapId = `heatmap-${uniqueSuffix}`;
    heatmapPortion.innerHTML = `
      <div style="text-align:center;">
        <div id="${heatmapId}" style="width: ${chartWidth}px; height: ${chartHeight}px; background: #111; border-radius: 4px; border: 1px solid #444;"></div>
          <small style="font-size: 11px; color: #666; display:block; margin-top:2px;">Predicted Contact Map</small>
      </div>`;
    heatmapPortion.style.cursor = "zoom-in";

    chartSection.appendChild(radarPortion);
    chartSection.appendChild(heatmapPortion);

    const footer = document.createElement('div');
    footer.style = "font-size: 0.75rem; color: #aaa; font-style: italic; background: rgba(255,255,255,0.03); padding: 4px 10px; border-radius: 4px; border-left: 2px solid #444;";
    footer.innerHTML = `
                        <div style="display: flex; align-items: center; margin-bottom: 2px;">
                          <i class="bi bi-diagram-3" style="margin-right: 8px; color: #00a2ff;"></i>
                          <strong>BP:</strong>&nbsp;${formatGOLink(link.shared_BP) || "None"}
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 2px;">
                          <i class="bi bi-diagram-3" style="margin-right: 8px; color: #00ff88;"></i>
                          <strong>MF:</strong>&nbsp;${formatGOLink(link.shared_MF) || "None"}
                        </div>
                        <div style="display: flex; align-items: center;">
                          <i class="bi bi-diagram-3" style="margin-right: 8px; color: #ffcc00;"></i>
                          <strong>CC:</strong>&nbsp;${formatGOLink(link.shared_CC) || "None"}
                        </div>`;

    row.append(textPortion);
    row.appendChild(footer);
    row.appendChild(chartSection);
    container.appendChild(row);

    renderRadarChart(radarId, link);
    if (link && link.contact && link.contact.length > 0) {
      renderContactMap(heatmapId, link.contact);
      heatmapPortion.onclick = () => {
        expandHeatmap(link.contact, sourceNodeId, displayId);
      }
    } else {
      document.getElementById(heatmapId).innerHTML = 
        "<div style='display:flex; height:100%; align-items:center; justify-content:center; text-align:center; font-size:9px; color:#555;'>No heatmap available</div>";
    }
  });

  if (container.innerHTML === "") {
    container.innerHTML = `<div class="model-response"><i>No specific explanations/proteins found in response. Please try again</i></div>`;
  }
  const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
  if (isAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
  // container.scrollTop = container.scrollHeight;
}

async function requestLLMPrediction(nodeId) {
  const displayId = nodeId.includes('.') ? nodeId.split('.')[1] : nodeId;
  const targetPanel = createProteinTab(displayId);
  
  const statusId = `status-${Date.now()}`;
  const statusHtml = `<div id="${statusId}" style="color: #888; margin: 10px 0; font-style: italic;">
                        <b>System:</b> Querying new interactions for ${displayId}...
                      </div>`;
  targetPanel.insertAdjacentHTML('beforeend', statusHtml);

  const neighbors = [...highlightNodes].filter(node => node !== nodeId);

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protein_id: nodeId, neighbors: neighbors })
    });

    const data = await res.json();
    console.log('response:',data);
    
    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.remove();

    if (data.nodes && data.nodes.length > 0) {
      addGraphData({ nodes: data.nodes, links: data.links });
    }
    renderChatResponse(data.clean_text, nodeId, data.nodes, data.links, targetPanel);

  } catch (err) {
    console.error(err);
    targetPanel.innerHTML = `<b>Error:</b> Could not reach the prediction API.`;
  }
}

function updatePredictionUI(nodeId) {
  const statusText = document.getElementById('prediction-status');
  const predictBtn = document.getElementById('btn-predict');

  if (nodeId && go_file && gaf_file) {
    const displayId = nodeId.split('.')[1]? nodeId.split('.')[1] : nodeId; 
    statusText.innerHTML = `Predict interacting partners of <b style="color: #2fa1d6;">${displayId}</b>`;
    predictBtn.style.display = 'block'; 
    predictBtn.onclick = () => requestLLMPrediction(nodeId);
  } else {
    if (go_file && gaf_file) {
      statusText.textContent = "Select a node to generate predictions";
      predictBtn.style.display = 'none'
    } else {
      statusText.textContent = "Select a gene ontology (GO) file and annotation (GAF) file"; 
      predictBtn.style.display = 'none'; 
    }
  }
}

function handleSymbolSelection(nodeId) {
  searchAndFocusNode(nodeId);
  if (currTable == "Nodes") {
    highlightNodeTableRow(nodeId);
  } else {
    filterTableByNode(nodeId);
  }
}

function renderRadarChart(containerId, link) {
  setTimeout(() => {
    const data = [{
      type: 'scatterpolar',
      r: [link.string || 0, link.d_script || 0, link.resnik_bp || 0, link.resnik_mf || 0, link.resnik_cc || 0, link.string || 0],
      theta: ['STRING', 'D-SCRIPT', 'Resnik-BP', 'Resnik-MF', 'Resnik-CC', 'STRING'],
      fill: 'toself',
      fillcolor: 'rgba(0, 162, 255, 0.3)',
      line: { 
        color: '#00a2ff', 
        width: 2,
        shape: 'linear'
      },
      hoverlabel: {
        bgcolor: '#222',
        bordercolor: '#00a2ff',
        font: { color: '#fff', size: 12 }
      },
      marker: { size: 2 }
    }];

    const layout = {
      polar: {
        bgcolor: 'rgba(0,0,0,0)',
        radialaxis: { 
          visible: true, 
          range: [0, 1], 
          showticklabels: false, 
          gridcolor: '#5e5e5e',
          ticks: '' 
        },
        angularaxis: { 
          tickfont: { size: 9, color: '#999', family: 'monospace' }, 
          gridcolor: '#5e5e5e',
          rotation: 90
        }
      },
      width: chartWidth + 80,
      height: chartHeight + 80,
      margin: { t: 0, b: 0, l: 50, r: 55 },
      showlegend: false,
      paper_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(containerId, data, layout, { staticPlot: false });
  }, 10);
}

function renderContactMap(containerId, data) {
  setTimeout(() => {
    const plotData = [{
      z: data,
      type: 'heatmap',
      colorscale: [
        [0, '#ffffff'], 
        [1, '#08306b']
      ],
      showscale: false,
      hoverinfo: 'none'
    }];

    const layout = {
      margin: { t: 0, b: 0, l: 0, r: 0 },
      width: chartWidth,
      height: chartHeight,
      xaxis: { visible: false, fixedrange: true },
      yaxis: { visible: false, fixedrange: true },
      paper_bgcolor: 'rgba(255, 255, 255, 0)',
      plot_bgcolor: 'rgba(255, 255, 255, 0)',
    };

    Plotly.newPlot(containerId, plotData, layout, { staticPlot: true });
  }, 10);
}

function expandHeatmap(contactData, sourceNodeId, targetNodeId) {
    const overlay = document.createElement('div');
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); z-index: 9999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        backdrop-filter: blur(5px);
    `;

    const graphDiv = document.createElement('div');
    graphDiv.id = 'expanded-heatmap-container';
    graphDiv.style = "width: 60vw; height: 60vh; background: #000; border: 1px solid #444; border-radius: 8px;";
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = "Close";
    closeBtn.style = "margin-top: 20px; padding: 10px 20px; cursor: pointer; background: #333; color: white; border: 1px solid #555; border-radius: 4px;";
    closeBtn.onclick = () => document.body.removeChild(overlay);

    overlay.appendChild(graphDiv);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    const data = [{
      z: contactData,
      type: 'heatmap',
      colorscale: [
        [0, '#ffffff'], 
        [1, '#08306b']
      ],
      zmin: 0,
      zmax: 1,
      showscale: true,
      colorbar: { title: 'Prob.', tickfont: {color: '#333'} }
    }];

    const layout = {
      autosize: true,
      xaxis: { 
        title: `Residue Index (${sourceNodeId})`, 
        color: '#ccc', 
        gridcolor: '#333',
        scaleanchor: 'y'
      },
      yaxis: { 
        title: `Residue Index (${targetNodeId})`, 
        visible: true,
        color: '#ccc', 
        gridcolor: '#333' 
      },
      paper_bgcolor: 'rgba(255, 255, 255, 0)',
      plot_bgcolor: 'rgba(255, 255, 255, 0)',
    };

    Plotly.newPlot(graphDiv, data, layout, { responsive: true });    
    overlay.onclick = (e) => { if(e.target === overlay) document.body.removeChild(overlay); };
}

function exportTabToGrid(seedProtein) {
    currentExportProtein = seedProtein;
    const cleanId = seedProtein.replace(/[^a-zA-Z0-9]/g, '_');
    const tabContentId = `tab-${cleanId}-content`;
    
    const $gridModalBody = $('#gridModalBody');
    $gridModalBody.empty(); // Clear preview

    const existingRows = $(`#${tabContentId}`).find('.protein-row-container');

    if (existingRows.length === 0) {
        alert("No results found in this tab to export.");
        return;
    }

    existingRows.each(function(index) {
      const $square = $('<div class="prediction-square"></div>');
      $gridModalBody.append($square);

      const $clone = $(this).clone();

      const targetSymbol = $(this).find('.gene-link').text().trim();
      const uniqueSuffix = `${seedProtein}-${targetSymbol}`.replace(/[^a-zA-Z0-9]/g, '-');
    
      const newRadarId = `grid-radar-${uniqueSuffix}-${index}`;
      const newHeatmapId = `grid-heatmap-${uniqueSuffix}-${index}`;

      $clone.find('[id^="radar-"]').attr('id', newRadarId);
      $clone.find('[id^="heatmap-"]').attr('id', newHeatmapId);

      $square.append($clone);

      const link = Graph.graphData().links.find(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === seedProtein && t === targetSymbol);
      });
      
      if (link) {
        setTimeout(() => {
          renderRadarChart(newRadarId, link);
          if (link.contact) renderContactMap(newHeatmapId, link.contact);
        }, 200);
      }
    });

    const modalEl = document.getElementById('gridReviewModal');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();
    } else {
        console.error("Modal element #gridReviewModal not found in DOM.");
    }
}

function processPDFExport() {
  const element = document.getElementById('final-export-area');
  const opt = {
      margin: [0.3, 0.3],
      filename: `${currentExportProtein}_predictions.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#121212' },
      jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' },
      pagebreak: { mode: 'css' }
  };

  html2pdf().set(opt).from(element).save();
}

function processCSVExport() {
  return;
}

function toggleInfoBody(event) {
  const container = document.getElementById('protein-info-container');
  const btn = event.currentTarget || event.target.closest('button');

  container.classList.toggle('minimized');
  const isMinimized = container.classList.contains('minimized');

  btn.textContent = isMinimized ? '+' : '−';
}