let Graph; 
const highlightNodes = new Set(); 
const highlightLinks = new Set();
let hoverNode = null; // single selected node
let focusNode = null;

let nodeMap = new Map();

var activeLink = null;
var activeLinks = new Set(['red', 'orange', 'blue', 'green', 'gray']); // for custom edge coloring
var activeSpecies = {}; // GUI toggle states
const activeGroups = {
    Given: true,
    Generated: true
  };

var existingControllers = {};
const maxDist = 50;
const minDist = 10;
let totalLinks = 0;

let enableNodeDragging = false;
let enablePointerInteractions = true;
let pauseAnimation = true;
let showLinkWidth = false;
let showLinkParticle = false;
let showNeighbors = false;
let showNodeInfo = false;

const timerV = 12000;
let counter = 0;
let counterStopAt = 195;
let globalHubThreshold;
const initData = {
    nodes: [],
    links: []
};

var currLayout = 'Force-Directed';
var currTable = 'Nodes';

function initGraph() {
    const elem = document.getElementById('3d-graph');
    Graph = ForceGraph3D()(elem)
          .backgroundColor(bckColor) //#101020
          .graphData(initData)
          .enableNodeDrag(enableNodeDragging)
          .enablePointerInteraction(enablePointerInteractions)
          .nodeId('id')
          .nodeLabel(node => {
            let label = "";
            label += `${node.id}`;

            // const inD = new Set(node.in_degree || []).size;
            // const outD = new Set(node.out_degree || []).size;
            // label += ` (IN → ${inD}, OUT → ${outD})`;

            if (showNeighbors) {
              if (!node.neighbors || node.neighbors.length === 0) {
                label += `<br/>Neighbors → []`;
              } else {
                label += `<br/>Neighbors → ${getChunks(node.neighbors)}`;
              }
            }

            if (showNodeInfo) {
              label += `
                <br/>Biological process: ${node.process || 'N/A'}
                <br/>Molecular function: ${node.function || 'N/A'}
                <br/>Cellular component: ${node.location || 'N/A'}
                <br/>Species: ${node.species || 'N/A'}
              `;
            }
            return label;
          })
          .nodeColor(node => {
            if(highlightNodes.has(node.id)){
              if(focusNode === node) {
                return HIGHLIGHT_COLOR;
              }else{
                return '#FFA000';
              }
            }else{
              return "white";
            }
          })
          .nodeResolution(20)
          .linkColor(link => link.score ? colorScale(link.score) : 'gray')
          .linkOpacity(1)
          .linkDirectionalParticles(link => {
            if(showLinkParticle)
              return 8;
            else
              return [...highlightLinks].filter((x) => x.source.id===link.source.id && x.target.id===link.target.id).length !== 0 ? 8 : 0;
          })
          .linkDirectionalParticleWidth(4)
          .linkWidth(link => (showLinkWidth && link.penwidth) ? link.penwidth : 0 )
          .linkDirectionalArrowLength(2)
          .linkDirectionalArrowRelPos(1)
          .linkDirectionalArrowColor(link => link.color ? pSBC ( 0.1, standardize_color(link.color), color8 ) : 'gray' )
          .linkCurvature(link => link.curvature || 0.2)
          .onNodeClick(node => {

            // no state change
            if (!node && !highlightNodes.size) return;

            highlightNodes.clear();
            highlightLinks.clear();

             if (node && hoverNode != node.id) {
              // Highlight this node and its neighbors
              highlightNodes.add(node.id);
              node.neighbors.forEach(neighbor => highlightNodes.add(neighbor));

              // Highlight links connected to this node
              const matchingLinks = Graph.graphData().links.filter(l =>
                (l.source.id || l.source) === node.id ||
                (l.target.id || l.target) === node.id
              );
              matchingLinks.forEach(link => highlightLinks.add(link));

              // Set the single hovered node
              hoverNode = node.id;
              showNodeLabel(node);
              highlightTableRow(node.id);
              if (settings.PruningMode == 'Neighborhood') {
                calculateNodeDepths(node.id);
                applyNeighborhoodPruning();
              }
            } else {
              clearNodeLabels();
              hoverNode = null;
            }
            updateHighlight();
            // console.log("Node selected:", node.id)
          })
          .onNodeRightClick((node, event) => {
            if (event) event.preventDefault(); 
            if (!node) return;
            focusNode = node;
            highlightNodes.add(node.id);
            updateHighlight();
            showCustomContextMenu(node, event.clientX, event.clientY);
          })
          .onLinkClick(link => {

            if(highlightNodes.has(link.source.id) && highlightNodes.has(link.target.id)){
              highlightNodes.clear();
              highlightLinks.clear();
              clearNodeLabels();
              updateHighlight();
              return;
            }

            highlightNodes.clear();
            highlightLinks.clear();
            clearNodeLabels();

            if (link && !highlightNodes.has(link.source.id) && !highlightNodes.has(link.target.id)) {
              highlightLinks.add(link);
              highlightNodes.add(link.source.id);
              highlightNodes.add(link.target.id);

              const srcNode = Graph.graphData().nodes.find(n => n.id === link.source.id);
              const tgtNode = Graph.graphData().nodes.find(n => n.id === link.target.id);

              srcNode.showLabel = true;
              tgtNode.showLabel = true;
            }
            Graph.refresh();
            updateHighlight();
          });

    // light the 3D scene
    Graph.lights()[0].intensity = 500.0;
    Graph.lights()[1].intensity = 15.0;

    // force directed d3 simulation set up
    if (currLayout == 'Force-Directed') {
        Graph.d3Force('collide', d3.forceCollide(collisonStrengthVal))
            .d3AlphaDecay(0.02)
            .d3VelocityDecay(0.3)
            .d3Force("charge", d3.forceManyBody().strength(-200))
            .d3Force('link',
                d3.forceLink()
                .id(d => d.id)
                .distance(d => {
                const similarity = d.similarity || 0.5;
                return maxDist - similarity * (maxDist - minDist);
                }
                ).strength(s => {
                const similarity = s.similarity || 0.5;
                return 0.1 + similarity * 0.9;
                })
        );
    } 

    rebuildTable(NODE_TABLE_COLS);
}

