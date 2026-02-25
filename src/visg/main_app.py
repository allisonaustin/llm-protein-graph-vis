from visg import app
from flask import render_template
from flask import Flask, g
from flask import request, jsonify, current_app
import flask_sijax
from visg import data_path, master_file, data_part_width, master_filename, new_data_master_filename, watchFlag, min_link_count, max_link_count
# from visg.scripts.listener import Listener
from visg.scripts.graph_processor import Protein_Graph

import re
import os
from os import listdir
from os.path import isfile, join
import json
import pygraphviz
from pygraphviz import AGraph
import networkx as nx
from networkx.readwrite import json_graph
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time
import io
import itertools
import requests


def check_file_updates(obj_response):

    if watchFlag:

        all_lines = Protein_Graph.wc_l(data_path, master_filename)
        processed_line_counts = Protein_Graph.processed_line_counts
        print("processed_line_counts, all_lines",processed_line_counts, all_lines)

        if processed_line_counts < all_lines:

            lines = []
            with open(os.path.join(data_path, master_filename), "r") as f:
                a = processed_line_counts-1
                a = (abs(a)+a)//2
                lines = [line for line in itertools.islice(f, a, all_lines)]

            with open(os.path.join(data_path, new_data_master_filename), "w") as f:
                if "digraph" not in lines[0]:
                    f.write("digraph G {\n")
                for line in lines:
                    f.write(line)

                processed_line_counts = all_lines
            finalK = Protein_Graph.get_graph(min_link_count, max_link_count, new_data_master_filename, True, False)
            print(f'new final counter value is {finalK}')
            obj_response.script("updateStopAt("+str(finalK)+")")

        elif processed_line_counts > all_lines : # trigger a reset when data lines are deleted (which happens when file is reloaded)
            toggle_listener(False)
            finalK = Protein_Graph.get_graph(min_link_count, max_link_count, master_filename, True, True)
            toggle_listener(True)
            obj_response.script("reloadGraphData(reset = true, stopAt = "+str(finalK)+")")

def toggle_listener(watch):
   watchFlag = watch

def read_from_dot(dot_file):
    A = AGraph(string=open(dot_file).read())
    G = nx.DiGraph(A)
    dict_json_ = json_graph.node_link_data(G)
    return dict_json_

def get_graph_partions(obj_response, filename, reset):
    f = open(os.path.join(data_path,"graph_master_part"+str(data_part_width)+"_"+str(int(filename)+1)+".json"))
    data_partition = json.load(f)
    obj_response.script("addGraphData("+str(data_partition)+","+reset+")")

def get_graph_partition(obj_response, filename, reset):
    index = int(filename)
    if not hasattr(g, 'partitions'):
        g.partitions = Protein_Graph.get_graph_()
    if index < len(g.partitions):
        data_partition = g.partitions[index]
    else:
        data_partition = {"nodes": [], "links": []}
    obj_response.script("addGraphData(" + json.dumps(data_partition) + "," + str(reset).lower() + ")")

def set_nodelink_limit(obj_response, minlink_count, maxlink_count):
    toggle_listener(False)
    Protein_Graph.minlink_count = minlink_count
    Protein_Graph.maxlink_count = maxlink_count
    finalK = Protein_Graph.get_graph(minlink_count, maxlink_count, master_filename, True, True)
    toggle_listener(True)
    obj_response.script("reloadGraphData(reset = true, stopAt = "+str(finalK)+")")

def get_protein_stats(obj_response):
    print(master_filename)

    f = open(os.path.join(data_path, master_filename))
    s=f.read().replace("-", "_" ).replace("_>", "->")
    f.close()

    clean_master_file = "clean_stats_"+master_filename

    with open(os.path.join(data_path, clean_master_file), 'w') as f:
        f.write(s)

    try:
        A = AGraph(string=open(os.path.join(data_path,clean_master_file)).read())
    except ValueError:
        with open(os.path.join(data_path, clean_master_file), 'r') as f:
            print("Error while retrieving stats lines read are -> ", f.readlines())
    except:
        print("file reading failed at stats")
    else:
        G = nx.DiGraph(A)


    nlen = len(list(G.nodes))
    llen = len(list(G.edges))

    obj_response.script("setStats("+str(nlen)+","+str(llen)+")")

def get_pdb_mappings(ensp_ids):
    mapping = {}
    for ensp_id in ensp_ids:
        url = f"https://rest.ensembl.org/xrefs/id/{ensp_id}?external_db=PDB;content-type=application/json"
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                pdb_list = [item['primary_id'] for item in data]
                mapping[ensp_id] = pdb_list
            else:
                mapping[ensp_id] = []
        except Exception:
            mapping[ensp_id] = []
            
    return mapping

@app.route('/api/list-presets')
def list_presets():
    directory = os.path.join(current_app.static_folder, 'data')
    if not os.path.exists(directory):
        return jsonify([])
    
    files = [f for f in os.listdir(directory) if f.endswith(('.csv', '.tsv', '.txt'))]
    return jsonify(files)

@app.route('/upload_ppi', methods=['POST'])
def upload_ppi():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    
    file = request.files['file']
    maxLimit = request.form.get('maxLimit', type=int, default=3000)
    nodes_map = {}
    links = []
    
    try:
        count = 0
        for line_binary in file:
            line = line_binary.decode('utf-8').strip()
            
            # Skip empty lines or header
            if not line or line.startswith('protein1'):
                continue
                
            parts = line.split()
            if len(parts) < 3:
                continue
                
            p1, p2, score_str = parts[0], parts[1], parts[2]
            
            try:
                score = int(score_str)
            except ValueError:
                continue

            # Filtering by confidence
            if score >= 500:
                if p1 not in nodes_map: 
                    nodes_map[p1] = {"id": p1, "origin": file.filename, "originType": "File", "clusterColor": "#00a2ff"}
                if p2 not in nodes_map: 
                    nodes_map[p2] = {"id": p2, "origin": file.filename, "originType": "File", "clusterColor": "#00a2ff"}
                
                links.append({
                    "source": p1, 
                    "target": p2, 
                    "score": score/1000.0, 
                    "origin": file.filename,
                    "originType": "File",
                })
                count += 1
            
            if count >= maxLimit:
                break
        
        result = {"nodes": list(nodes_map.values()), "links": links}
        return jsonify(result)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/')
def hello():
    return render_template("index_main.html")

@flask_sijax.route(app, '/index')
def index():
    return render_template("index_main_3D.html")