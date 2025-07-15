from flask import Flask
from flask_cors import CORS
import os
import flask_sijax

path = os.path.join('.', os.path.dirname(__file__), 'static/js/sijax/')

app = Flask(__name__)
CORS(app)
cors = CORS(app, resources={r"/index": {"origins": "*"}})
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['SIJAX_STATIC_PATH'] = path
app.config['SIJAX_JSON_URI'] = '/static/js/sijax/json2.js'
flask_sijax.Sijax(app)

data_path = "./visg/static/data/graph_master_scored" # "./visg/static/data/"
master_filename = "interactions_full_run_static.dot"#"small_data.dot" #interactions_full_run.dot
master_file = os.path.join(data_path, master_filename)
data_part_width = 100
new_data_master_filename = "temp_"+master_filename

watchFlag = True
min_link_count = 0
max_link_count = 3000000

import visg.main_app