function showNodeLabel(node) {
    Graph.graphData().nodes.forEach(n => n.showLabel = false);
    node.showLabel = true;
    Graph.refresh(); 
}

function clearNodeLabels() {
    Graph.graphData().nodes.forEach(n => n.showLabel = false);
    Graph.refresh();
}

function collisionUpdate(){
    console.log("collisionUpdate now...")
    Graph.d3Force('collide', d3.forceCollide(settings.collisionStrength))
            .d3AlphaDecay(0.02)
            .d3VelocityDecay(0.3);
    Graph.numDimensions(3);
}

//Zoom to Fit
const zoomToFit = () => {
    Graph.zoomToFit(0,10,node=> true)
}

// show node neighbors or not on node hover
const showNodeNeighbors = () => {
    showNeighbors = !showNeighbors;
    Graph
        .nodeLabel(Graph.nodeLabel());
}

// show node neighbors or not on node hover
const showNodeInformation = () => {
    showNodeInfo = !showNodeInfo;
    Graph
        .nodeLabel(Graph.nodeLabel());
}

// enable node rearrange - this is disabled for large graphs
const enableNodeRearrange = () => {
    enableNodeDragging = !enableNodeDragging;
    Graph
            .enableNodeDrag(Graph.enableNodeDrag());
}

function assignLinkCurvature(links) {
    const linkPairs = {};

    links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const key = `${sourceId}-${targetId}`;
      const reverseKey = `${targetId}-${sourceId}`;

      if (linkPairs[key]) {
        linkPairs[key].push(link);
      } else if (linkPairs[reverseKey]) {
        linkPairs[reverseKey].push(link);
      } else {
        linkPairs[key] = [link];
      }
    });

    Object.values(linkPairs).forEach(group => {
      const mid = Math.floor(group.length / 2);
      group.forEach((link, i) => {
        const offset = (i - mid) * 0.2;
        link.curvature = offset === 0 ? 0.1 : offset;
      });
    });
}

