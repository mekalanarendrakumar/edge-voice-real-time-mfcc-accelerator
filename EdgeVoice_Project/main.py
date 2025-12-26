
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os

app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# --- API endpoint to download all wake word samples and labels as a zip ---
@app.route('/download_wakeword_dataset', methods=['GET'])
def download_wakeword_dataset():
    import io
    import zipfile
    save_dir = os.path.join(os.path.dirname(__file__), 'wakeword_data')
    if not os.path.exists(save_dir):
        return jsonify({'error': 'No wake word data found.'}), 404
    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add all .npy files
        for fname in os.listdir(save_dir):
            if fname.endswith('.npy') or fname == 'labels.csv':
                fpath = os.path.join(save_dir, fname)
                zf.write(fpath, arcname=fname)
    mem_zip.seek(0)
    return send_file(mem_zip, mimetype='application/zip', as_attachment=True, download_name='wakeword_dataset.zip')

# --- API endpoint to list all trained wake words and sample counts ---
@app.route('/list_wakewords', methods=['GET'])
def list_wakewords():
    from collections import Counter
    save_dir = os.path.join(os.path.dirname(__file__), 'wakeword_data')
    csv_path = os.path.join(save_dir, 'labels.csv')
    if not os.path.exists(csv_path):
        return jsonify({'wakewords': []})
    labels = []
    with open(csv_path, 'r') as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) == 2:
                labels.append(parts[1])
    counter = Counter(labels)
    wakewords = [{'label': label, 'count': count} for label, count in counter.items()]
    return jsonify({'wakewords': wakewords})

@app.route('/')
def index():
    return render_template('index.html')

