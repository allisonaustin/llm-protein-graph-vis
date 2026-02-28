// set up vis for GUI
var numLayers = 4; // for concentric spherical layout
var clusterColors = false; // cluster colors on/off

//Define GUI and functions
const Settings = function() {
    this.ShowHighlights = true;
    this.ShowLinkDirections = false;
    this.ShowNodeNeighbors = false;
    this.ShowNodeInfo = false;
    this.MaxDepth = 2;
    this.MaxLinks = 3000;
    this.showAlLinks = true;
    this.NodeDistance = collisonStrengthVal;
    this.Layout = currLayout;
    this.NumLayers = numLayers;
    //this.ShowClusterColors = clusterColors;
    this.FocusDepth = 1;
    this.PruningMode = 'Neighborhood';
};  

const settings = new Settings();
const gui = new dat.GUI();

const guiContainer = document.getElementById('gui-container') || document.body;
guiContainer.appendChild(gui.domElement);

var layerController = null;

var folder3 = gui.addFolder('GUI Buttons');
var folder4 = gui.addFolder('Filtering');

folder3.add({ 'Zoom to Fit': zoomToFit }, 'Zoom to Fit');
folder3.add({ 'Clear Selection': clearSelection }, 'Clear Selection');
folder3.add(settings, 'ShowHighlights')
    .name('Show Highlights')
    .onChange(toggleHighlights);
folder3.add(settings, 'ShowLinkDirections')
    .name('Show Link Directions')
    .onChange(toggleLinkAnimation);
folder3.add(settings, 'ShowNodeNeighbors')
    .name('Show Node Neighbors')
    .onChange(showNodeNeighbors);
// folder3.add(settings, 'ShowClusterColors')
//     .name('Show Cluster Colors')
//     .onChange(toggleClusterColors);
folder3.open()

const pruningController = folder4.add(settings, 'PruningMode', ['Global', 'Neighborhood'])
    .name('Pruning Mode')
const depthController = folder4.add(settings, 'MaxDepth', 0, 20)
    .step(1)
    .name('MaxDepth')
const linksController = folder4.add(settings, 'MaxLinks', 0, maxLimit).step(1)
    .onChange(applyLinkFilters);
folder4.open();

function toggleDepthControl() {
    const depthRow = depthController.domElement.parentElement.parentElement;
    const maxLinksRow = linksController.domElement.parentElement.parentElement;

    if (settings.PruningMode === 'Neighborhood') {
        depthRow.style.display = ''; 
        maxLinksRow.style.display = 'none';
    } else {
        depthRow.style.display = 'none'; 
        maxLinksRow.style.display = '';
        clearPruning();
        applyLinkFilters();
    }
}

pruningController.onChange((value) => {
    toggleDepthControl();
});

depthController.onChange(applyNeighborhoodPruning);
toggleDepthControl();

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
    // folder4.open();
}