function searchAndFocusCluster(clusterColor) {
    const nodesInCluster = Graph.graphData().nodes.filter(n => n.clusterColor === clusterColor);
    if (nodesInCluster.length === 0) return;

    const hubNode = nodesInCluster.reduce((prev, current) => {
        const prevCount = (prev.neighbors || []).length;
        const currCount = (current.neighbors || []).length;
        return (currCount > prevCount) ? current : prev;
    });

    const distance = 500; 
    const distRatio = 1 + distance / Math.hypot(hubNode.x, hubNode.y, hubNode.z);

    Graph.cameraPosition(
      { 
        x: hubNode.x * distRatio, 
        y: hubNode.y * distRatio, 
        z: hubNode.z * distRatio 
      },  
      { x: hubNode.x, y: hubNode.y, z: hubNode.z }, 
      1000 
    );

    highlightNodes.clear();
    highlightLinks.clear();
    clearNodeLabels();
    hoverNode = null;

    nodesInCluster.forEach(node => {
      highlightNodes.add(node.id);
      
      if (node.neighbors) {
          node.neighbors.forEach(neighbor => highlightNodes.add(neighbor));
      }
      
      const matchingLinks = Graph.graphData().links.filter(l => {
          const s = l.source.id || l.source;
          const t = l.target.id || l.target;
          return s === node.id || t === node.id;
      });
      matchingLinks.forEach(link => highlightLinks.add(link));      
      // node.showLabel = true; 
    });
    updateHighlight();
}

function searchAndFocusNode(query) {
    const node = Graph.graphData().nodes.find(n => n.id.toLowerCase() === query.toLowerCase());
    
    if (node) {
      const distance = 400; // how far the camera should be from the node
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

      Graph.cameraPosition(
        { 
          x: node.x * distRatio, 
          y: node.y * distRatio, 
          z: node.z * distRatio 
        },  // New camera position
        node, // Look-at target
        1000  // ms transition duration
      );

      highlightNodes.clear();
      highlightLinks.clear();
      clearNodeLabels();

      if (hoverNode != node) {
        highlightNodes.add(node.id);
        node.neighbors.forEach(neighbor => highlightNodes.add(neighbor));
        
        const matchingLinks = Graph.graphData().links.filter(l =>
          (l.source.id || l.source) === node.id ||
          (l.target.id || l.target) === node.id
        );
        matchingLinks.forEach(link => highlightLinks.add(link));

        hoverNode = node.id;
        showNodeLabel(node);
        if (settings.PruningMode == 'Neighborhood') {
          calculateNodeDepths(node.id);
          applyNeighborhoodPruning();
        }
      }
      updateHighlight();
    } else {
      hoverNode = null;
      alert("Protein not found in the graph.");
    }
}

function searchAndFocusLink(sourceId, targetId, taxonId) {
    const link = Graph.graphData().links.find(l =>
      (l.source.id || l.source) === sourceId &&
      (l.target.id || l.target) === targetId);

    if (link) {
      const node = typeof link.source === 'object' ? link.source : Graph.graphData().nodes.find(n => n.id === link.source);
      const tgtNode = typeof link.target === 'object' ? link.target : Graph.graphData().nodes.find(n => n.id === link.target);

      const distance = 400;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

      Graph.cameraPosition(
        {
          x: node.x * distRatio,
          y: node.y * distRatio,
          z: node.z * distRatio
        },
        node,
        1000
      );

      clearNodeLabels();
      highlightNodes.clear();
      highlightLinks.clear();

      highlightNodes.add(sourceId);
      highlightNodes.add(targetId);
      highlightLinks.add(link);

      updateHighlight();

      node.showLabel = true;
      tgtNode.showLabel = true;
      Graph.refresh();
    }
}

function applyForceDirectedLayout() {
    Graph.d3Force('collide', d3.forceCollide(collisonStrengthVal))
      .d3Force('center', d3.forceCenter(0, 0, 0))
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.3)
      .d3Force("charge", d3.forceManyBody().strength(-200))
      .d3Force('link', 
        d3.forceLink()
        .id(d => d.id)
        .distance(d => {
          const similarity = d.similarity || 0.5;
          return maxDist - similarity * (maxDist - minDist);
        }
      ).strength(s => {
        const similarity = s.similarity || 0.5;
        return 0.1 + similarity * 0.9;
      }))
      .d3Force('spherical', null);
    Graph.numDimensions(3);
    Graph.d3ReheatSimulation(); // Restart the layout animation
}

