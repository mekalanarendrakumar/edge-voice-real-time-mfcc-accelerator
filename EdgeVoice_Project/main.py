import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from scipy.fftpack import dct
from pydub import AudioSegment

app = Flask(__name__)
CORS(app)

def extract_mfcc(signal, sample_rate, num_ceps=13, nfft=512, nfilt=26):
    pre_emphasis = 0.97
    emphasized_signal = np.append(signal[0], signal[1:] - pre_emphasis * signal[:-1])
    frame_size = 0.025
    frame_stride = 0.01
    frame_length, frame_step = int(round(frame_size * sample_rate)), int(round(frame_stride * sample_rate))
    signal_length = len(emphasized_signal)
    num_frames = int(np.ceil(float(np.abs(signal_length - frame_length)) / frame_step))
    pad_signal_length = num_frames * frame_step + frame_length
    z = np.zeros((pad_signal_length - signal_length))
    pad_signal = np.append(emphasized_signal, z)
    indices = np.tile(np.arange(0, frame_length), (num_frames, 1)) + \
              np.tile(np.arange(0, num_frames * frame_step, frame_step), (frame_length, 1)).T
    frames = pad_signal[indices.astype(np.int32, copy=False)]
    frames *= np.hamming(frame_length)
    mag_frames = np.absolute(np.fft.rfft(frames, nfft))
    pow_frames = ((1.0 / nfft) * (mag_frames ** 2))
    low_freq_mel = 0
    high_freq_mel = (2595 * np.log10(1 + (sample_rate / 2) / 700))
    mel_points = np.linspace(low_freq_mel, high_freq_mel, nfilt + 2)
    hz_points = (700 * (10**(mel_points / 2595) - 1))
    bin = np.floor((nfft + 1) * hz_points / sample_rate)
    fbank = np.zeros((nfilt, int(np.floor(nfft / 2 + 1))))
    for m in range(1, nfilt + 1):
        f_m_minus = int(bin[m - 1])
        f_m = int(bin[m])
        f_m_plus = int(bin[m + 1])
        for k in range(f_m_minus, f_m):
            fbank[m - 1, k] = (k - bin[m - 1]) / (bin[m] - bin[m - 1])
        for k in range(f_m, f_m_plus):
            fbank[m - 1, k] = (bin[m + 1] - k) / (bin[m + 1] - bin[m])
    filter_banks = np.dot(pow_frames, fbank.T)
    filter_banks = np.where(filter_banks == 0, np.finfo(float).eps, filter_banks)
    filter_banks = 20 * np.log10(filter_banks)
    mfcc = dct(filter_banks, type=2, axis=1, norm='ortho')[:, :num_ceps]
    return mfcc

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    try:
        audio = AudioSegment.from_file(file)
        audio = audio.set_channels(1).set_frame_rate(16000)
        samples = np.array(audio.get_array_of_samples()).astype(np.float32)
        mfcc_features = extract_mfcc(samples, 16000)
        mfcc_features = np.atleast_2d(mfcc_features)
        print("DEBUG: mfcc_features.shape =", mfcc_features.shape)
        return jsonify({'mfcc': mfcc_features.tolist()})
    except Exception as e:
        print("DEBUG: Exception in /upload:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return jsonify({'status': 'EdgeVoice backend running'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
from flask import Flask, request, jsonify
from flask_cors import CORS
import librosa
import numpy as np
import os
import tempfile

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return "EdgeVoice Backend Running"

@app.route("/extract-mfcc", methods=["POST"])
def extract_mfcc():
    try:
        if "audio" not in request.files:
            return jsonify({"error": "No audio file"}), 400

        audio_file = request.files["audio"]

        # Save temp audio
        temp_dir = tempfile.mkdtemp()
        audio_path = os.path.join(temp_dir, audio_file.filename)
        audio_file.save(audio_path)

        # Load audio
        y, sr = librosa.load(audio_path, sr=16000)

        # Extract MFCC
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)

        return jsonify({
            "status": "success",
            "mfcc_shape": mfcc.shape,
            "frames": mfcc.shape[1]
        })

    except Exception as e:
        print("MFCC ERROR:", e)
        return jsonify({"status": "failed", "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)