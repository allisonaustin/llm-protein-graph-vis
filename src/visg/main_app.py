from visg import app
from flask import render_template
from flask import Flask, g
from flask import request, jsonify, current_app
import flask_sijax
from visg import data_path, \
                master_file, \
                data_part_width, \
                master_filename, \
                new_data_master_filename, \
                watchFlag, \
                min_link_count, \
                max_link_count, \
                go_data_dir

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

from functools import lru_cache 
import torch 
from concurrent.futures import ThreadPoolExecutor

import csv 
from io import StringIO 

import pickle
from goatools.obo_parser import GODag
from goatools.associations import read_gaf
from goatools.semantic import TermCounts, get_info_content, resnik_sim

termcounts = None
ic_map = {}
max_ic = 1.0
go_dag = {}

device = "cuda" if torch.cuda.is_available() else "cpu"
model = {}

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

def create_system_prompt():
    """
    Create the system prompt for protein interaction queries.
    This could be enhanced with additional context or instructions.
    """
    return "You are a helpful assistant specialized in molecular biology and protein interactions. When asked about protein interactions, provide clear, concise lists of interacting proteins with brief explanations. Focus on generating accurate protein names that are commonly used in databases and literature."

def create_user_prompt(protein_name):
    """
    Create the user prompt for a specific protein.
    
    Args:
        protein_name (str): The name of the protein to query about
        
    Returns:
        str: The formatted user prompt
    """
    base_prompt = (
        "List proteins that might interact with {protein}. "
        "Please provide a simple list of protein names (gene symbols/names) "
        "that could potentially interact with {protein}, along with a brief "
        "reason for each interaction. Be specific and accurate in your reasoning."
        "Focus on well-known, documented interactions. "
        "For each interaction, write the interacting protein first, then a dash '-', "
        "then a brief description of the interaction type."
        "Do not repeat {protein} as the interacting protein."
        "Format your response as: INTERACTING_PROTEIN_NAME - brief description of interaction type."
    )
    return base_prompt.format(protein=protein_name)

@app.route('/build_go_dag', methods=['POST'])
def build_go_dag():
    global go_dag
    try: 
        data = request.json
        go_file = data.get('go_file')
        go_dag = GODag(os.path.join(go_data_dir, go_file))
        
        return jsonify({
            "status": "success",
            "filename": go_file,
            "max_ic": max_ic,
            "term_count": len(ic_map)
        })
    except Exception as e:
        print(f"Error building GO DAG: {e}")
        return jsonify({"error": str(e)}, 500)

@app.route('/build_ic', methods=['POST'])
def build_ic():
    global ic_map, termcounts, max_ic

    print("Building Information Content (IC) lookup table...")
    try: 
        data = request.json
        gaf_file = data.get('gaf_file')
        associations = read_gaf(os.path.join(go_data_dir, gaf_file), namespace='BP')
        termcounts = TermCounts(go_dag, associations)
        ic_map = {
            go_id: get_info_content(go_id, termcounts)
            for go_id in termcounts.go2genes.keys()
        }
        max_ic = max(ic_map.values()) if ic_map else 1.0
        
        return jsonify({
            "status": "success",
            "filename": gaf_file,
            "max_ic": max_ic,
            "term_count": len(ic_map)
        })
    except Exception as e:
        print(f"Error building IC: {e}")
        return jsonify({"error": str(e)}, 500)

def extract_go_ids(go_input):
    """
    Regex to extract all GO IDs from a UniProt string.
    Example: 'process [GO:0001]' -> {'GO:0001'}
    """
    if not go_input:
        return set()
    
    if isinstance(go_input, set):
        go_input = "; ".join(list(go_input))
        
    return set(re.findall(r'GO:\d+', go_input))

