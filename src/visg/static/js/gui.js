// set up vis for GUI
var numLayers = 4; // for concentric spherical layout
var edgeColor = 'Score'; // default edge color
var clusterColors = true; // cluster colors on/off

//Define GUI and functions
const Settings = function() {
    this.ShowLinkDirections = false;
    this.ShowNodeNeighbors = false;
    this.ShowNodeInfo = false;
    this.redDistance = 10000;
    this.MinLinks = minLimit;
    this.MaxLinks = maxLimit;
    this.showAlLinks = true;
    this.NodeDistance = collisonStrengthVal;
    this.Layout = currLayout;
    this.NumLayers = numLayers;
    this.EdgeColor = edgeColor;
    this.clusterColors = clusterColors;
};  

const settings = new Settings();
const gui = new dat.GUI();

const guiContainer = document.getElementById('gui-container') || document.body;
guiContainer.appendChild(gui.domElement);

// var folder2 = gui.addFolder('Sparse Layout Settings');
// const controllerTwo = folder2.add(settings, 'MinLinks', 0, 20000);
// const controllerThree = folder2.add(settings, 'MaxLinks', 0, 4000000);
// folder2.add({ 'Enter': updateLinkCount }, 'Enter');
// folder2.open();

var layerController = null;

var folder3 = gui.addFolder('GUI Buttons');
var folder6 = gui.addFolder('Edge Filtering');
var folder5 = gui.addFolder('Settings');

folder3.add({ 'Zoom to Fit': zoomToFit }, 'Zoom to Fit');
// folder3.add({ showAllLinks: () => {
//   Graph.linkVisibility(() => true); 
//   d3.selectAll('.legend-item').classed('selected', true);
// }}, 'showAllLinks').name('Show All Links');
folder3.add({ 'Clear Highlights': clearHighlights }, 'Clear Highlights');
// folder3.add({ 'Show Link Directions': toggleLinkAnimation }, 'Show Link Directions');
// folder3.add({ 'Show Link Width': toggleLinkWidth }, 'Show Link Width');
// folder3.add({ 'Show Node Neighbors': showNodeNeighbors }, 'Show Node Neighbors');
folder3.add(settings, 'ShowLinkDirections')
    .name('Show Link Directions')
    .onChange(toggleLinkAnimation);
folder3.add(settings, 'ShowNodeNeighbors')
    .name('Show Node Neighbors')
    .onChange(showNodeNeighbors);
// folder3.add(settings, 'ShowNodeInfo')
//      .name('Show Protein Information')
//      .onChange(showNodeInformation);
// folder3.add({ 'Load File': startDataLoad }, 'Load File');
// folder3.add({ 'Pause/Resume Data Reload': pauseResumeDataLoad }, 'Pause/Resume Data Reload');
folder3.open()

folder5.add(settings, 'EdgeColor', ['Score', 'Validation', 'None']).onChange(updateLinkColor);
folder5.add(settings, 'Layout', ['Force-Directed', 'Spherical']).onChange(val => {

    if (layerController) {
    folder5.remove(layerController);
    layerController = null;
}
if (val === 'Force-Directed') {
    applyForceDirectedLayout();
    currLayout = 'Force-Directed';
} else if (val === 'Spherical') {
    applySphericalLayout(Graph.graphData().nodes);
    Graph.graphData(Graph.graphData());
    currLayout = 'Spherical';

    // adding controller for the number of layers in the Concentric Spherical layout
    layerController = folder5
    .add(settings, "NumLayers", 1, 10, 1)
    .name('Layers')
        .onChange(val => {
            numLayers = val;
            applySphericalLayout(Graph.graphData().nodes, val);
            Graph.graphData(Graph.graphData());
        });
    layerController.setValue(settings.NumLayers);
}
});
folder5.open()

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

const exportBtn = document.getElementById('export-btn');
exportBtn.addEventListener('click', () => {
    const guiSettings = getGuiSettings([folder3, folder5, folder6]);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(guiSettings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "ppi_graph_settings.json");
    dlAnchor.click();
});