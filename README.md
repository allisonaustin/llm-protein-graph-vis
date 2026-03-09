# Visualizing Dynamically Generated Protein Interactions

A Python library for visualizing dynamically generated protein interactions using 3D node-link layout.

<!-- [DEMO Video](https://anl.box.com/s/l41whhxnbtnp65prqsclcbru5ek6l5q0) -->

## Installation

1. Clone the github repository


2. Requires `anaconda` and `python=3.8`

   ```
   conda create -n myenv python=3.8
   conda activate myenv
   ```
3. Install packages
    ```
    cd src/
    pip install -r requirements.txt
    ```
Note: You may need to install [pygraphvis](https://pygraphviz.github.io/documentation/stable/install.html) using conda forge:
`conda install --channel conda-forge pygraphviz` (This may need a restart of your command prompt or terminal)

## Data

The network data files (.txt, .csv) should be stored in
   ```
   ./src/visg/static/data/
   ```
   The [Gene Ontology files](https://geneontology.org/docs/download-ontology/) (.GO) and [Gene Annotation files](https://current.geneontology.org/products/pages/downloads.html) (.GAF) should be stored in 
   ```
   ./src/visg/static/data/go_data/
   ```

   Pre-trained models (.sav) for running [D-SCRIPT](https://dscript.csail.mit.edu/) should be stored in 
   ```
   ./src/visg/models/
   ```
   These can be downloaded from [here](https://d-script.readthedocs.io/en/main/data.html)

## Instructions to start the visualization server

1. Change directory to `./src`

   ```
   cd /path/to/project/src
   ```

2. Activate conda environment

   ```
   conda activate myenv
   ```
   
3. Start server
   ```
   ./start-local.sh
   ```

4. Open browser (Google Chrome preferred)
    ```angular2html
    http://127.0.0.1:5001/index
    ```

## Instructions to start LLM
To enable LLM graph updates, you need to set up an [Ollama](https://ollama.com/) endpoint for the application. Go to [this link](https://docs.ollama.com/quickstart) for a quick set up. Our experiments used Llama 3.1 (8B) model. Make sure your model is running on the default port: ```http://localhost:11434/api/chat```. 

## Instructions to start the D-SCRIPT server

1. Open terminal, change directory to `./src/visg`

   ```
   cd /path/to/project/src/visg
   ```

2. Activate conda environment 

   ```
   conda activate myenv
   ```

3. Start server
   ``` 
   python dscript_app.py
   ```

### References 
1. Libraries used: [D3](https://d3js.org), [Flask](https://flask.palletsprojects.com/en/stable/),  [3d-force-graph](https://github.com/vasturiano/3d-force-graph?tab=readme-ov-file), [GOATOOLS](https://github.com/tanghaibao/goatools), [D-SCRIPT](https://github.com/samsledje/D-SCRIPT/tree/main)