@lru_cache(maxsize=512)
def get_protein_info(protein_name, species):
    base_url = "https://rest.uniprot.org/uniprotkb/search"
    params = {
        "query": f"{protein_name} AND (organism_id:{species})",
        "format": "tsv",
        "fields": "accession,id,gene_names,go_p,sequence" 
    }
    
    res = {"BP": set(), "MF": set(), "CC": set(), "sequence": "", "geneName": protein_name}
    
    try:
        r = requests.get(base_url, params=params, timeout=10)
        r.raise_for_status()
        
        f = StringIO(r.text)
        reader = csv.DictReader(f, delimiter='\t')
        
        for row in reader:
            res["BP"] = set(row.get("Gene Ontology (biological process)", "").split("; "))
            res["MF"] = set(row.get("Gene Ontology (molecular function)", "").split("; "))
            res["CC"] = set(row.get("Gene Ontology (cellular component)", "").split("; "))
            res["sequence"] = row.get("Sequence", "").strip()
            res["gene_name"] = row.get("Gene Names", protein_name).split(" ")[0]
            return res # Return the first (best) hit
            
    except Exception as e:
        print(f"UniProt error for {protein_name}: {e}")
        
    return res

@lru_cache(maxsize=512)
def get_batch_protein_info(gene_names, species):
    if not gene_names: 
        return {}    
    gene_query = " OR ".join([f"gene:{g}" for g in gene_names])
    base_url = "https://rest.uniprot.org/uniprotkb/search"
    params = {
        "query": f"({gene_query}) AND (organism_id:{species}) AND reviewed:true",
        "format": "tsv",
        "fields": "accession,id,gene_names,go_p,sequence" 
    }
    results = {}
    try:
        r = requests.get(base_url, params=params, timeout=20)
        r.raise_for_status()
        reader = csv.DictReader(StringIO(r.text), delimiter='\t')
        
        for row in reader:
            gene_name = row.get("Gene Names", "").split(" ")[0].upper()
            results[gene_name] = {
                "sequence": row.get("Sequence", ""),
                "BP": set(row.get("Gene Ontology (biological process)", "").split("; ")),
                "gene_name": gene_name
            }
    except Exception as e:
        print(f"Batch UniProt error: {e}")
    return results

@app.route('/api/list-presets')
def list_presets():
    directory = os.path.join(current_app.static_folder, 'data')
    if not os.path.exists(directory):
        return jsonify([])
    
    files = [f for f in os.listdir(directory) if f.endswith(('.csv', '.tsv', '.txt'))]
    return jsonify(files)

@app.route('/api/list-gos')
def list_gos():
    directory = os.path.join(current_app.static_folder, 'data/go_data')
    if not os.path.exists(directory):
        return jsonify([])
    files = [f for f in os.listdir(directory) if f.endswith(('.obo'))]
    return jsonify(files)

@app.route('/api/list-gafs')
def list_gafs():
    directory = os.path.join(current_app.static_folder, 'data/go_data')
    if not os.path.exists(directory):
        return jsonify([])
    
    files = [f for f in os.listdir(directory) if f.endswith(('.gaf'))]
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
    
def check_string_bulk(source_id, suggested_ids, species=9606):
    """
    Checks multiple potential partners against a single source protein in one call.
    Returns a dictionary of {target_id: score}.
    """
    all_ids = [source_id] + suggested_ids
    url = "https://string-db.org/api/json/network"
    
    params = {
        "identifiers": "\r".join(all_ids),
        "species": species
    }

    evidence_map = {
        'escore': 'Experiments',
        'dscore': 'Database',
        'tscore': 'Textmining',
        'ascore': 'Co-expression',
        'pscore': 'Neighborhood',
        'fscore': 'Fusion',
        'gscore': 'Co-occurrence'
    }
    
    found_interactions = {}
    try:
        res = requests.post(url, data=params).json()
        for edge in res:
            target_id = edge['stringId_B'] if edge['stringId_A'] == source_id else edge['stringId_A']
            sub_scores = {k: v for k, v in edge.items() if k in evidence_map and v > 0}
            if sub_scores:
                best_key = max(sub_scores, key=sub_scores.get)
                top_type = evidence_map[best_key]

            found_interactions[target_id] = {
                "score": edge["score"],
                "type": top_type
            }
    except:
        pass
        
    return found_interactions