function forceConcentricSphere(nodes, numLayers = 4) {
    // sorting by degree and assign shells
    let baseRadius = 100;
    let shellSpacing = 100;

    const degrees = nodes.map(n => ({
      id: n.id,
      degree: n.neighbors ? n.neighbors.length : 0
    }));

    const maxDegree = Math.max(...degrees.map(d => d.degree));
    const minDegree = Math.min(...degrees.map(d => d.degree));

    // Map node id to layer index (lower degree = outer shell)
    const layerMap = {};
    degrees.forEach(({ id, degree }) => {
      const normalized = (degree - minDegree) / (maxDegree - minDegree + 1e-6); // normalize [0,1]
      const layer = Math.round(normalized * (numLayers - 1));
      layerMap[id] = layer;
    });

    return () => {
      nodes.forEach(n => {
        const layer = layerMap[n.id] || 0;
        n.shellLayer = layer;
        const radius = baseRadius + layer * shellSpacing;

        const r = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1e-6;
        const scale = radius / r;

        n.x *= scale;
        n.y *= scale;
        n.z *= scale;
      });
    };
}

function forceConcentricSphereClustered(nodes, numLayers = 4) {
    // Group nodes by clusterColor
    const clusters = {};
    nodes.forEach(n => {
      const clusterId = n.clusterColor ?? "#cccccc";
      if (!clusters[clusterId]) clusters[clusterId] = [];
      clusters[clusterId].push(n);
    });

    // Compute cluster centers based on current positions
    const clusterCenters = {};
    Object.entries(clusters).forEach(([cid, clusterNodes]) => {
      let sumX = 0, sumY = 0, sumZ = 0;
      clusterNodes.forEach(n => {
        sumX += n.x ?? 0;
        sumY += n.y ?? 0;
        sumZ += n.z ?? 0;
      });
      const len = clusterNodes.length || 1;
      clusterCenters[cid] = {
        x: sumX / len,
        y: sumY / len,
        z: sumZ / len
      };
    });

    // For each cluster, assign layers based on degree
    const clusterLayerMaps = {};
    Object.entries(clusters).forEach(([cid, clusterNodes]) => {
      const degrees = clusterNodes.map(n => n.neighbors?.length ?? 0);
      const minDegree = Math.min(...degrees);
      const maxDegree = Math.max(...degrees);

      const layerMap = {};
      clusterNodes.forEach(n => {
        const normalized = (n.neighbors?.length ?? 0 - minDegree) / (maxDegree - minDegree + 1e-6);
        // outer layer = lower degree
        const layer = Math.round(normalized * (numLayers - 1));
        layerMap[n.id] = layer;
        n.shellLayer = layer;
      });

      clusterLayerMaps[cid] = layerMap;
    });

    // Return a force function for Graph
    return alpha => {
      Object.entries(clusters).forEach(([cid, clusterNodes]) => {
        const center = clusterCenters[cid];
        const layerMap = clusterLayerMaps[cid];

        const baseRadius = 50;    // inner radius
        const shellSpacing = 50;  // space between layers

        clusterNodes.forEach(n => {
          const layer = layerMap[n.id] ?? 0;
          const radius = baseRadius + layer * shellSpacing;

          // vector from cluster center
          const dx = n.x - center.x;
          const dy = n.y - center.y;
          const dz = n.z - center.z;
          const r = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-6;

          const scale = radius / r;

          // Move node toward target shell
          n.vx += (dx * scale - dx) * alpha;
          n.vy += (dy * scale - dy) * alpha;
          n.vz += (dz * scale - dz) * alpha;
        });
      });
    };
  }

function applySphericalLayout(nodes, numLayers = 4) {
    Graph.d3Force('clusterSphere', forceConcentricSphereClustered(nodes, numLayers))
        .nodeVal(node => 0.3 + (node.shellLayer ?? 0)); // node size by layer
    Graph.refresh && Graph.refresh();
}


function filterLinkByOrganism(link) {
    const species = link.ncbiTaxonId;
    return activeSpecies[species];
}

  
function filterLinkByGroup(link) {
    if (link.originType !== "File" && activeGroups.Generated) return true;
    if (link.originType == "File" && activeGroups.Given) return true;
    return false;
}


