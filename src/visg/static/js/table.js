var currTable = 'Nodes';
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
      scrollCollapse: true
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
        const nodeId = rowData[1]; 
        const node = newNodes.concat(Graph.graphData().nodes).find(n => n.id === nodeId);
        if (node) {
            const clusterCell = `<div style="display:flex; justify-content:flex-end;"><span style="width:10px;height:10px;background-color:${node.clusterColor};border-radius:50%;opacity:0.5;"></span></div>`;            
            rowData[0] = clusterCell; 
            this.data(rowData);
        }
    });
}

function populateVerifiedLinkTable(links) {
    const dataTable = $('#data-table').DataTable();

    $('#data-table tbody').off('click', 'tr');

    $('#data-table tbody').on('click', 'tr', function () {
      const rowData = dataTable.row(this).data();
      if (rowData) {
        const sourceId = rowData[1];
        const targetId = rowData[2];
        searchAndFocusLink(sourceId, targetId);
        const graphLinks = Graph.graphData().links;
        // searching for link in graph data
        const matchedLink = graphLinks.find(link => {
          const src = typeof link.source === 'object' ? link.source.id : link.source;
          const tgt = typeof link.target === 'object' ? link.target.id : link.target;
          return (src === sourceId && tgt === targetId);
        });
      }
    });

    const data = links
      .filter(link => link.type == "STRING")
      .map(link => {
      const source = typeof link.source === 'object' ? link.source.id : link.source;
      const target = typeof link.target === 'object' ? link.target.id : link.target;
      const score = link.score != null ? link.score : 0;
      const color = colorScale(score);

      const srcNode = Graph.graphData().nodes.find(n => n.id === source);
      const clusterCell = srcNode ? `
          <div style="display:flex; justify-content:flex-end;"><span style="width:10px;height:10px;background-color:${srcNode.clusterColor};border-radius:50%;opacity:0.5;"></span></div>` : '-';

      const perSpeciesDetails = link.scores.map(entry => {
        const top = scoreFields
          .map(key => [key, entry[key] ?? 0])
          .sort((a, b) => b[1] - a[1])[0];

        const [topField, topVal] = top;
        const species = entry.ncbiTaxonId;

        return `${scoreInfo[topField]}: ${topVal.toFixed(3)} (species: ${species})`;
      });
      
      details = perSpeciesDetails.join("<br>");
      let chosenSpecies = link.scores[0].ncbiTaxonId;
      const dataRef = `https://string-db.org/cgi/network?identifiers=${encodeURIComponent(source)}%0d${encodeURIComponent(target)}&species=${chosenSpecies}`;
      sourceDataUrl = `<a href="${dataRef}" class="data-link" style="color: ${STRING_COLOR};" target="_blank" rel="noopener noreferrer">STRING</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>`;
      
      return [
        clusterCell, 
        source,
        target,
        `<span style="color: ${color}; font-weight: bold;">${score.toFixed(3)}</span>`,
        sourceDataUrl,
        details,
      ];
    });
    dataTable.rows.add(data).draw();
}

