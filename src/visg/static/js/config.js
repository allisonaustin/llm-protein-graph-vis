// colors 
const STRING_COLOR = "#40B0A6";
const GO_COLOR = "#E1BE6A";
const PRED_COLOR = "#D41159";  
const HIGH_CONF_COLOR = "#1A85FF"; 
const AVG_COLOR = "#44AA99";
const FOCUS_COLOR = "#00a2ff";
const COLOR_SCALE = [PRED_COLOR, HIGH_CONF_COLOR];
const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10);
const color8 = "#F3A9"; // for redefining color shades
const colorScale = d3.scaleLinear()
    .domain([0, 1.0])  
    .range(COLOR_SCALE);
const NODE_TABLE_COLS = ["Protein IDs", "Link Count", "ENSP_full", "ClusterID"];
const LINK_TABLE_COLS = ["ProteinA", "ProteinB", "Score", "Lookup", "Species", "ProteinA_full", "ProteinB_full"];