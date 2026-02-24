var isMinimized = false;

// getting PDB ID from gene name using UniProt REST API
async function getPDBIdFromGene(geneName) {
  const url = `https://rest.uniprot.org/uniprotkb/search?query=gene:${geneName}+AND+reviewed:true&fields=accession,organism_name,xref_pdb&format=json`;
  const res = await fetch(url);
  const data = await res.json();

  const pdbStructures = [];

  for (const result of data.results || []) {
      const organism = result.organism?.scientificName || "Unknown";
      const pdbRefs = result.uniProtKBCrossReferences?.filter(ref => ref.database === 'PDB');
      const pdbIds = pdbRefs.map(ref => ref.id);
      
      for (const ref of pdbRefs || []) {
        pdbStructures.push({
            pdbId: ref.id,
            organism,
        });
        }
    }

    return pdbStructures; 
}

function createProteinModal() {
    if (!focusNode) return;
    let gene = focusNode.id;

    // ---- Load protein structure ----
    getPDBIdFromGene(gene).then(structures => {
        if (!structures.length) {
            alert(`No 3D structures found for ${gene}`);
            return;
        }
        let currIdx = 0;

        // Create modal wrapper
        const modal = document.createElement("div");
        modal.className = "draggable resizable protein-modal";
        modal.style.cssText = `
            position: fixed;
            top: 100px;
            left: 600px;
            width: 300px;
            height: 330px;
            background: white;
            border: 2px solid #444;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            overflow: hidden;
        `;
        modal.id = `protein-modal-${gene}`;

        const header = document.createElement("div");
        header.className = "modal-header";
        header.style.cssText = `
            background: #222;
            color: white;
            padding: 6px;
            cursor: move;
            font-family: 'Lucida Grande', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        // Create title
        const title = document.createElement("span");
        title.style.cssText = `
            font-size: 16px;
            margin-bottom: 4px;
        `;
        header.appendChild(title);

        // Create nav controls
        const nav = document.createElement("div");
        nav.innerHTML = `
            <button id="prevPDB-${gene}">⟨</button>
            <button id="nextPDB-${gene}">⟩</button>
        `;
        Array.from(nav.children).forEach(btn => {
            btn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                margin: 0 4px;
                cursor: pointer;
            `;
        });
        header.appendChild(nav);

        // Close button
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.cssText = `
            position: absolute;
            top: 2px;
            right: 10px;
            background: none;
            border: none;
            font-size: 20px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            z-index: 1;
        `;
        closeBtn.onclick = () => modal.remove();

        // frame
        const frame = document.createElement("iframe");
        frame.style.cssText = `
            width: 100%;
            height: calc(100% - 50px);
            border: none;
        `;
        frame.id = `protein-frame-${gene}`;

        // building DOM
        modal.appendChild(header);
        modal.appendChild(closeBtn);
        modal.appendChild(frame);
        const container = document.getElementById("protein-frame-container");
        container.appendChild(modal);

        function showStructure(gene, structures, index) {
            const { pdbId, organism } = structures[index];
            frame.src = `https://molstar.org/viewer/?pdb=${pdbId}&hide-controls=1&collapse-left-panel=1`;
            title.textContent = `${gene} [PDBID: ${pdbId}] (${organism})`;
        }

        document.getElementById(`prevPDB-${gene}`).onclick = () => {
            if (currIdx > 0) {
                currIdx--;
                showStructure(gene, structures, currIdx);
            }
        };
        document.getElementById(`nextPDB-${gene}`).onclick = () => {
            if (currIdx < structures.length - 1) {
                currIdx++;
                showStructure(gene, structures, currIdx);
            }
        };

        showStructure(gene, structures, currIdx); // show first structure

        requestAnimationFrame(() => {
            updateConnectorLine(Graph.graphData().nodes.find(n => n.id === gene), modal);
        });

        // adding interactions
        interact(modal)
            .draggable({
                allowFrom: '.modal-header',
                listeners: {
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                    
                    // updating line
                    const gene = target.querySelector('.modal-header')?.textContent?.split(':')[1]?.trim()?.split(' ')[0];
                    const node = Graph.graphData().nodes.find(n => n.id === gene);
                    if (node) updateConnectorLine(node, target);
                }
            }
        })
        
        // adding a line element to the svg
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("id", `line-${gene}`);
        line.setAttribute("stroke", "red");
        line.setAttribute("stroke-width", "1.2");
        line.setAttribute("stroke-dasharray", "5,5");
        document.getElementById("modal-connectors").appendChild(line);

        // updating line position on drag or animation
        function updateLine() {
            const node = Graph.graphData().nodes.find(n => n.id == gene);

            if (!node) return;

            const nodePos = Graph.graph2ScreenCoords(node.x, node.y, node.z);

            const modalRect = modal.getBoundingClientRect();
            const modalX = modalRect.left + modalRect.width / 2;
            const modalY = modalRect.top + modalRect.height / 2;

            const HEADER_HEIGHT = document.getElementById("main-title-container").offsetHeight;

            const adjustedPosY = nodePos.y + HEADER_HEIGHT;

            line.setAttribute("x1", nodePos.x);
            line.setAttribute("y1", adjustedPosY);
            line.setAttribute("x2", modalX);
            line.setAttribute("y2", modalY);
        }

        // Call once and on animation frames
        updateLine();
        const lineInterval = setInterval(updateLine, 30); // keep line updated while dragging

        // Remove line on modal close
        closeBtn.onclick = () => {
            modal.remove();
            line.remove();
            clearInterval(lineInterval);
        };
    });
}

  function closeProteinModal(gene) {
    const modal = document.getElementById(`protein-modal-${gene}`);
    const line = document.getElementById(`line-${gene}`);
    if (modal) modal.remove();
    if (line) line.remove();
  }

  function showCustomContextMenu(node, x, y) {
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

    const barWidth = (x(thresholds[1]) - x(thresholds[0])) / 2 - 1;

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

  function drawRadarBase() {
    const svg = d3.select("#radar-chart")
    svg.selectAll("*").remove()

    const container = svg.node().closest(".chart-frame");
    const width = container.clientWidth
    const height = container.clientHeight - 20;

    const tooltip = d3.select("#tooltip");

    svg
      .attr("width", width)
      .attr("height", height)

    const margin = { top: 30, right: 10, bottom: 20, left: 10 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    const chartG = svg.append("g")
      .attr("class", "chart-layer")
      .attr("transform", `translate(${centerX},${centerY})`)

    const axisG = chartG.append("g").attr("class", "axis-layer")
    chartG.append("g").attr("class", "data-layer")

    const angleSlice = (2 * Math.PI) / scoreFields.length

    const rScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, radius])

    // grid
    const levels = 5
    for (let i = 1; i <= levels; i++) {
      axisG.append("circle")
        .attr("r", radius / levels * i)
        .attr("fill", "none")
        .attr("stroke", "#ddd")
    }

    // axes + labels
    scoreFields.forEach((field, i) => {
      const angle = i * angleSlice - Math.PI / 2

      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      // line
      axisG.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", "#aaa")

      // label
      axisG.append("text")
        .attr("x", Math.cos(angle) * (radius + 12))
        .attr("y", Math.sin(angle) * (radius + 12))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .style("font-size", "10px")
        .text(field)
        .style('cursor', 'default')
        .on("mouseover", (event) => {
        tooltip.style("opacity", 1)
          .html(`<b>${scoreInfo[field]}</b>`)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
    })

    svg.node().__radar__ = {
      angleSlice,
      rScale,
      chartG
    }
  }

  function drawRadarChart() {
    const svg = d3.select("#radar-chart")
    if (svg.select(".chart-layer").empty()) {
      drawRadarBase();
    }

    const { angleSlice, rScale, chartG } = svg.node().__radar__
    const dataG = chartG.select(".data-layer")

    dataG.selectAll("*").remove()
    const nodeClusterMap = {};
    Graph.graphData().nodes.forEach(n => {
      if (n?.id && n?.clusterColor) {
        nodeClusterMap[n.id] = n.clusterColor;
      }
    });

    updateClusterList(nodeClusterMap);

    clusterScoreMap = new Map();
    Graph.graphData().links.forEach(link => {
      if (link.type !== "STRING") return;
      const scores = Array.isArray(link.scores) ? link.scores : [];
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const srcColor = nodeClusterMap[srcId];
      if (!clusterScoreMap.has(srcColor)) clusterScoreMap.set(srcColor, []);
      clusterScoreMap.get(srcColor).push(...scores); 
    });

   const clusters = Array.from(clusterScoreMap.entries()).map(([color, scores]) => {
    const averages = scoreFields.map(field => {
      const values = scores
        .map(v => +v[field])
        .filter(v => !isNaN(v) && v > 0);

      return { axis: field, value: values.length ? d3.mean(values) : 0 };
    });

    return { color, values: averages };
  });

  const radarArea = d3.areaRadial()
    .angle((d, i) => i * angleSlice)
    .innerRadius(0)
    .outerRadius(d => rScale(d.value))
    .curve(d3.curveCatmullRomClosed.alpha(0.7))

  const areas = dataG.selectAll(".cluster-area")
    .data(clusters, d => d.color)  

  areas.exit().remove()

  areas
    .join("path")
    .attr("class", "cluster-area")
    .attr("fill", d => d.color)
    .attr("stroke", d => d.color)
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.4)
    .attr("d", d => radarArea(d.values))
  }

  function getTopSharedTermsByCluster(nodes, links, termType = "BP", topN = 10) {
    const termProp = `${termType}_terms`;
    const nodeClusterMap = {};
    nodes.forEach(n => {
      if (n?.id && n?.clusterColor) {
        nodeClusterMap[n.id] = n.clusterColor;
      }
    });

    const termMap = {};

    links.forEach(link => {
      const term = link?.scores?.[termProp]?.mica;
      if (!term?.id) return;

      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;

      const srcColor = nodeClusterMap[source];
      const tgtColor = nodeClusterMap[target];

      if (!termMap[term.id]) {
        termMap[term.id] = {
          id: term.id,
          name: term.name,
          count: 0,
          clusters: {}
        };
      }

      // Count source node
      if (srcColor) {
        termMap[term.id].clusters[srcColor] =
          (termMap[term.id].clusters[srcColor] || 0) + 1;
        termMap[term.id].count += 1;
      }

      // Count target node (if different)
      if (tgtColor && target !== source) {
        termMap[term.id].clusters[tgtColor] =
          (termMap[term.id].clusters[tgtColor] || 0) + 1;
        termMap[term.id].count += 1;
      }
    });

    return Object.values(termMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }

  function drawTermChart(termType = "BP") {
    const topTerms = getTopSharedTermsByCluster(Graph.graphData().nodes, Graph.graphData().links, termType, 10);

    const svg = d3.select("#term-chart-" + termType);
    svg.selectAll("*").remove();

    const container = svg.node().parentNode;
    const width = container.clientWidth;
    const height = container.clientHeight - 24; 
    const margin = { top: 10, right: 30, bottom: 10, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const tooltip = d3.select("#tooltip");

    const x = d3.scaleLinear()
      .domain([0, d3.max(topTerms, d => d.count)])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(topTerms.map(d => d.id))
      .range([0, innerHeight])
      .padding(0.2);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const termGroups = g.selectAll(".term")
      .data(topTerms)
      .join("g")
      .attr("class", "term")
      .attr("transform", d => `translate(0, ${y(d.id)})`);

    termGroups.each(function(d) {
      let x0 = 0;
      Object.entries(d.clusters).forEach(([clusterColor, count]) => {
        d3.select(this)
          .append("rect")
          .attr("x", x0)
          .attr("y", 0)
          .attr("width", x(count))
          .attr("height", y.bandwidth())
          .attr("fill", clusterColor)
          .attr("opacity", 0.5)
          .on("mouseover", (event) => {
            tooltip.style("opacity", 1)
              .html(`
                <b>${d.name}</b><br>
                Count: ${count}
              `)
              .style("left", event.pageX + 10 + "px")
              .style("top", event.pageY - 28 + "px");
          })
          .on("mouseout", () => tooltip.style("opacity", 0));
        x0 += x(count);
      });
    });

    g.selectAll("text.count")
      .data(topTerms)
      .join("text")
      .attr("class", "count")
      .attr("x", d => x(d.count) + 5)
      .attr("y", d => y(d.id) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "12px")
      .text(d => d.count);

    // Y-axis
    const yAxis = g.append("g")
      .call(d3.axisLeft(y).tickSize(0));
    yAxis.select(".domain").remove();
    yAxis.selectAll("text").style("font-size", "10px");
  }


  function updateConnectorLine(geneId, pdbId) {
    const node = Graph.graphData().nodes.find(n => n.id === geneId);
    if (!node) return;

    const { x, y } = Graph.graph2ScreenCoords(node.x, node.y, node.z);  // <-- this is all you need

    const modal = document.getElementById(`protein-modal-${pdbId}`);
    if (!modal) return;

    const modalRect = modal.getBoundingClientRect();
    const modalX = modalRect.left + modalRect.width / 2;
    const modalY = modalRect.top + modalRect.height / 2;

    const line = document.getElementById(`connector-line-${pdbId}`);
    if (line) {
      line.setAttribute('x1', x);
      line.setAttribute('y1', y);
      line.setAttribute('x2', modalX);
      line.setAttribute('y2', modalY);
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

    // When streaming finishes, convert full Markdown buffer to HTML
    replyContainer.innerHTML = marked.parse(markdownBuffer);
  }

  const chatInput = document.getElementById("chat-input");

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendChat();
    }
  });

  function toggleInfoBody(event) {
    const container = document.getElementById('protein-info-container');
    const btn = event.currentTarget || event.target.closest('button');

    container.classList.toggle('minimized');
    const isMinimized = container.classList.contains('minimized');

    btn.textContent = isMinimized ? '+' : '−';
  }