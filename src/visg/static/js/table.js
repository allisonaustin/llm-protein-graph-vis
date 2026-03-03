var currTableInstance = null;
var searchQuery = null;

const scoreFields = ['nscore', 'fscore', 'pscore', 'ascore', 'escore', 'dscore', 'tscore'];
const scoreInfo = {
    nscore: 'Gene neighborhood',
    fscore: 'Gene fusion',
    pscore: 'Phylogenetic profile',
    ascore: 'Co-expression',
    escore: 'Experiments',
    dscore: 'Databases',
    tscore: 'Text mining'
};

const getProteinUrl = (symbol) => `https://www.uniprot.org/uniprotkb?query=${symbol}`;

function rebuildTable(columns) {
    if ($.fn.DataTable.isDataTable('#data-table')) {
      $('#data-table').DataTable().destroy();
      $('#data-table tbody').empty();
    }

    // building new header
    const headerRow = $('#table-header-row');
    headerRow.empty();
    columns.forEach(col => headerRow.append(`<th>${col}</th>`));

    // initialize new DataTable
    currTableInstance = $('#data-table').DataTable({
      paging: false,
      searching: true,
      lengthChange: false,
      info: false,
      scrollY: $('#table-container').height(),
      scrollX: true,
      scrollCollapse: true,
      columnDefs: [ // hide the last two columns (full node ID, cluster) or (sourceId, targetId)
        { targets: [columns.length - 2, columns.length - 1], visible: false, searchable: true }
      ]
    });

    if (searchQuery) {
      currTableInstance.search(searchQuery).draw();
    }

    // saving searches
    currTableInstance.on('search.dt', function() {
      searchQuery = currTableInstance.search();
    });
}

function populateNodeTable(newNodes) {
    const dataTable = $('#data-table').DataTable();

    // checking new cluster assignment of existing nodes
    dataTable.rows().every(function(rowIdx, tableLoop, rowLoop) {
        const rowData = this.data();
        const nodeId = rowData[NODE_TABLE_COLS.length-2]; 
        const node = newNodes.concat(Graph.graphData().nodes).find(n => n.id === nodeId);
        if (node) { 
            this.data(rowData);
        }
    });

    newNodes.forEach(node => {
        const existing = dataTable.rows().data().toArray().some(row => row[1] === node.id);
        if (!existing) {
            const inD = Array.isArray(node.in_degree) ? node.in_degree.length : 0;
            const outD = Array.isArray(node.out_degree) ? node.out_degree.length : 0;
            const totalLinks = inD + outD;
            const nodeId = node.id.split('.')[1]? node.id.split('.')[1] : node.id; // 10090.ENSMUSP00000000312 -> ENSMUSP00000000312
            const nodeUrl = `<a href="${getProteinUrl(node.id)}" target="_blank" style="text-decoration: none;">${nodeId} <i class="bi bi-box-arrow-up-right" style="font-size:0.7em;"></i></a>`;
            // const clusterCell = `<div style="display:flex; justify-content:flex-end;"><span style="width:10px;height:10px;background-color:${node.clusterColor};border-radius:50%;opacity:0.5;"></span></div>`;           
            dataTable.row.add([
              // clusterCell, 
              nodeUrl, 
              totalLinks, 
              node.id, // hidden
              `cluster ${node.clusterId}` // hidden
            ]);
        }
    });
    $('#data-table tbody').off('click', 'tr');
    $('#data-table tbody').on('click', 'tr', function () {
        const rowData = dataTable.row(this).data();
        const row = dataTable.row(this).node();
        if (rowData && rowData[NODE_TABLE_COLS.length-2]) {
          searchAndFocusNode(rowData[NODE_TABLE_COLS.length-2]);  
          $('#data-table tbody tr.highlight-node').removeClass('highlight-node');
          $(row).addClass('highlight-node');
        }
    });
    dataTable.draw();
}

function populateLinkTable(links) {
    const dataTable = $('#data-table').DataTable();

    $('#data-table tbody').off('click', 'tr');

    $('#data-table tbody').on('click', 'tr', function () {
      const rowData = dataTable.row(this).data();
      const row = dataTable.row(this).node();
      if (rowData) {
        const sourceId = rowData[LINK_TABLE_COLS.length - 2];
        const targetId = rowData[LINK_TABLE_COLS.length - 1];
        searchAndFocusLink(sourceId, targetId);
        $('#data-table tbody tr.highlight-node').removeClass('highlight-node');
        $(row).addClass('highlight-node');
      }
    });

    const data = links.map(link => {
        const source = typeof link.source === 'object' ? link.source.id : link.source;
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        const sourceId = source.split('.')[1]? source.split('.')[1] : source;
        const targetId = target.split('.')[1]? target.split('.')[1] : target;

        const score = link.score != null ? link.score : 0;
        const color = colorScale ? colorScale(score) : 'white';

        const srcNode = Graph.graphData().nodes.find(n => n.id === source);
       // const clusterCell = srcNode ? `<div style="display:flex; justify-content:flex-end;"><span style="width:10px;height:10px;background-color:${srcNode.clusterColor || '#00a2ff'};border-radius:50%;opacity:0.5;"></span></div>` : '-';

        const details = link.details ? link.details : `${scoreInfo[link.origin] || link.origin}`;

        const species = source.split('.')[0] || '9606'; 

        const dataRef = `https://string-db.org/cgi/network?identifiers=${encodeURIComponent(source)}%0d${encodeURIComponent(target)}&species=${species}`;
        const sourceDataUrl = `<a href="${dataRef}" class="data-link" style="color: #00a2ff;" target="_blank" rel="noopener noreferrer">STRING</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>`;

        return [
            // clusterCell, 
            sourceId,
            link.originType == "LLM" ? `<span class="gene-link" font-weight: bold;">${targetId}</span>` : targetId,
            `<span style="color: ${color}; font-weight: bold;">${score.toFixed(3)}</span>`,
            details || '',
            sourceDataUrl, // lookup
            species,
            source, // hidden
            target, // hidden
        ];
    });
    dataTable.rows.add(data).draw();
}

