import os 
import torch
import functools
from flask import Flask, request, jsonify

from dscript.models.interaction import DSCRIPTModel
from dscript.language_model import lm_embed

torch.load = functools.partial(torch.load, weights_only=False)

device = "cuda" if torch.cuda.is_available() else "cpu"
app = Flask(__name__)

model = "topsy_turvy_v1.sav"
MODEL_PATH = os.path.join(os.getcwd(), "models", model)
print(f"Loading {model} to {device}...")
model = torch.load(MODEL_PATH, map_location=device)
model.to(device)
model.eval()

@app.route('/predict_pair', methods=['POST'])
def predict_pair():
    try:
        data = request.json
        seq_a = str(data['seq_a']).upper().strip().replace(" ", "")
        seq_b = str(data['seq_b']).upper().strip().replace(" ", "")
        
        with torch.no_grad():
            z_a = lm_embed(seq_a, use_cuda=torch.cuda.is_available()).to(device)
            z_b = lm_embed(seq_b, use_cuda=torch.cuda.is_available()).to(device)
            
            probability = model.predict(z_a, z_b)
            cmap, _ = model.map_predict(z_a, z_b)

            if torch.is_tensor(probability):
                probability = probability.item()

        heatmap_data = cmap.cpu().numpy().squeeze().tolist() if cmap is not None else []

        return jsonify({
            "score": float(probability),
            "heatmap": heatmap_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)