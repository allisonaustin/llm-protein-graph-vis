let Graph; 
const highlightNodes = new Set(); 
const highlightLinks = new Set();
let hoverNodes = new Set(); // selected (red) nodes
let hoverNode = null; // single selected (red) node
let focusNode = null;

var activeLink = null;
var activeLinks = new Set(['red', 'orange', 'blue', 'green', 'gray']); // for custom edge coloring
var activeSpecies = {}; // GUI toggle states
const activeGroups = {
    Unverified: true,
    Verified: true
  };

var existingControllers = {};
const maxDist = 50;
const minDist = 10;
let totalLinks = 0;

let enableNodeDragging = false;
let enablePointerInteractions = true;
let pauseAnimation = false;
let showLinkWidth = false;
let showLinkParticle = false;
let showNeighbors = false;
let showNodeInfo = false;

const adjacency = {};
let clusterHulls = [];
const timerV = 12000;
let counter = 0;
let counterStopAt = 195;
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

            const inD = new Set(node.in_degree || []).size;
            const outD = new Set(node.out_degree || []).size;
            label += ` (IN → ${inD}, OUT → ${outD})`;

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
          .nodeVal(node => (node.neighbors.length > 20 && node.neighbors.length < 30) ? 2 : (node.neighbors.length >= 30) ? 3 : 1)
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
            } else {
              clearNodeLabels();
              hoverNode = null;
            }
            updateHighlight();
            console.log("Node selected:", node.id)
          })
          .onNodeRightClick((node, event) => {
            if (event) event.preventDefault(); 
            if (!node) return;
            focusNode = node;
            showCustomContextMenu(node, event.clientX, event.clientY);
          })
          .onLinkClick(link => {

            if(highlightNodes.has(link.source.id) && highlightNodes.has(link.target.id)){
              highlightNodes.clear();
              highlightLinks.clear();
              clearNodeLabels();
              updateHighlight();
              d3.select("#radar-chart").selectAll(".selected-link-line").remove();
              d3.select("#radar-chart g.legend").selectAll('.selected').remove();
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

function clearSelectedLink() {
    d3.select("#radar-chart").selectAll(".selected-link-line").remove();
}

function clearRadarLegend() {
    d3.select("#radar-chart g.legend").selectAll('.selected').remove();
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

    const avgX = d3.mean(nodesInCluster, n => n.x);
    const avgY = d3.mean(nodesInCluster, n => n.y);
    const avgZ = d3.mean(nodesInCluster, n => n.z);

    const distance = 500; 
    const distRatio = 1 + distance / Math.hypot(avgX, avgY, avgZ);

    Graph.cameraPosition(
      { 
        x: avgX * distRatio, 
        y: avgY * distRatio, 
        z: avgZ * distRatio 
      },  
      { x: avgX, y: avgY, z: avgZ }, 
      1000 
    );
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
    if (link.type !== "STRING" && activeGroups.Unverified) return true;
    if (link.type == "STRING" && activeGroups.Verified) return true;
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

// Toggle Link Particles
const toggleLinkAnimation = () => {
    if(!showLinkParticle){
      highlightNodes.clear();
      hoverNodes.clear();
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

    // clearSelectedLink();
    // clearRadarLegend();
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

function updateLinkColor() {
    const confidenceLegend = document.getElementById('legend-confidence');
    const validationLegend = document.getElementById('legend-validation');

    if (settings.EdgeColor === 'Score') {
        confidenceLegend.style.display = 'block';
        validationLegend.style.display = 'none';
    } else if (settings.EdgeColor == 'Validation') {
        confidenceLegend.style.display = 'none';
        validationLegend.style.display = 'block';
    } else if (settings.EdgeColor == 'None') {
        confidenceLegend.style.display = 'none';
        validationLegend.style.display = 'none';
    }

    Graph.linkColor(link => {
        if (settings.EdgeColor == 'Score') {
        return colorScale(link.score);
        } else if (settings.EdgeColor == 'Validation') {
        return link.type == "STRING" ? STRING_COLOR : GO_COLOR;
        } else if (settings.EdgeColor == 'None') {
        return '#f2f2f2';
        }
    })
    Graph.refresh && Graph.refresh();
}

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
}

function startDataLoad(){
    resetGraph();

    // reset chart svgs and table
    d3.select("#score-histogram").selectAll("*").remove();
    d3.select("#radar-chart").selectAll("*").remove();
    d3.select("#radar-chart").selectAll(".selected-link-line").remove();
    d3.select(".term-chart").selectAll("*").remove();
    if ($.fn.DataTable.isDataTable('#data-table')) {
      $('#data-table').DataTable().destroy();
      $('#data-table tbody').empty();  
    }

    // updateLinkCount(minLimit, maxLimit);
    reloadGraphData()
    settings.MinLinks = minLimit;
    settings.MaxLinks = maxLimit
}

// update graph with new data
function addGraphData(dataPart, reset = false){

    if(reset){
      console.log("resetting...")
      resetGraph();
      console.log("reset done.")
    }

    const linkedNodeIds = new Set();
    dataPart.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      linkedNodeIds.add(sourceId);
      linkedNodeIds.add(targetId);
    });

    dataPart.nodes = dataPart.nodes.filter(n => linkedNodeIds.has(n.id));

    const { nodes, links } = Graph.graphData();

    let newNodes = [];
    let oldNodes = [];
    let nodesFound = [];
    if(nodes.length !== 0){
      nodes.forEach(n => {
        const oldNVals = [...dataPart.nodes].filter(newN => (newN.id === n.id))[0]

        if(!oldNVals || oldNVals.length === 0){
          oldNodes.push(n)
        } else{
          nodesFound.push(n.id);
          const oldLinkVals = [...dataPart.links].filter(newL => (newL.source === n.id) || (newL.target === n.id))

          // let inLinks = [];
          // let outLinks = [];
          oldLinkVals.forEach(inoutl => {
            if(n.id === inoutl.source)
              n.out_degree.push(inoutl.target)
            else if (n.id === inoutl.target)
              n.in_degree.push(inoutl.source)
          })

          n.out_degree = [...new Set(n.out_degree)];
          n.in_degree = [...new Set(n.in_degree)];

          // n.in_degree += inLinks;
          // n.out_degree += outLinks;

          n.links = [...n.links, ...oldLinkVals]
          n.neighbors = [...new Set([...n.neighbors, ...oldNVals.neighbors])]
          n.showLable = false;
          oldNodes.push(n)
        }


      })
      newNodes = dataPart.nodes.filter(newN => !(nodesFound.includes(newN.id)))
    }else{
      newNodes = dataPart.nodes
    }

    const result = {
      nodes: [...oldNodes, ...newNodes ],
      links: links.concat(dataPart.links)//[...links, ...dataPart.links ]
    };

    dataPart.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target
      if (!adjacency[sourceId]) adjacency[sourceId] = new Set();
      if (!adjacency[targetId]) adjacency[targetId] = new Set();
      adjacency[sourceId].add(targetId);
      adjacency[targetId].add(sourceId);
    });

    getConnectedComponents(result.nodes, adjacency);
    assignLinkCurvature(result.links);

    const nlen = result.nodes ? new Set(result.nodes).size : 0;
    const llen = result.links ? getUniqueLinks(result.links).length : 0;

    // Sijax.request("getProteinStats")
    setStats(nlen, llen);
    if (currTable == 'Nodes') populateNodeTable(newNodes);
    else if (currTable == 'Verified Links') populateVerifiedLinkTable(dataPart.links);
    else if (currTable == 'Unverified Links') populateUnverifiedLinkTable(dataPart.links);

    // counting verified/unverifed links for GUI
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let totalLinks = dataPart.links.length;

    dataPart.links.forEach(link => {
      if (link.scores && link.type != "STRING") {
        unverifiedCount++;
      } else {
        verifiedCount++; 
      }
    })
    
    const stringPercent = ((verifiedCount / totalLinks) * 100).toFixed(1);
    const goPercent = ((unverifiedCount / totalLinks) * 100).toFixed(1);

    if (existingControllers.hasOwnProperty('Verified')) {
      folder6.remove(existingControllers['Verified']);
    }
    const verifiedLabel = `Verified (${stringPercent}%)`;
    const verifiedController = folder6.add(activeGroups, 'Verified').name(verifiedLabel).onChange(updateLinkGroups);
    existingControllers['Verified'] = verifiedController;

    if (existingControllers.hasOwnProperty('Unverified')) {
      folder6.remove(existingControllers['Unverified']);
    }
    const unverifiedLabel = `Not verified (${goPercent}%)`;
    const unverifiedController = folder6.add(activeGroups, 'Unverified').name(unverifiedLabel).onChange(updateLinkGroups);
    existingControllers['Unverified'] = unverifiedController;
    folder6.open();

    // adding limit for graph size for user study
    // if (Graph.graphData().nodes.length >= 200 && !pauseAnimation) {
    //   pauseAnimation = true;
    // }

    Graph.graphData(result);
    if (currLayout === 'Spherical') {
      applySphericalLayout(result.nodes);
    }
    updateHighlight();

    drawConfidenceHistogram();
    drawRadarChart();
    drawTermChart("BP");
    drawTermChart("MF");
    drawTermChart("CC");

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

      // if (node.clusterColor) {
      //   const haloSphere = new THREE.Mesh(
      //     new THREE.SphereGeometry(radius * 4.3, 24, 24),
      //     new THREE.MeshBasicMaterial({
      //       color: node.clusterColor,
      //       transparent: true,
      //       opacity: 0.3,
      //       depthWrite: false
      //     })
      //   );
      //   group.add(haloSphere);
      // }

      if (node.showLabel && !isHovered) {
        const sprite = new SpriteText(node.id);
        sprite.color = "white";
        sprite.textHeight = 8;
        sprite.position.y = radius * 2;
        group.add(sprite);
      }

      return group;
    });

    // adding logos and title
    // document.getElementById("logo-images").style.paddingTop = (elem.offsetHeight-100).toString()+"px";
    // document.getElementById("logo-images").style.paddingLeft = (elem.offsetWidth/1.37).toString()+"px";
    // document.getElementById("logo-images").style.visibility = "visible";
    // document.getElementById("title").style.width = elem.offsetWidth.toString()+"px"
}