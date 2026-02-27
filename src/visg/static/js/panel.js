var isMinimized = false;

async function getPDBIdFromGene(fullEnspId) {
    try {
        const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${fullEnspId}&format=json&fields=accession,organism_name,organism_id,xref_pdb`;
        
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) return [];

        const entry = data.results[0]; 
        const structures = [];
        const commonName = entry.organism.commonName || entry.organism.scientificName;

        if (entry.uniProtKBCrossReferences) {
            entry.uniProtKBCrossReferences
                .filter(ref => ref.database === 'PDB')
                .forEach(ref => {
                    structures.push({
                        pdbId: ref.id,
                        organism: commonName,
                        isAlphaFold: false
                    });
                });
        }
        if (structures.length === 0) {
            structures.push({
                pdbId: entry.primaryAccession, 
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
            title.textContent = struct.isAlphaFold ? `${nodeId} [${struct.pdbId}] (AlphaFold)` : `${nodeId} [${struct.pdbId}]`;
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
    // .on("mouseover", function(event, color) {
    // })
    // .on("mouseout", function() { 
    // })
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

function drawHistogram() {
  const svg = d3.select("#score-histogram");
  if (!svg) return;
  const container = svg.node().closest(".chart-frame");
  const width = container.clientWidth;
  const height = 140;

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const tooltip = d3.select("#tooltip");

  if (svg.select(".chart-layer").empty()) {
    const chartG = svg.append("g")
      .attr("class", "chart-layer")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    chartG.append("g").attr("class", "x-axis")
      .attr("transform", `translate(0,${innerHeight})`);

    chartG.append("g").attr("class", "y-axis");

    chartG.append("g").attr("class", "bars");

    // svg.append("text")
    //   .attr("class", "y-label")
    //   .attr("text-anchor", "middle")
    //   .attr("transform", `rotate(-90)`)
    //   .attr("x",  - (margin.top + innerHeight / 2))
    //   .attr("y", 12)
    //   .text("Frequency")
    //   .style("font-size", "12px");
  }

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([0, innerWidth]);

  const binCount = 10;
  const binStep = 1 / binCount;
  const thresholds = d3.range(0, 1 + binStep, binStep);

  const scores = Graph.graphData().links
    .map(d => d.score);

  const bins = d3.histogram()
    .domain([0, 1])
    .thresholds(thresholds)(scores);

  const maxCount = d3.max(bins, d => d.length);

  const y = d3.scaleLinear()
    .domain([0, maxCount])
    .range([innerHeight, 0]);

  const barWidth = (x(thresholds[1]) - x(thresholds[0])) - 1;

  const chartG = svg.select(".chart-layer");

  // update axes only — DO NOT redraw
  chartG.select(".x-axis").call(d3.axisBottom(x).ticks(5));
  chartG.select(".y-axis").call(d3.axisLeft(y).ticks(5));

  // STRING
  chartG.select(".bars")
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", d => x(d.x0))
    .attr("y", d => y(d.length))
    .attr("width", barWidth)
    .attr("height", d => innerHeight - y(d.length))
    .attr("fill", STRING_COLOR)
    .on("mouseover", function(event, d) {
      tooltip.style("opacity", 1)
        .html(`Count: ${d.length}`)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);

      d3.select(this).attr("fill", "#a9e8e3");
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
      d3.select(this).attr("fill", STRING_COLOR);
    });
}

async function requestLLMPrediction(nodeId) {
  const history = document.getElementById('chat-history');
  history.innerHTML += `<p><b>System:</b> Querying interactions for ${nodeId}...</p>`;
  const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protein_id: nodeId })
    });

    const data = await res.json();
    const chatElem = document.createElement('div');
    chatElem.className = "model-response";
    const formattedChat = marked.parse(data.raw_chat);
    chatElem.innerHTML = `<b>Model:</b> <div>${formattedChat}</div>`;
    history.appendChild(chatElem);
    history.scrollTop = history.scrollHeight;

    console.log('New graph data:', data);

    if (data.nodes.length > 0) {
        addGraphData({ nodes: data.nodes, links: data.links });
    }
}

function updatePredictionUI(nodeId) {
    const statusText = document.getElementById('prediction-status');
    const predictBtn = document.getElementById('btn-predict');

    if (nodeId) {
        const displayId = nodeId.split('.')[1]? nodeId.split('.')[1] : nodeId; 
        statusText.innerHTML = `Predict interacting partners of <b style="color: #2fa1d6;">${displayId}</b>`;
        predictBtn.style.display = 'block'; 
        predictBtn.onclick = () => requestLLMPrediction(nodeId);
    } else {
        statusText.textContent = "Select a node to generate predictions";
        predictBtn.style.display = 'none'; 
    }
}

async function sendChat() {
  const inputElem = document.getElementById('chat-input');
  const userInput = inputElem.value.trim();
  console.log('prompt:',inputElem.value);
  if (!userInput) return;

  const history = document.getElementById('chat-history');
  history.innerHTML += `<p><strong>You:</strong> ${userInput}</p>`;
  // clearing input field
  inputElem.value = '';

  const chatElem = document.createElement('p');
  chatElem.innerHTML = `<strong>Model:</strong> <span id="chat-reply-${Date.now()}"></span>`;
  history.appendChild(chatElem);
  const replyContainer = document.getElementById(`chat-reply-${Date.now()}`);

  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1',
      stream: true,  
      messages: [
        { role: 'system', content: 'Please keep your answers concise, around 2-3 sentences.' },
        { role: 'user', content: userInput }
      ]
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let markdownBuffer = '';
  replyContainer.textContent = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const chunk = json.message?.content;
        if (chunk) {
          markdownBuffer += chunk;
          replyContainer.textContent += chunk;
          history.scrollTop = history.scrollHeight;
        }
      } catch (err) {
        console.warn("Skipping invalid line:", line);
      }
    }
  }
  replyContainer.innerHTML = marked.parse(markdownBuffer);
}

// const chatInput = document.getElementById("chat-input");

// chatInput.addEventListener("keydown", (e) => {
//   if (e.key === "Enter") {
//     sendChat();
//   }
// });

function toggleInfoBody(event) {
  const container = document.getElementById('protein-info-container');
  const btn = event.currentTarget || event.target.closest('button');

  container.classList.toggle('minimized');
  const isMinimized = container.classList.contains('minimized');

  btn.textContent = isMinimized ? '+' : '−';
}