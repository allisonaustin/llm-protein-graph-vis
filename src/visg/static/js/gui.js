// set up vis for GUI
var numLayers = 4; // for concentric spherical layout
var clusterColors = true; // cluster colors on/off

//Define GUI and functions
const Settings = function() {
    this.ShowLinkDirections = false;
    this.ShowNodeNeighbors = false;
    this.ShowNodeInfo = false;
    this.MinLinks = minLimit;
    this.MaxLinks = maxLimit;
    this.showAlLinks = true;
    this.NodeDistance = collisonStrengthVal;
    this.Layout = currLayout;
    this.NumLayers = numLayers;
    this.clusterColors = clusterColors;
};  

const settings = new Settings();
const gui = new dat.GUI();

const guiContainer = document.getElementById('gui-container') || document.body;
guiContainer.appendChild(gui.domElement);

var layerController = null;

var folder3 = gui.addFolder('GUI Buttons');
var folder4 = gui.addFolder('Edge Filtering');
// var folder5 = gui.addFolder('Settings');
var folder6 = gui.addFolder('Sparse Layout Settings');

folder3.add({ 'Zoom to Fit': zoomToFit }, 'Zoom to Fit');
folder3.add({ 'Clear Highlights': clearHighlights }, 'Clear Highlights');
folder3.add(settings, 'ShowLinkDirections')
    .name('Show Link Directions')
    .onChange(toggleLinkAnimation);
folder3.add(settings, 'ShowNodeNeighbors')
    .name('Show Node Neighbors')
    .onChange(showNodeNeighbors);
folder3.open()

// folder5.add(settings, 'Layout', ['Force-Directed', 'Spherical']).onChange(val => {
//     if (layerController) {
//         folder5.remove(layerController);
//         layerController = null;
//     }
//     if (val === 'Force-Directed') {
//         applyForceDirectedLayout();
//         currLayout = 'Force-Directed';
//     } else if (val === 'Spherical') {
//         applySphericalLayout(Graph.graphData().nodes);
//         Graph.graphData(Graph.graphData());
//         currLayout = 'Spherical';
//         layerController = folder5
//         .add(settings, "NumLayers", 1, 10, 1)
//         .name('Layers')
//             .onChange(val => {
//                 numLayers = val;
//                 applySphericalLayout(Graph.graphData().nodes, val);
//                 Graph.graphData(Graph.graphData());
//             });
//         layerController.setValue(settings.NumLayers);
//     }
// });
// folder5.open()

folder6.add(settings, 'MinLinks', 0, 20000);
folder6.add(settings, 'MaxLinks', 0, 4000000);
folder6.add({ 'Enter': updateLinkCount }, 'Enter');
folder6.open();

setTimeout(() => {
    document.querySelectorAll('div.dg .cr select').forEach(sel => {
        const cr = sel.closest('.cr');
        if (cr) cr.classList.add('dropdown-controller');
    });
}, 0);

function getGuiSettings(guiFolders) {
    const settings = {};
    guiFolders.forEach(folder => {
        Object.values(folder.__controllers || {}).forEach(controller => {
        settings[controller.property] = controller.getValue();
        });
        Object.values(folder.__folders || {}).forEach(subFolder => {
        Object.assign(settings, getGuiSettings([subFolder]));
        });
    });
    return settings;
}

function updateGUILabels(links) {
    let baseCount = 0;
    let genCount = 0;
    let totalLinks = links.length || 1; 

    links.forEach(link => {
        if (link.originType !== 'File') {
            genCount++;
        } else {
            baseCount++;
        }
    });

    const givenPercent = ((baseCount / totalLinks) * 100).toFixed(1);
    const genPercent = ((genCount / totalLinks) * 100).toFixed(1);

    if (existingControllers.hasOwnProperty('Given')) {
        folder4.remove(existingControllers['Given']);
    }
    const givenLabel = `Given (${givenPercent}%)`;
    existingControllers['Given'] = folder4.add(activeGroups, 'Given').name(givenLabel).onChange(updateLinkGroups);

    if (existingControllers.hasOwnProperty('Generated')) {
        folder4.remove(existingControllers['Generated']);
    }
    const predictedLabel = `Generated (${genPercent}%)`;
    existingControllers['Generated'] = folder4.add(activeGroups, 'Generated').name(predictedLabel).onChange(updateLinkGroups);
    folder4.open();
}

// update graph when max and min links connecting the graph is specified
function updateLinkCount(minLinks = settings.MinLinks, maxLinks = settings.MaxLinks) {
    console.log("Setting min and max node links!", minLinks, maxLinks )
}
