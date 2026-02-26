// colors 
const STRING_COLOR = "#40B0A6";
const GO_COLOR = "#E1BE6A";
const LOW_CONFIDENCE_COLOR = "#D41159";  
const HIGH_CONFIDENCE_COLOR = "#1A85FF"; 
const AVG_COLOR = "#44AA99";
const HIGHLIGHT_COLOR = "#00a2ff";
const COLOR_SCALE = [LOW_CONFIDENCE_COLOR, HIGH_CONFIDENCE_COLOR];
const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10);
const color8 = "#F3A9"; // for redefining color shades
const colorScale = d3.scaleLinear()
    .domain([0, 1.0])  
    .range(COLOR_SCALE);
const NODE_TABLE_COLS = [" ", "Protein IDs", "Link Count", "ENSP_full", "ClusterID"];
const LINK_TABLE_COLS = [" ", "ProteinA", "ProteinB", "Score", "Species", "Lookup", "Details", "ProteinA_full", "ProteinB_full"];