def get_ensp_from_symbol(symbol, species="9606"):
    """
    Maps a gene symbol or common ID to a STRING protein ID (e.g., 10090.ENSMUSP...).
    """
    url = "https://string-db.org/api/json/get_string_ids"
    
    params = {
        "identifiers": symbol,
        "species": species,
        "limit": 1, 
        "echo_query": 1
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data and len(data) > 0:
            result = data[0]
            preferred_name = result.get('preferredName', '').upper()
            query_item = symbol.upper()

            if (query_item == preferred_name or query_item in preferred_name): 
                return result.get('stringId')
            else:
                return None
        return None
    except Exception as e:
        print(f"Error mapping {symbol}: {e}")
        return None
    
def parse_llm_output(raw_text):
    """
    Parses LLM text to extract protein symbols and their descriptions.
    Expected format: "SYMBOL - description"
    """
    results = []
    lines = raw_text.strip().split('\n')
    pattern = r"(?m)^(?:[\d+\.\-\*\s]*)(?:\*\*)?([A-Za-z0-9_-]+)(?:\*\*)?\s*[-:]\s*(.*)$"

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        match = re.search(pattern, line)
        if match:
            symbol = match.group(1).strip()
            description = match.group(2).strip()
            
            if 2 <= len(symbol) <= 20:
                results.append({
                    "symbol": symbol.upper(), 
                    "description": description
                })
        else:
            words = line.split()
            if words and len(words[0]) > 2 and words[0].isupper():
                results.append({
                    "symbol": words[0].replace(':', '').strip(),
                    "description": " ".join(words[1:]) if len(words) > 1 else "No description provided."
                })
    return results

def clean_llm_response(text):
    pattern = r"((?:^[*-]|\d+\.).*?)(?=\n\n|\Z)" 
    matches = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
    if matches:
        return "\n".join(matches).strip()
    return text

def get_dscript_prediction(gene_a, seq_a, gene_b, seq_b):
    if not seq_a or not seq_b:
        print("Could not find sequences for one or both proteins.")
        return
    
    print(f"Predicting: {gene_a} ({len(seq_a)}aa) x {gene_b} ({len(seq_b)}aa)")
    
    dscript_url = "http://localhost:5050/predict_pair"
    payload = {
        "seq_a": seq_a,
        "seq_b": seq_b,
        "gene_b": gene_b
    }
    response = requests.post(dscript_url, json=payload)
    
    if response.status_code == 200:
        result = response.json()
        return result
    else:
        print(f"API Error: {response.text}")

def parallel_dscript_predict(protein_pairs):
    """
    protein_pairs: list of tuples (gene_a, seq_a, gene_b, seq_b)
    """
    def single_job(pair):
        gene_a, seq_a, gene_b, seq_b = pair
        res = get_dscript_prediction(gene_a, seq_a, gene_b, seq_b)
        return (gene_b, res)

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(single_job, protein_pairs))
    
    return dict(results)

def compute_resnik(bp_a, bp_b):
    global max_ic, termcounts, ic_map
    terms_a = extract_go_ids(bp_a)
    terms_b = extract_go_ids(bp_b)
    
    if not terms_a or not terms_b:
        return 0.0, []

    max_resnik = 0.0
    best_pair = None

    # Calculate Resnik for all pairs
    for a in terms_a:
        for b in terms_b:
            if a in go_dag and b in go_dag:
                score = resnik_sim(a, b, go_dag, termcounts)
                if score > max_resnik:
                    max_resnik = score
                    best_pair = (a, b)

    normalized = round(max_resnik / max_ic, 3) if max_ic > 0 else 0.0
    return normalized, best_pair

def get_resnik_data(pair):
    target_id, bp_a, bp_b = pair
    resnik_val, best_go = compute_resnik(bp_a, bp_b)
    return target_id, (resnik_val, best_go)