const updateLinks = () => {
    Graph.linkVisibility(filterLinkByOrganism);
}

const updateLinkGroups = () => {
    Graph.linkVisibility(filterLinkByGroup);
}

// showLinkWidth
const toggleLinkWidth = () => {
    showLinkWidth = !showLinkWidth;
    Graph
        .linkWidth(Graph.linkWidth())
}

const toggleClusterColors = () => {
    clusterColors = !clusterColors;
}

// Toggle Link Particles
const toggleLinkAnimation = () => {
    if(!showLinkParticle){
      highlightNodes.clear();
      highlightLinks.clear();
      updateHighlight();
    }
    else{
      Graph
          .linkDirectionalParticles(Graph.linkDirectionalParticles());
    }
    showLinkParticle = !showLinkParticle;

}

const clearHighlights = () => {

    highlightNodes.clear();
    highlightLinks.clear();
    updateHighlight();
    clearNodeLabels();
    if (settings.PruningMode == "Neighborhood") {
      clearPruning();
    }
    $('#data-table tbody tr.highlight-node').removeClass('highlight-node');
}

function clearPruning() {
    const { nodes, links } = Graph.graphData();
    nodes.forEach(n => {
        n.depth = 0;
    });
    Graph.nodeVisibility(true);
    Graph.linkVisibility(true);
    setStats(nodes.length, links.length);
    Graph.refresh();
}

function filterLinkByColor(link) {
    const linkColor = link.color || 'gray';
    // If multi-selection is active
    if (activeLinks.size > 0) {
      return activeLinks.has(linkColor);
    }
    // If a single hovered item is active
    if (activeLink) {
      return linkColor === activeLink;
    }
    // No filtering – show all
    return true;
}

document.querySelectorAll('.legend-item').forEach(item => {
    const color = item.getAttribute('data-color');

    item.addEventListener('click', () => {
      if (activeLinks.has(color)) {
        activeLinks.delete(color);
        item.classList.remove('selected');
      } else {
        activeLinks.add(color);
        item.classList.add('selected');
      }
      activeLink = null;

      Graph.linkVisibility(filterLinkByColor);
    });
});

// trigger update of highlighted objects in scene
function updateHighlight() {
    Graph
        .nodeColor(Graph.nodeColor())
        //.linkWidth(Graph.linkWidth())
        .linkDirectionalParticles(Graph.linkDirectionalParticles())
};

// module for timed calls for graph updates
function reloadGraphData(reset = false, stopAt = counterStopAt) {
    counter = 0;
    counterStopAt = +stopAt;
    // console.log("stop at", +stopAt, "counter",counter, "counterStopAt",counterStopAt)

    myInterval = setInterval(() => {
      if (!pauseAnimation) {
        if (counter < counterStopAt) {
          Sijax.request('getDataPartions', [counter.toString(), reset.toString()]);
          if (reset) reset = false;
          counter++;

          const nodesCount = Graph.graphData()?.nodes?.length || 0;  // safer check
          let fitAfter = (nodesCount > 500) ? 2 : 1;

          if (counter % fitAfter === 0) {
            zoomToFit();
          }
        } else {
          // Optionally clear interval when done
          clearInterval(myInterval);
        }
      }
    }, timerV);
}

function runBFS(rootId) {
    const { nodes } = Graph.graphData();
    
    nodes.forEach(n => n.depth = Infinity);

    const rootNode = globalNodeMap.get(rootId);
    if (!rootNode) return;

    rootNode.depth = 0;
    const queue = [rootNode];

    while (queue.length > 0) {
        const curr = queue.shift();
        
        curr.neighbors.forEach(neighborId => {
            const neighborNode = globalNodeMap.get(neighborId);
            if (neighborNode && neighborNode.depth === Infinity) {
                neighborNode.depth = curr.depth + 1;
                queue.push(neighborNode);
            }
        });
    }
}

// getting depths of each node from a single node (rootId)
function calculateNodeDepths(rootId) {
    runBFS(rootId); 
}