// Highlights row in table when node is clicked in the graph
function highlightNodeTableRow(nodeId) {
    const table = $('#data-table').DataTable();
    
    table.rows().nodes().to$().removeClass('highlight-node');
    table.rows().every(function() {
        const data = this.data();
        if (data[NODE_TABLE_COLS.length-2] === nodeId) {
            const rowNode = this.node();
            $(rowNode).addClass('highlight-node');
            rowNode.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    });
}

// Highlights row in link table when link is clicked in the graph
function highlightLinkTableRow(link) {
    const table = $('#data-table').DataTable();
    
    table.rows().nodes().to$().removeClass('highlight-node');
    table.rows().every(function() {
        const data = this.data();
        const sourceCell = data[LINK_TABLE_COLS.length - 2];
        const targetCell = data[LINK_TABLE_COLS.length - 1];
        if ((sourceCell === link.source.id && targetCell === link.target.id) || 
            (sourceCell === link.target.id && targetCell === link.source.id)) {
            const rowNode = this.node();
            $(rowNode).addClass('highlight-node');
            rowNode.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    });
}

function filterTableByNode(nodeId) {
    const table = $('#data-table').DataTable();
    table.search('').columns().search();

    if (!nodeId) {
        return;
    }

    const escapedId = nodeId.replace(/\./g, '\\.'); 

    if (currTable === 'Nodes') {
        table.column(2).search(`^${escapedId}$`, true, false).draw();
    } else {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const sourceCell = data[LINK_TABLE_COLS.length - 2];
                const targetCell = data[LINK_TABLE_COLS.length - 1];
                return sourceCell === nodeId || targetCell === nodeId;
            }
        );
        table.draw();
        $.fn.dataTable.ext.search.pop();
    }
}

// TODO: keep track of selected node/link in table to prevent searching on tab switch
function applyHighlights() {
    if (!hoverNode && !hoverLink) return;

    const table = $('#data-table').DataTable();
    const isNodeTable = (currTable === 'Nodes');

    table.rows().every(function() {
        const rowData = this.data();
        let shouldHighlight = false;

        if (isNodeTable) {
            shouldHighlight = (rowData[NODE_TABLE_COLS.length-2] === hoverNode);
        } else {
            shouldHighlight = (rowData[LINK_TABLE_COLS.length-2] === hoverNode || rowData[LINK_TABLE_COLS.length-1] === hoverNode);
        }

        if (shouldHighlight) {
            const rowNode = this.node();
            $(rowNode).addClass('highlight-node');            
            rowNode.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    });
}

// tab switching
$('#tab-nodes').on('click', () => {
    $('#tab-nodes').addClass('active-tab');
    $('#tab-links').removeClass('active-tab');
    currTable = 'Nodes';
    rebuildTable(NODE_TABLE_COLS);
    populateNodeTable(Graph.graphData().nodes);
    applyHighlights();
});

$('#tab-links').on('click', () => {
    $('#tab-links').addClass('active-tab');
    $('#tab-nodes').removeClass('active-tab');
    currTable = 'Links';
    rebuildTable(LINK_TABLE_COLS);
    populateLinkTable(Graph.graphData().links);
    applyHighlights();
});

document.getElementById("popout-table").addEventListener("click", () => {
    const tableClone = document.getElementById("data-table").cloneNode(true);
    const win = window.open("", "TableWindow", "width=1200,height=500,resizable=yes,scrollbars=yes");

    win.document.write(`
      <html>
        <head>
          <title>${currTable} Table</title>
          <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            body { font-family: sans-serif; padding: 1rem; background: #f9f9f9; color: #333; }
            table { width: 100% !important; }
            th, td { color: #333; }
            h4 { color: #222; }
          </style>
        </head>
        <body>
          <h4>${currTable} Table</h4>
          <div id="popout-container" style="overflow:auto;"></div>
        </body>
      </html>
    `);

    win.document.close();

    const container = win.document.getElementById("popout-container");
    container.appendChild(tableClone);

    const mainTable = $('#data-table').DataTable();
    const popoutTable = $(tableClone).DataTable({
        data: mainTable.rows({ search: 'applied' }).data().toArray(), 
        columns: mainTable.settings().init().columns.map(c => ({ title: c.title })),
        paging: false,
        searching: true,
        lengthChange: false,
        info: false,
        scrollX: false, 
        autoWidth: true
    });

    if (searchQuery) {
        popoutTable.search(searchQuery).draw();
    }
});

document.getElementById('btn-clear-table').addEventListener('click', function() {
    if (currTableInstance) {
        currTableInstance.search('').columns().search('').draw();
    }
    const mainSearch = document.getElementById('main-search');
    if (mainSearch) mainSearch.value = '';
    searchQuery = '';
});