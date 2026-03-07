var go_file;
var gaf_file;
var data_file;

document.getElementById('ppi-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    let formData = new FormData();
    formData.append('file', file);
    formData.append('maxLimit', maxLimit);

    // resetting preset selector
    const selector = document.getElementById('preset-file-selector');
    selector.selectedIndex = 0;

    fetch('/upload_ppi', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        addGraphData(data, true);
        document.getElementById('ppi-upload').value = "";
    })
    .catch(error => console.error('Error:', error));
});

function loadPresetList() {
    const selector = document.getElementById('preset-file-selector');

    fetch('/api/list-presets')
        .then(res => res.json())
        .then(files => {
            files.forEach(filename => {
                const option = document.createElement('option');
                option.value = `${filename}`;
                option.textContent = filename;
                selector.appendChild(option);
            });
        })
        .catch(err => console.error("Error loading presets:", err));
}

document.getElementById('preset-file-selector').addEventListener('change', function() {
    const filePath = this.value;
    const fileName = this.options[this.selectedIndex].text;

    if (!filePath) return;

    document.getElementById('stats').innerHTML = `<i>Fetching...</i>`;

    fetch(`/static/data/${fileName}`)
        .then(response => {
            if (!response.ok) throw new Error('File not found on server');
            return response.blob();
        })
        .then(blob => {
            data_file = fileName;
            let formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('maxLimit', maxLimit);

            return fetch('/upload_ppi', {
                method: 'POST',
                body: formData
            });
        })
        .then(response => response.json())
        .then(data => {
            addGraphData(data, true);
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
        });
});

function triggerBuildGoDag(fileName) {
    console.log(fileName)
    if (!fileName || fileName === "Select GO file") return;
    return fetch('/build_go_dag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ go_file: fileName }) 
    })
    .then(response => response.json())
    .then(data => {
        go_file = data["filename"];
        console.log('GO DAG Built:', go_file);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
    })
}

function triggerBuildIC(fileName) {
    if (!fileName || fileName === "Select GAF") return;
    document.getElementById('prediction-status').innerHTML = "Building IC Map...";
    
    return fetch('/build_ic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gaf_file: fileName })
    })
    .then(response => response.json())
    .then(data => {
        gaf_file = data["filename"];
        console.log('IC Map Built:', gaf_file);
        updatePredictionUI(hoverNode);
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
    });
}

// 2. Update the Loaders to trigger the builds
function loadGOList() {
    const selector = document.getElementById('go-selector');
    fetch('/api/list-gos')
        .then(res => res.json())
        .then(files => {
            files.forEach(filename => {
                const option = document.createElement('option');
                option.value = filename;
                option.textContent = filename;
                selector.appendChild(option);
                
                if (filename === "go-basic.obo") {
                    option.selected = true;
                    triggerBuildGoDag(filename); 
                }
            });
        });
}

function loadGafList() {
    const selector = document.getElementById('gaf-file-selector');
    fetch('/api/list-gafs')
        .then(res => res.json())
        .then(files => {
            files.forEach(filename => {
                const option = document.createElement('option');
                option.value = filename;
                option.textContent = filename;
                selector.appendChild(option);
                
                if (filename === "goa_human.gaf") {
                    option.selected = true;
                    triggerBuildIC(filename); 
                }
            });
        });
}

document.getElementById('go-selector').addEventListener('change', (e) => triggerBuildGoDag(e.target.value));
document.getElementById('gaf-file-selector').addEventListener('change', (e) => triggerBuildIC(e.target.value));

loadPresetList();
loadGOList();
loadGafList();