function applyNeighborhoodPruning() {
    const { links } = Graph.graphData();
    const maxD = settings.MaxDepth;

    const visibleLinks = links.filter(l => {
        const s = l.source;
        const t = l.target;

        return (s.depth !== undefined && s.depth <= maxD) && 
               (t.depth !== undefined && t.depth <= maxD);
    });

    const visibleNodeIds = new Set();
    visibleLinks.forEach(l => {
        visibleNodeIds.add(l.source.id || l.source);
        visibleNodeIds.add(l.target.id || l.target);
    });

    // 3. Update the Graph View
    const visibleLinksSet = new Set(visibleLinks);
    Graph.linkVisibility(link => visibleLinksSet.has(link));
    Graph.nodeVisibility(node => visibleNodeIds.has(node.id));

    // 4. Update UI
    setStats(visibleNodeIds.size, visibleLinks.length);
    Graph.refresh();
}

function applyLinkFilters() {
  const { links, nodes } = Graph.graphData();
  const maxAllowed = Math.min(Math.floor(settings.MaxLinks), links.length);

  Graph.linkVisibility((link, index) => {
      return index <= maxAllowed;
  });

  const visibleLinkSet = new Set();
  const activeLinks = links.slice(0, maxAllowed);

  activeLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      visibleLinkSet.add(sId);
      visibleLinkSet.add(tId);
  });

  Graph.nodeVisibility(node => visibleLinkSet.has(node.id));  
  Graph.refresh();
  setStats(visibleLinkSet.size, maxAllowed);
}

function stopFunction() {
    clearInterval(myInterval);
    console.log("my interval stopped", myInterval)
}

// stop the timer at counterStopAt - which is updated as the data comes in
function updateStopAt(newCounterStop) {
    counterStopAt = (counterStopAt !== +newCounterStop) ? newCounterStop: counterStopAt;
}

// reset Graph
function resetGraph(){
    Graph.graphData(initData)
    document.body.classList.remove('has-data');
    highlightNodes.clear();
    highlightLinks.clear();
    hoverNode = null;
    focusNode = null;
}

function initializeGraphPointers() {
    const { nodes } = Graph.graphData();
    globalNodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const degrees = nodes.map(n => n.neighbors.length).sort((a, b) => b - a);
    globalHubThreshold = degrees[10] || 20;
}