# --- API endpoint for audio upload and MFCC extraction ---
@app.route('/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    # Process audio: extract MFCC and detect command
    import numpy as np
    import scipy.io.wavfile as wav
    from backend.mfcc import mfcc
    from backend.command_detect import detect_command
    try:
        # Try reading as WAV first
        try:
            rate, signal = wav.read(filepath)
        except Exception:
            # If reading as WAV fails, try converting with pydub
            try:
                from pydub import AudioSegment
            except ImportError:
                return jsonify({'error': 'pydub is not installed on the server.'}), 500
            try:
                audio = AudioSegment.from_file(filepath)
            except Exception as e:
                return jsonify({'error': f'Could not decode audio file: {str(e)}'}), 400
            wav_path = filepath + '.wav'
            audio.export(wav_path, format='wav')
            filepath = wav_path
            try:
                rate, signal = wav.read(filepath)
            except Exception as e:
                return jsonify({'error': f'File could not be read as WAV after conversion: {str(e)}'}), 400
        if hasattr(signal, 'ndim') and signal.ndim > 1:
            signal = signal[:, 0]  # Use first channel if stereo
        mfcc_features = mfcc(signal, rate)
        command = detect_command(mfcc_features)
        # Convert MFCC numpy array to list for JSON and include shape
        mfcc_list = mfcc_features.tolist() if hasattr(mfcc_features, 'tolist') else []
        mfcc_shape = list(mfcc_features.shape) if hasattr(mfcc_features, 'shape') else [0, 0]
        return jsonify({'status': 'processed', 'filename': filename, 'command': command, 'mfcc': mfcc_list, 'mfcc_shape': mfcc_shape})
    except Exception as e:
        import traceback
        print('Error processing audio:', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- API endpoint for wake word training ---
@app.route('/train_wakeword', methods=['POST'])
def train_wakeword():
    if 'file' not in request.files or 'label' not in request.form:
        return jsonify({'error': 'Missing file or label'}), 400
    file = request.files['file']
    label = request.form['label']
    if file.filename == '' or not label:
        return jsonify({'error': 'No selected file or label'}), 400
    filename = secure_filename(label + '_' + file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    # Extract MFCC features from the uploaded sample
    import numpy as np
    import scipy.io.wavfile as wav
    from backend.mfcc import mfcc
    try:
        # Try reading as WAV first
        try:
            rate, signal = wav.read(filepath)
        except Exception:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(filepath)
            wav_path = filepath + '.wav'
            audio.export(wav_path, format='wav')
            filepath = wav_path
            rate, signal = wav.read(filepath)
        if hasattr(signal, 'ndim') and signal.ndim > 1:
            signal = signal[:, 0]  # Use first channel if stereo
        mfcc_features = mfcc(signal, rate)
        # Save MFCC features and label to wakeword_data/
        save_dir = os.path.join(os.path.dirname(filepath), '../wakeword_data')
        os.makedirs(save_dir, exist_ok=True)
        mfcc_path = os.path.join(save_dir, f'{label}_{os.path.splitext(file.filename)[0]}.npy')
        np.save(mfcc_path, mfcc_features)
        # Optionally, append label to a CSV for dataset tracking
        csv_path = os.path.join(save_dir, 'labels.csv')
        with open(csv_path, 'a') as f:
            f.write(f'{os.path.basename(mfcc_path)},{label}\n')
        # --- Automatic model retraining ---
        import glob
        from sklearn import svm
        import joblib
        # Gather all MFCC feature files and labels
        mfcc_files = glob.glob(os.path.join(save_dir, '*.npy'))
        X = []
        y = []
        for mfcc_file in mfcc_files:
            X.append(np.load(mfcc_file).flatten())
            # Get label from CSV
            base = os.path.basename(mfcc_file)
            with open(csv_path, 'r') as f:
                for line in f:
                    fname, lbl = line.strip().split(',')
                    if fname == base:
                        y.append(lbl)
                        break
        if len(X) > 1 and len(X) == len(y):
            clf = svm.SVC(kernel='linear', probability=True)
            clf.fit(X, y)
            model_path = os.path.join(save_dir, 'wakeword_model.pkl')
            joblib.dump(clf, model_path)
            retrain_status = 'Model retrained and saved.'
        else:
            retrain_status = 'Not enough data to retrain model.'
        return jsonify({'status': 'wake word trained', 'filename': filename, 'label': label, 'mfcc_file': os.path.basename(mfcc_path), 'retrain': retrain_status})
    except Exception as e:
        import traceback
        print('Error processing wake word training:', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- API endpoint for real-time wake word detection ---
@app.route('/detect_wakeword', methods=['POST'])
def detect_wakeword():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    import numpy as np
    import scipy.io.wavfile as wav
    from backend.mfcc import mfcc
    import joblib
    try:
        # Try reading as WAV first
        try:
            rate, signal = wav.read(filepath)
        except Exception:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(filepath)
            wav_path = filepath + '.wav'
            audio.export(wav_path, format='wav')
            filepath = wav_path
            rate, signal = wav.read(filepath)
        if hasattr(signal, 'ndim') and signal.ndim > 1:
            signal = signal[:, 0]  # Use first channel if stereo
        mfcc_features = mfcc(signal, rate)
        X = mfcc_features.flatten().reshape(1, -1)
        # Load trained model
        model_path = os.path.join(os.path.dirname(filepath), '../wakeword_data/wakeword_model.pkl')
        if not os.path.exists(model_path):
            return jsonify({'error': 'No trained model found. Please train a wake word first.'}), 400
        clf = joblib.load(model_path)
        pred = clf.predict(X)[0]
        proba = clf.predict_proba(X)[0]
        label_list = clf.classes_.tolist()
        confidence = float(np.max(proba))
        return jsonify({'predicted_label': pred, 'confidence': confidence, 'labels': label_list, 'probabilities': proba.tolist()})
    except Exception as e:
        import traceback
        print('Error in real-time wake word detection:', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os

app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

# --- API endpoint for audio upload and MFCC extraction ---
@app.route('/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    # Process audio: extract MFCC and detect command
    import numpy as np
    import scipy.io.wavfile as wav
    from backend.mfcc import mfcc
    from backend.command_detect import detect_command
    try:
        # Try reading as WAV first
        try:
            rate, signal = wav.read(filepath)
        except Exception:
            # If reading as WAV fails, try converting with pydub
            try:
                from pydub import AudioSegment
            except ImportError:
                return jsonify({'error': 'pydub is not installed on the server.'}), 500
            try:
                audio = AudioSegment.from_file(filepath)
            except Exception as e:
                return jsonify({'error': f'Could not decode audio file: {str(e)}'}), 400
            wav_path = filepath + '.wav'
            audio.export(wav_path, format='wav')
            filepath = wav_path
            try:
                rate, signal = wav.read(filepath)
            except Exception as e:
                return jsonify({'error': f'File could not be read as WAV after conversion: {str(e)}'}), 400
        if hasattr(signal, 'ndim') and signal.ndim > 1:
            signal = signal[:, 0]  # Use first channel if stereo
        mfcc_features = mfcc(signal, rate)
        command = detect_command(mfcc_features)
        # Convert MFCC numpy array to list for JSON and include shape
        mfcc_list = mfcc_features.tolist() if hasattr(mfcc_features, 'tolist') else []
        mfcc_shape = list(mfcc_features.shape) if hasattr(mfcc_features, 'shape') else [0, 0]
        return jsonify({'status': 'processed', 'filename': filename, 'command': command, 'mfcc': mfcc_list, 'mfcc_shape': mfcc_shape})
    except Exception as e:
        import traceback
        print('Error processing audio:', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- API endpoint for wake word training ---
@app.route('/train_wakeword', methods=['POST'])
def train_wakeword():
    if 'file' not in request.files or 'label' not in request.form:
        return jsonify({'error': 'Missing file or label'}), 400
    file = request.files['file']
    label = request.form['label']
    if file.filename == '' or not label:
        return jsonify({'error': 'No selected file or label'}), 400
    filename = secure_filename(label + '_' + file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    # Extract MFCC features from the uploaded sample
    import numpy as np
    import scipy.io.wavfile as wav
    from backend.mfcc import mfcc
    try:
        # Try reading as WAV first
        try:
            rate, signal = wav.read(filepath)
        except Exception:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(filepath)
            wav_path = filepath + '.wav'
            audio.export(wav_path, format='wav')
            filepath = wav_path
            rate, signal = wav.read(filepath)
        if hasattr(signal, 'ndim') and signal.ndim > 1:
            signal = signal[:, 0]  # Use first channel if stereo
        mfcc_features = mfcc(signal, rate)
        # Save MFCC features and label to wakeword_data/
        save_dir = os.path.join(os.path.dirname(filepath), '../wakeword_data')
        os.makedirs(save_dir, exist_ok=True)
        mfcc_path = os.path.join(save_dir, f'{label}_{os.path.splitext(file.filename)[0]}.npy')
        np.save(mfcc_path, mfcc_features)
        # Optionally, append label to a CSV for dataset tracking
        csv_path = os.path.join(save_dir, 'labels.csv')
        with open(csv_path, 'a') as f:
            f.write(f'{os.path.basename(mfcc_path)},{label}\n')
        # --- Automatic model retraining ---
        import glob
        from sklearn import svm
        import joblib
        # Gather all MFCC feature files and labels
        mfcc_files = glob.glob(os.path.join(save_dir, '*.npy'))
        X = []
        y = []
        for mfcc_file in mfcc_files:
            X.append(np.load(mfcc_file).flatten())
            # Get label from CSV
            base = os.path.basename(mfcc_file)
            with open(csv_path, 'r') as f:
                for line in f:
                    fname, lbl = line.strip().split(',')
                    if fname == base:
                        y.append(lbl)
                        break
        if len(X) > 1 and len(X) == len(y):
            clf = svm.SVC(kernel='linear', probability=True)
            clf.fit(X, y)
            model_path = os.path.join(save_dir, 'wakeword_model.pkl')
            joblib.dump(clf, model_path)
            retrain_status = 'Model retrained and saved.'
        else:
            retrain_status = 'Not enough data to retrain model.'
        return jsonify({'status': 'wake word trained', 'filename': filename, 'label': label, 'mfcc_file': os.path.basename(mfcc_path), 'retrain': retrain_status})
    except Exception as e:
        import traceback
        print('Error processing wake word training:', e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)
