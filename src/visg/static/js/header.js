var go_file;
var gaf_file;

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

function loadGOList() {
    const selector = document.getElementById('go-selector');

    fetch('/api/list-gos')
        .then(res => res.json())
        .then(files => {
            files.forEach(filename => {
                const option = document.createElement('option');
                option.value = `${filename}`;
                option.textContent = filename;
                selector.appendChild(option);
                if (filename == "go-basic.obo") {
                    go_file = filename;
                    option.selected = true;
                }
            });
        })
        .catch(err => console.error("Error loading GO files:", err));
}

function loadGafList() {
    const selector = document.getElementById('gaf-file-selector');

    fetch('/api/list-gafs')
        .then(res => res.json())
        .then(files => {
            files.forEach(filename => {
                const option = document.createElement('option');
                option.value = `${filename}`;
                option.textContent = filename;
                selector.appendChild(option);
                if (filename == "goa_human.gaf") {
                    option.selected = true;
                    gaf_file = filename;
                    updatePredictionUI(hoverNode);
                }
            });
        })
        .catch(err => console.error("Error loading GAF files:", err));
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

document.getElementById('go-selector').addEventListener('change', function() {
    const fileName = this.options[this.selectedIndex].text;

    if (!fileName || fileName === "Select GO file") return;

    fetch('/build_go_dag', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gaf_file: fileName })
    })
    .then(response => {
        if (!response.ok) throw new Error('Server failed to build IC');
        return response.json();
    })
    .then(data => {
        go_file = data["filename"];
        console.log('IC Map Built successfully');
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
    });
});

document.getElementById('gaf-file-selector').addEventListener('change', function() {
    const fileName = this.options[this.selectedIndex].text;

    if (!fileName || fileName === "Select GAF") return;

    document.getElementById('prediction-status').innerHTML = "Building Information Content (IC) Map... please wait.";

    fetch('/build_ic', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gaf_file: fileName })
    })
    .then(response => {
        if (!response.ok) throw new Error('Server failed to build IC');
        return response.json();
    })
    .then(data => {
        gaf_file = data["filename"];
        updatePredictionUI(hoverNode);
        console.log('IC Map Built successfully');
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
    });
});

loadPresetList();
loadGOList();
loadGafList();