document.getElementById('ppi-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    let formData = new FormData();
    formData.append('file', file);

    fetch('/upload_ppi', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        addGraphData(data, true);
        setStats(data.nodes.length, data.links.length);
    })
    .catch(error => console.error('Error:', error));
});