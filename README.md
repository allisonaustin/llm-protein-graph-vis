# Visualizing Dynamically Generated Protein Interactions

A Python library for visualizing dynamically generated protein interactions using 3D node-link layout.

[DEMO Video](https://anl.box.com/s/l41whhxnbtnp65prqsclcbru5ek6l5q0)

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

4. The data file in dot file format should be stored in
   ```
   ./src/visg/static/data/
   ```

5. Start server
   ```
   ./start-local.sh
   ```

6. Open browser (Google Chrome preferred)
    ```angular2html
    http://127.0.0.1:5001/index
    ```

## Instructions to start the server

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
   

### References 
1. Libraries used: [D3](https://d3js.org), [Flask](https://flask.palletsprojects.com/en/stable/),  [3d-force-graph](https://github.com/vasturiano/3d-force-graph?tab=readme-ov-file)