@app.route('/api/predict', methods=['POST'])
def predict_interactions():
    data = request.json
    protein_full_id = data.get('protein_id') # e.g., "9606.ENSP00000269305"
    model_name = data.get('model', "llama3.1")
    
    # Extract just the name/symbol for the LLM
    display_name = protein_full_id.split('.')[-1]
    species_prefix = protein_full_id.split('.')[0] if '.' in protein_full_id else "9606"

    response = requests.post('http://localhost:11434/api/chat', json={
        "model": model_name,
        "messages": [
            {"role": "system", "content": create_system_prompt()},
            {"role": "user", "content": create_user_prompt(display_name)}
        ],
        "stream": False
    })
    
    raw_text = response.json().get('message', {}).get('content', '')
    predictions = parse_llm_output(raw_text)
    clean_text = clean_llm_response(raw_text)
    id_map = {} 

    for item in predictions:
        symbol = item['symbol']
        ensp = get_ensp_from_symbol(symbol, species_prefix)
        
        if ensp: 
            if ensp != protein_full_id:
                id_map[ensp] = {
                    "label": symbol,
                    "reasoning": item.get('details') or item.get('description', ''),
                    "details": ''
                }
        else:
            print(f"Skipping hallucination or invalid symbol: {symbol}")

    if not predictions:
        found_genes = re.findall(r'(?:•|\*|-)\s*([A-Z][A-Z0-9]{2,10})', raw_text)
        for gene in set(found_genes): 
            ensp = get_ensp_from_symbol(gene, species_prefix)
            if ensp and ensp != protein_full_id:
                id_map[ensp] = {'id': ensp, 'label': gene, 'reasoning': '', 'details': ''}
    
    # predicted node ids
    target_ids = list(id_map.keys())
    target_symbols = [info['label'] for info in id_map.values()]
    
    # STRING validation
    string_scores = check_string_bulk(protein_full_id, target_ids, species_prefix)

    new_nodes = []
    new_links = []
    prot_a = get_protein_info(protein_full_id, species_prefix)
    target_info = get_batch_protein_info(tuple(target_symbols), species_prefix)

    # D-SCRIPT binding prediction
    pairs_to_predict = []
    if prot_a and prot_a.get('sequence'):
        for tid, info in id_map.items():
            symbol = info['label']
            prot_b = target_info.get(symbol)
            if prot_b and prot_b.get('sequence'):
                pairs_to_predict.append((prot_a.get('geneName', 'A'), prot_a['sequence'], tid, prot_b['sequence']))
    
    dscript_results = parallel_dscript_predict(pairs_to_predict)

    # Resnik-BP
    resnik_tasks = []
    for tid, info in id_map.items():
        symbol = info['label']
        bp_b = target_info.get(symbol, {}).get('BP', set())
        resnik_tasks.append((tid, prot_a.get('BP', set()), bp_b))

    with ThreadPoolExecutor(max_workers=8) as executor:
        resnik_results = dict(list(executor.map(get_resnik_data, resnik_tasks)))
    
    for tid, info in id_map.items():
        dscript_prediction = dscript_results.get(tid, {})
        if dscript_prediction: 
            d_prob = dscript_prediction.get('score', 0.0)
            heatmap = dscript_prediction.get('heatmap', [])
        else:
            d_prob = 0.0 
            heatmap = []

        resnik, best_go_pair = resnik_results.get(tid, (0.0, None))

        shared_bp_text = "No shared GO-BP terms found."
        if best_go_pair:
            go_id = best_go_pair[0]
            go_name = go_dag[go_id].name if go_id in go_dag else "Unknown Term"
            shared_bp_text = f"{go_id}: {go_name}"

        string_data = string_scores.get(tid, {})
        s_score = string_data.get('score', 0.0)
        s_type = string_data.get('type', "No STRING evidence")

        final_score = max(s_score, resnik, d_prob)

        if s_score >= max(resnik, d_prob) and s_score > 0:
            detail_msg = f"STRING Evidence: {s_type}"
        elif d_prob >= resnik and d_prob > 0:
            detail_msg = f"D-SCRIPT Physical Binding (Prob: {d_prob:.2f})"
        else:
            detail_msg = shared_bp_text

        new_nodes.append({
            "id": tid,
            "label": info["label"],
            "origin": model_name,
            "originType": "LLM",
        })

        new_links.append({
            "source": protein_full_id,
            "target": tid,
            "score": round(final_score, 4),
            "string": s_score,
            "resnik": resnik,
            "d_script": d_prob, 
            "shared_BP": shared_bp_text,
            "contact": heatmap,
            "origin": model_name, 
            "originType": "LLM",
            "details": detail_msg
        })

    return jsonify({
        "nodes": new_nodes,
        "links": new_links,
        "clean_text": clean_text
    })

@app.route('/')
def hello():
    return render_template("index_main.html")

@flask_sijax.route(app, '/index')
def index():
    return render_template("index_main_3D.html")