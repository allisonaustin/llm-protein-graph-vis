document.getElementById('ppi-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    let formData = new FormData();
    formData.append('file', file);

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
        setStats(data.nodes.length, data.links.length);
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
            let formData = new FormData();
            formData.append('file', blob, fileName);

            return fetch('/upload_ppi', {
                method: 'POST',
                body: formData
            });
        })
        .then(response => response.json())
        .then(data => {
            addGraphData(data, true);
            setStats(data.nodes.length, data.links.length);
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('stats').innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
        });
});

loadPresetList();