function addGraphData(dataPart, reset = false) {
    if (reset) {
        console.log("resetting...");
        resetGraph();
        console.log("reset done.");
    }

    document.body.classList.add('has-data');

    dataPart.nodes = dataPart.nodes.map(n => ({
        ...n,
        in_degree: n.in_degree || [],
        out_degree: n.out_degree || [],
        neighbors: n.neighbors || [],
        links: n.links || [],
        showLable: false
    }));

    dataPart.links.forEach(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        
        const sNode = dataPart.nodes.find(n => n.id === s);
        const tNode = dataPart.nodes.find(n => n.id === t);
        
        if (sNode && !sNode.neighbors.includes(t)) sNode.neighbors.push(t);
        if (tNode && !tNode.neighbors.includes(s)) tNode.neighbors.push(s);
        
        // Importance = sum of neighbors. 
        // Links between two hubs = high value. Links between two "leaves" = low value.
        link.importance = (sNode?.neighbors?.length || 0) + (tNode?.neighbors?.length || 0);
    });

    const linkedNodeIds = new Set();
    dataPart.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        linkedNodeIds.add(sourceId);
        linkedNodeIds.add(targetId);
    });

    dataPart.nodes = dataPart.nodes.filter(n => linkedNodeIds.has(n.id));
    dataPart.links.sort((a,b) => (b.importance || 0) - (a.importance || 0));

    const { nodes, links } = Graph.graphData();

    let newNodes = [];
    let oldNodes = [];
    let nodesFound = [];

    if (nodes.length !== 0) {
        nodes.forEach(n => {
            const oldNVals = dataPart.nodes.find(newN => newN.id === n.id);

            if (!oldNVals) {
                oldNodes.push(n);
            } else {
                nodesFound.push(n.id);
                const oldLinkVals = dataPart.links.filter(newL => (newL.source === n.id) || (newL.target === n.id));

                oldLinkVals.forEach(inoutl => {
                    const src = typeof inoutl.source === 'object' ? inoutl.source.id : inoutl.source;
                    const tgt = typeof inoutl.target === 'object' ? inoutl.target.id : inoutl.target;
                    
                    if (n.id === src) n.out_degree.push(tgt);
                    else if (n.id === tgt) n.in_degree.push(src);
                });

                n.out_degree = [...new Set(n.out_degree)];
                n.in_degree = [...new Set(n.in_degree)];
                n.links = [...(n.links || []), ...oldLinkVals];
                n.neighbors = [...new Set([...(n.neighbors || []), ...(oldNVals.neighbors || [])])];
                n.showLable = false;
                oldNodes.push(n);
            }
        });
        newNodes = dataPart.nodes.filter(newN => !(nodesFound.includes(newN.id)));
    } else {
        newNodes = dataPart.nodes.map(n => {
            const nodeLinks = dataPart.links.filter(l => {
                const src = typeof l.source === 'object' ? l.source.id : l.source;
                const tgt = typeof l.target === 'object' ? l.target.id : l.target;
                return src === n.id || tgt === n.id;
            });

            nodeLinks.forEach(l => {
                const src = typeof l.source === 'object' ? l.source.id : l.source;
                const tgt = typeof l.target === 'object' ? l.target.id : l.target;
                
                if (n.id === src) n.out_degree.push(tgt);
                else if (n.id === tgt) n.in_degree.push(src);
            });

            n.out_degree = [...new Set(n.out_degree)];
            n.in_degree = [...new Set(n.in_degree)];
            n.neighbors = [...new Set([...n.out_degree, ...n.in_degree])];
            
            return n;
        });
    }

    const result = {
        nodes: [...oldNodes, ...newNodes],
        links: links.concat(dataPart.links)
    };

    const adjacency = {};
    dataPart.links.forEach(link => {
      const sourceId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
      const targetId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
      
      if (sourceId && targetId) {
          if (!adjacency[sourceId]) adjacency[sourceId] = new Set();
          if (!adjacency[targetId]) adjacency[targetId] = new Set();
          adjacency[sourceId].add(targetId);
          adjacency[targetId].add(sourceId);
      }
    });

    getConnectedComponents(result.nodes, adjacency);
    assignLinkCurvature(result.links);

    const nlen = result.nodes ? new Set(result.nodes.map(n => n.id)).size : 0;
    const llen = result.links ? getUniqueLinks(result.links).length : 0;

    // settings.MaxLinks = llen;
    // setStats(nlen, llen);

    const nodeClusterMap = {};
    result.nodes.forEach(node => {
        if (node.clusterColor) {
            nodeClusterMap[node.id] = node.clusterColor;
        }
    });

    updateClusterList(nodeClusterMap);

    // adding cluster colors around nodes
    Graph.nodeThreeObject(node => {
      const group = new THREE.Group();
      const radius = 4;

      const isHighlighted = highlightNodes.has(node.id);
      const isHovered = node.id === hoverNode; 

      if (isHovered && node.showLabel) {
        const sprite = new SpriteText(node.id);
        sprite.color = "white";     
        sprite.textHeight = 8;
        return sprite;              
      }
      let baseColor = "white";
      if (isHighlighted && !isHovered) {
        baseColor = "#FFA000";
      }

      const mainSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.8,
          metalness: 0
        })
      );

      group.add(mainSphere);

      if (node.showLabel && !isHovered) {
        const sprite = new SpriteText(node.id);
        sprite.color = "white";     
        sprite.textHeight = 8;
        sprite.position.y = radius * 2;
        group.add(sprite);
      }
      return group;
    });

    rebuildTable(NODE_TABLE_COLS);
    if (currTable == 'Nodes') populateNodeTable(newNodes);
    else if (currTable == 'Links') populateLinkTable(dataPart.links);

    updateGUILabels(dataPart.links);

    Graph.graphData(result);

    initializeGraphPointers();
    applyLinkFilters();
    
    if (currLayout === 'Spherical') applySphericalLayout(result.nodes);
    
    updateHighlight();
    refreshCharts();
}

function refreshCharts() {
    if (typeof drawHistogram === "function") drawHistogram();
}