function populateUnverifiedLinkTable(links) {
    const dataTable = $('#data-table').DataTable();

    $('#data-table tbody').off('click', 'tr');

    $('#data-table tbody').on('click', 'tr', function () {
      const rowData = dataTable.row(this).data();
      if (rowData) {
        const sourceId = rowData[1];
        const targetId = rowData[2];
        searchAndFocusLink(sourceId, targetId);
        const graphLinks = Graph.graphData().links;
        // searching for link in graph data
        const matchedLink = graphLinks.find(link => {
          const src = typeof link.source === 'object' ? link.source.id : link.source;
          const tgt = typeof link.target === 'object' ? link.target.id : link.target;
          return (src === sourceId && tgt === targetId);
        });
      }
    });

    const data = links
      .filter(link => link.type != "STRING")
      .map(link => {
      const source = typeof link.source === 'object' ? link.source.id : link.source;
      const target = typeof link.target === 'object' ? link.target.id : link.target;
      const score = link.score != null ? link.score : 0;
      const color = colorScale(score);

      const srcNode = Graph.graphData().nodes.find(n => n.id === source);
      const clusterCell = srcNode ? `
          <div style="display:flex; justify-content:flex-end;"><span style="width:10px;height:10px;background-color:${srcNode.clusterColor};border-radius:50%;opacity:0.5;"></span></div>` : '-';

      let bpDetails = "-";
      let mfDetails = "-";
      let ccDetails = "-";

      // GO case
      const bpTerm = link.scores.BP_terms; 
      if (bpTerm && !Array.isArray(bpTerm) && bpTerm.go_a && bpTerm.go_b) {
        bpDetails = `
          Given: ${bpTerm.go_a.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${bpTerm.go_a.id}" class="data-link" target="_blank" rel="noopener noreferrer">${bpTerm.go_a.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${bpTerm.go_a.species}, IC: ${bpTerm.ic_go_a.toFixed(3)}<br>
          Pred: ${bpTerm.go_b.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${bpTerm.go_b.id}" class="data-link" target="_blank" rel="noopener noreferrer">${bpTerm.go_b.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${bpTerm.go_b.species}, IC: ${bpTerm.ic_go_b.toFixed(3)}<br>
          MICA: ${bpTerm.mica.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${bpTerm.mica.id}" class="data-link" target="_blank" rel="noopener noreferrer">${bpTerm.mica.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, IC: ${bpTerm.ic_mica.toFixed(3)}<br>
        `;
      }

      const mfTerm = link.scores.MF_terms; 
      if (mfTerm && !Array.isArray(mfTerm) && mfTerm.go_a && mfTerm.go_b) {
        mfDetails = `
          Given: ${mfTerm.go_a.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${mfTerm.go_a.id}" class="data-link" target="_blank" rel="noopener noreferrer">${mfTerm.go_a.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${mfTerm.go_a.species}, IC: ${mfTerm.ic_go_a.toFixed(3)}<br>
          Pred: ${mfTerm.go_b.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${mfTerm.go_b.id}" class="data-link" target="_blank" rel="noopener noreferrer">${mfTerm.go_b.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${mfTerm.go_b.species}, IC: ${mfTerm.ic_go_b.toFixed(3)}<br>
          MICA: ${mfTerm.mica.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${mfTerm.mica.id}" class="data-link" target="_blank" rel="noopener noreferrer">${mfTerm.mica.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, IC: ${mfTerm.ic_mica.toFixed(3)}<br>
        `;
      }

      const ccTerm = link.scores.CC_terms; 
      if (ccTerm && !Array.isArray(ccTerm) && ccTerm.go_a && ccTerm.go_b) {
        ccDetails = `
          Given: ${ccTerm.go_a.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${ccTerm.go_a.id}" class="data-link" target="_blank" rel="noopener noreferrer">${ccTerm.go_a.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${ccTerm.go_a.species}, IC: ${ccTerm.ic_go_a.toFixed(3)}<br>
          Pred: ${ccTerm.go_b.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${ccTerm.go_b.id}" class="data-link" target="_blank" rel="noopener noreferrer">${ccTerm.go_b.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, Species: ${ccTerm.go_b.species}, IC: ${ccTerm.ic_go_b.toFixed(3)}<br>
          MICA: ${ccTerm.mica.name} <a href="https://www.ebi.ac.uk/QuickGO/term/${ccTerm.mica.id}" class="data-link" target="_blank" rel="noopener noreferrer">${ccTerm.mica.id}</a> <i class="bi bi-box-arrow-up-right" style="font-size:0.8em;"></i>, IC: ${ccTerm.ic_mica.toFixed(3)}<br>
        `;
      }

      const makeICBar = term => {
        if (!term) return "-";
        if (term && !Array.isArray(term) && term.go_a && term.go_b) {
          // Max width of each bar (pixels)
          const maxWidth = 30;
          const givenWidth = term.ic_go_a * maxWidth;
          const predWidth  = term.ic_go_b * maxWidth;
          const micaWidth  = term.ic_mica * maxWidth;

          return `
            <div style="display:flex; flex-direction:column; gap:2px; height:24px;">
              <div style="background-color:${GO_COLOR}; width:${givenWidth}px; height:15px; border-radius:3px;"></div>
              <div style="background-color:${GO_COLOR}; width:${predWidth}px; height:15px; border-radius:3px;"></div>
              <div style="background-color:${GO_COLOR}; width:${micaWidth}px; height:15px; border-radius:3px"></div>
            </div>
          `;
        } else {
          return "-";
        }
      };

      return [
        clusterCell, 
        source,
        target,
        `<span style="color: ${color}; font-weight: bold;">${score.toFixed(3)}</span>`,
        makeICBar(bpTerm), 
        makeICBar(mfTerm),
        makeICBar(ccTerm),
        bpDetails,
        mfDetails,
        ccDetails
      ];
    });
    dataTable.rows.add(data).draw();
}



// initial load of data tables
rebuildTable([" ", "Protein IDs", "Link Count"]);
currTable = 'Nodes';

// tab switching
$('#tab-nodes').on('click', () => {
    $('#tab-nodes').addClass('active-tab');
    $('#tab-links-ver').removeClass('active-tab');
    $('#tab-links-unver').removeClass('active-tab');
    currTable = 'Nodes';
    rebuildTable([" ", "Protein IDs", "Link Count"]);
    populateNodeTable(Graph.graphData().nodes);
});

$('#tab-links-ver').on('click', () => {
    $('#tab-links-ver').addClass('active-tab');
    $('#tab-links-unver').removeClass('active-tab');
    $('#tab-nodes').removeClass('active-tab');
    currTable = 'Verified Links';
    rebuildTable([" ", "Given", "Pred", "Score", "Source", "Details"]);
    populateVerifiedLinkTable(Graph.graphData().links);
});

$('#tab-links-unver').on('click', () => {
    $('#tab-links-unver').addClass('active-tab');
    $('#tab-links-ver').removeClass('active-tab');
    $('#tab-nodes').removeClass('active-tab');
    currTable = 'Unverified Links';
    rebuildTable([" ", "Given", "Pred", "Score", "BPs", "MFs", "CCs", "Biological Process Details", "Molecular Function Details", "Cellular Component Details"]);
    populateUnverifiedLinkTable(Graph.graphData().links);
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