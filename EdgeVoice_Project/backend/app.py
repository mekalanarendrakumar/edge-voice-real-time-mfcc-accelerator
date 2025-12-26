

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
from flask_cors import CORS



app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
    from mfcc import mfcc
    from command_detect import detect_command
    try:
        # If MP3, convert to WAV using pydub
        if filename.lower().endswith('.mp3'):
            from pydub import AudioSegment
            mp3_audio = AudioSegment.from_file(filepath, format='mp3')
            wav_path = filepath + '.wav'
            mp3_audio.export(wav_path, format='wav')
            filepath = wav_path
        # Only accept WAV files after conversion
        if not filepath.lower().endswith('.wav'):
            return jsonify({'error': 'Only WAV and MP3 files are supported. Please upload a .wav or .mp3 file.'}), 400
        rate, signal = wav.read(filepath)
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

if __name__ == '__main__':
    app.run(debug=True, port=8000)
