// EdgeVoice UI Script for new HTML structure with visualization
let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let audioBlob = null;

function drawWaveform(arrayBuffer) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.decodeAudioData(arrayBuffer.slice(0), (audioBuffer) => {
        const rawData = audioBuffer.getChannelData(0);
        const canvas = document.getElementById('waveform');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        const step = Math.ceil(rawData.length / canvas.width);
        const amp = canvas.height / 2;
        for (let i = 0; i < canvas.width; i++) {
            let min = 1.0, max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = rawData[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.lineTo(i, (1 + min) * amp);
        }
        ctx.strokeStyle = '#ff00cc';
        ctx.stroke();
    });
}

function drawMFCCHeatmap(mfcc) {
    const canvas = document.getElementById('mfccHeatmap');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!mfcc || !mfcc.length) return;
    const MAX_FRAMES = 200;
    const rows = Math.min(mfcc.length, MAX_FRAMES);
    const cols = mfcc[0].length;
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const value = mfcc[i][j];
            // Normalize for color mapping
            const norm = (value + 50) / 100;
            ctx.fillStyle = `rgb(${255 * norm}, 0, ${255 * (1 - norm)})`;
            ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
            // Draw dB value for clarity
            ctx.fillStyle = '#fff';
            ctx.fillText(value.toFixed(1), j * cellWidth + cellWidth / 2, i * cellHeight + cellHeight / 2);
        }
    }
}

function drawMFCCLineGraph(mfcc) {
    const canvas = document.getElementById('mfccLineGraph');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!mfcc || !mfcc.length) return;
    const MAX_FRAMES = 200;
    // Draw each coefficient as a line
    const numCoeffs = mfcc[0].length;
    const numFrames = Math.min(mfcc.length, MAX_FRAMES);
    const colors = [
        '#ff00cc', '#00ffff', '#ffff00', '#ff8800', '#00ff00', '#ff0000', '#0000ff',
        '#00ffcc', '#ff0088', '#8888ff', '#ffcc00', '#00ccff', '#cc00ff'
    ];
    for (let coeff = 0; coeff < numCoeffs; coeff++) {
        ctx.beginPath();
        const values = mfcc.slice(0, numFrames).map(row => row[coeff]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        for (let frame = 0; frame < numFrames; frame++) {
            const x = (frame / (numFrames - 1)) * canvas.width;
            // Normalize y to fit canvas
            const y = canvas.height - (((mfcc[frame][coeff] - min) / (max - min + 1e-6)) * canvas.height);
            if (frame === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colors[coeff % colors.length];
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    // Draw legend
    ctx.font = '12px Arial';
    for (let coeff = 0; coeff < Math.min(numCoeffs, colors.length); coeff++) {
        ctx.fillStyle = colors[coeff];
        ctx.fillText('C' + (coeff + 1), 50 + coeff * 50, 15);
    }
}

function showAudioPlayer(blob) {
    const container = document.getElementById('audioPlayerContainer');
    container.innerHTML = '';
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(blob);
    container.appendChild(audio);
}

function showMFCCStats(mfcc) {
    const stats = document.getElementById('mfccStats');
    if (!mfcc || !mfcc.length) {
        stats.textContent = 'No MFCC data.';
        return;
    }
    let min = Infinity, max = -Infinity, sum = 0, count = 0;
    for (const row of mfcc) {
        for (const v of row) {
            if (v < min) min = v;
            if (v > max) max = v;
            sum += v;
            count++;
        }
    }
    const mean = sum / count;
    stats.textContent = `MFCC Stats:\nMin: ${min.toFixed(2)}\nMax: ${max.toFixed(2)}\nMean: ${mean.toFixed(2)}`;
}

window.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('recordBtn');
    const chooseFileBtn = document.getElementById('chooseFileBtn');
    const fileInput = document.getElementById('fileInput');
    const extractBtn = document.getElementById('extractMFCCBtn');
    const status = document.getElementById('status');

    // Record Voice
    recordBtn.onclick = async () => {
        status.textContent = '';
        audioChunks = [];
        recordedBlob = null;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                recordedBlob = new Blob(audioChunks, { type: 'audio/wav' });
                status.textContent = 'Recording stopped.';
                // Draw waveform and show player
                recordedBlob.arrayBuffer().then(drawWaveform);
                showAudioPlayer(recordedBlob);
            };
            mediaRecorder.start();
            recordBtn.disabled = true;
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    recordBtn.disabled = false;
                }
            }, 5000); // Auto-stop after 5 seconds
            status.textContent = 'Recording...';
        } catch (err) {
            status.textContent = 'Microphone access denied.';
        }
    };

    // Choose File
    chooseFileBtn.onclick = () => {
        fileInput.click();
    };
    fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
            audioBlob = fileInput.files[0];
            recordedBlob = null;
            status.textContent = 'File selected: ' + fileInput.files[0].name;
            audioBlob.arrayBuffer().then(drawWaveform);
            showAudioPlayer(audioBlob);
        }
    };

    // Extract MFCC
    extractBtn.onclick = () => {
        status.textContent = '';
        let fileToSend = null;
        if (audioBlob) {
            fileToSend = audioBlob;
        } else if (recordedBlob) {
            fileToSend = recordedBlob;
        } else {
            status.textContent = 'Please record or select an audio file.';
            return;
        }
        const formData = new FormData();
        formData.append('file', fileToSend, 'audio.wav');
        fetch('http://127.0.0.1:8000/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.mfcc) {
                let shapeText = '';
                if (data.mfcc_shape && data.mfcc_shape.length === 2) {
                    shapeText = `MFCC shape: ${data.mfcc_shape[0]} x ${data.mfcc_shape[1]}`;
                } else {
                    shapeText = 'MFCC shape: ' + data.mfcc.length + ' x ' + (data.mfcc[0]?.length || 0);
                }
                status.textContent = shapeText;
                drawMFCCHeatmap(data.mfcc);
                drawMFCCLineGraph(data.mfcc);
                showMFCCStats(data.mfcc);
            } else if (data.error) {
                status.textContent = data.error;
            } else {
                status.textContent = 'Unknown error.';
            }
        })
        .catch(err => {
            status.textContent = 'Failed to connect to backend.';
        });
    };
});
