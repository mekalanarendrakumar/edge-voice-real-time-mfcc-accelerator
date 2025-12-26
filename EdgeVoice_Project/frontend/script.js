// Download Wake Word Dataset Button
const downloadWakeWordDatasetBtn = document.getElementById('downloadWakeWordDatasetBtn');
if (downloadWakeWordDatasetBtn) {
    downloadWakeWordDatasetBtn.onclick = () => {
        window.open('http://localhost:8000/download_wakeword_dataset', '_blank');
    };
}
// Wake Word List Panel Logic
const wakeWordList = document.getElementById('wakeWordList');
const refreshWakeWordListBtn = document.getElementById('refreshWakeWordListBtn');

async function fetchWakeWordList() {
    try {
        const res = await fetch('http://localhost:8000/list_wakewords');
        const data = await res.json();
        wakeWordList.innerHTML = '';
        if (data.wakewords && data.wakewords.length > 0) {
            data.wakewords.forEach(w => {
                const li = document.createElement('li');
                li.textContent = `${w.label} (${w.count} sample${w.count > 1 ? 's' : ''})`;
                wakeWordList.appendChild(li);
            });
        } else {
            wakeWordList.innerHTML = '<li>No wake words trained yet.</li>';
        }
    } catch (e) {
        wakeWordList.innerHTML = '<li style="color:#f00;">Error loading wake word list.</li>';
    }
}

refreshWakeWordListBtn.onclick = fetchWakeWordList;
window.addEventListener('DOMContentLoaded', fetchWakeWordList);
// Command History Panel Logic
const commandHistoryList = document.getElementById('commandHistoryList');
let commandHistory = [];
function addCommandToHistory(command) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    commandHistory.unshift({ command, time: timeStr });
    // Limit to last 20 commands
    if (commandHistory.length > 20) commandHistory.pop();
    renderCommandHistory();
}
function renderCommandHistory() {
    commandHistoryList.innerHTML = '';
    commandHistory.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `[${item.time}] ${item.command}`;
        commandHistoryList.appendChild(li);
    });
}
// Wake Word Training Modal Logic
const trainModal = document.getElementById('wakeWordTrainModal');
const trainBtn = document.getElementById('trainWakeWordBtn');
const closeTrainModalBtn = document.getElementById('closeTrainModalBtn');
const startTrainRecordBtn = document.getElementById('startTrainRecordBtn');
const saveWakeWordBtn = document.getElementById('saveWakeWordBtn');
const wakeWordLabelInput = document.getElementById('wakeWordLabelInput');
const trainStatus = document.getElementById('trainStatus');
let trainRecorder = null, trainChunks = [], trainAudioBlob = null;

trainBtn.onclick = () => {
    trainModal.style.display = 'flex';
    trainStatus.textContent = '';
    wakeWordLabelInput.value = '';
    trainAudioBlob = null;
};
closeTrainModalBtn.onclick = () => {
    trainModal.style.display = 'none';
};
startTrainRecordBtn.onclick = async () => {
    if (!trainRecorder || trainRecorder.state === 'inactive') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        trainRecorder = new MediaRecorder(stream);
        trainChunks = [];
        trainRecorder.ondataavailable = e => trainChunks.push(e.data);
        trainRecorder.onstop = () => {
            trainAudioBlob = new Blob(trainChunks, { type: 'audio/wav' });
            trainStatus.textContent = 'Sample recorded. Ready to save.';
        };
        trainRecorder.start();
        trainStatus.textContent = 'Recording... Click again to stop.';
        startTrainRecordBtn.textContent = 'Stop Recording';
    } else {
        trainRecorder.stop();
        startTrainRecordBtn.textContent = 'Record Sample';
    }
};
saveWakeWordBtn.onclick = () => {
    const label = wakeWordLabelInput.value.trim();
    if (!label) {
        trainStatus.textContent = 'Please enter a label for the wake word.';
        return;
    }
    if (!trainAudioBlob) {
        trainStatus.textContent = 'Please record a sample first.';
        return;
    }
    trainStatus.textContent = 'Saving...';
    const formData = new FormData();
    formData.append('file', trainAudioBlob, 'wakeword.wav');
    formData.append('label', label);
    fetch('http://localhost:8000/train_wakeword', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            trainStatus.textContent = 'Error: ' + data.error;
        } else {
            trainStatus.textContent = 'Wake word saved!';
        }
    })
    .catch(err => {
        trainStatus.textContent = 'Error sending sample: ' + err;
    });
};
// Show MFCC coefficients and wake word detection in console panel
function updateMFCCConsole(mfcc, command) {
    const consoleElem = document.getElementById('mfccConsole');
    if (!consoleElem || !mfcc || !mfcc.length) return;
    let text = 'Initializing MFCC Accelerator...\nProcessing PCM Samples...\n';
    // Show first 3 frames as example
    for (let i = 0; i < Math.min(3, mfcc.length); i++) {
        text += 'MFCC Coefficients: ' + mfcc[i].map(x => Math.round(x)).join(', ') + '\n';
    }
    if (command) {
        text += '\x1b[33mWake Word Detected!\x1b[0m\n';
        text += 'Listening for Next Command...\n';
    }
    consoleElem.textContent = text;
}
// Draw MFCC line graph with wake word highlight
function drawMFCCLineGraph(mfcc, wakeWordFrameRange) {
    const canvas = document.getElementById('mfccLineGraph');
    if (!canvas || !mfcc || !mfcc.length) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rows = mfcc.length, cols = mfcc[0].length;
    // Find min/max for scaling
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const v = mfcc[i][j];
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
        }
    }
    // Draw wake word highlight if detected (styled like image)
    if (wakeWordFrameRange) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffff80';
        const x0 = Math.floor(wakeWordFrameRange[0] / rows * canvas.width);
        const x1 = Math.floor(wakeWordFrameRange[1] / rows * canvas.width);
        ctx.fillRect(x0, 0, x1 - x0, canvas.height);
        ctx.globalAlpha = 1.0;
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#222';
        ctx.textAlign = 'center';
        ctx.fillText('Wake Word Detected!', (x0 + x1) / 2, 50);
        ctx.restore();
    }
    // Draw MFCC coefficient lines
    const colors = ['#ff0','#f00','#0f0','#00f','#0ff','#f0f','#fff','#fa0','#0af','#a0f','#af0','#f05','#5f0','#05f'];
    for (let j = 0; j < cols; j++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[j % colors.length];
        for (let i = 0; i < rows; i++) {
            const x = i / rows * canvas.width;
            const y = canvas.height - ((mfcc[i][j] - minVal) / (maxVal - minVal) * canvas.height);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    // Draw axes (styled)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, canvas.height - 30);
    ctx.lineTo(canvas.width - 10, canvas.height - 30);
    ctx.stroke();
    // Y axis label
    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.fillText('MFCC Coefficients', 0, 0);
    ctx.restore();
    // X axis label
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.fillText('Frame Index', canvas.width / 2, canvas.height - 5);
}
// Download MFCC as CSV
document.getElementById('downloadMFCCBtn').onclick = function() {
    if (!window.lastMFCCData) {
        alert('No MFCC data to download.');
        return;
    }
    const mfcc = window.lastMFCCData;
    let csv = '';
    for (let i = 0; i < mfcc.length; i++) {
        csv += mfcc[i].join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfcc.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Download MFCC heatmap as PNG
document.getElementById('downloadGraphBtn').onclick = function() {
    const canvas = document.getElementById('mfccHeatmap');
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfcc_heatmap.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// UI Elements
const recordBtn = document.getElementById('recordBtn');
const statusDiv = document.getElementById('status');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const extractBtn = document.getElementById('extractBtn');
const waveformCanvas = document.getElementById('waveform');
const mfccHeatmapCanvas = document.getElementById('mfccHeatmap');
const mfccStats = document.getElementById('mfccStats');
const downloadAudioBtn = document.getElementById('downloadAudioBtn');
let mediaRecorder, audioChunks = [], lastAudioBlob = null;
let liveMFCCInterval = null;
let liveMFCCData = [];

// Download Audio Button
downloadAudioBtn.onclick = function() {
    if (!lastAudioBlob) {
        alert('No audio to download. Please record or select a file first.');
        return;
    }
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audio.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Record Button
recordBtn.onclick = async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        liveMFCCData = [];
        // Simulate live MFCC data
        liveMFCCInterval = setInterval(() => {
            // Generate random MFCC frame (simulate 13 coefficients)
            const frame = Array.from({length: 13}, () => Math.round(Math.random() * 2000 - 1000));
            liveMFCCData.push(frame);
            // Show live MFCC heatmap and line graph
            drawMFCCHeatmap(liveMFCCData);
            drawMFCCLineGraph(liveMFCCData);
        }, 120);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            clearInterval(liveMFCCInterval);
            liveMFCCInterval = null;
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            lastAudioBlob = audioBlob;
            statusDiv.textContent = 'Recording complete. Ready to extract MFCC.';
            drawWaveform(audioBlob);
            showAudioPlayer(audioBlob);
        };
        mediaRecorder.start();
        statusDiv.textContent = 'Recording...';
        recordBtn.textContent = 'Stop Recording';
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = 'Record Voice';
    }
};

// Choose File Button
chooseFileBtn.onclick = () => fileInput.click();
fileInput.onchange = () => {
    if (fileInput.files.length > 0) {
        lastAudioBlob = fileInput.files[0];
        statusDiv.textContent = 'File selected. Ready to extract MFCC.';
        drawWaveform(lastAudioBlob);
        showAudioPlayer(lastAudioBlob);
    }
};

// Show audio player for playback
function showAudioPlayer(blob) {
    const container = document.getElementById('audioPlayerContainer');
    if (!container) return;
    // Remove previous audio player
    container.innerHTML = '';
    const url = URL.createObjectURL(blob);
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    audio.style.verticalAlign = 'middle';
    // Custom controls: rewind, play/pause, fast-forward
    const controlsDiv = document.createElement('div');
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '10px';
    // Rewind button
    const rewindBtn = document.createElement('button');
    rewindBtn.textContent = '⏪ 5s';
    rewindBtn.onclick = () => { audio.currentTime = Math.max(0, audio.currentTime - 5); };
    // Play/Pause button
    const playPauseBtn = document.createElement('button');
    playPauseBtn.textContent = '⏯';
    playPauseBtn.onclick = () => {
        if (audio.paused) audio.play();
        else audio.pause();
    };
    // Fast-forward button
    const forwardBtn = document.createElement('button');
    forwardBtn.textContent = '5s ⏩';
    forwardBtn.onclick = () => { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); };
    controlsDiv.appendChild(rewindBtn);
    controlsDiv.appendChild(playPauseBtn);
    controlsDiv.appendChild(forwardBtn);
    container.appendChild(audio);
    container.appendChild(controlsDiv);
}

// Extract MFCC Button
extractBtn.onclick = () => {
    if (!lastAudioBlob) {
        statusDiv.textContent = 'No audio to process.';
        return;
    }
    statusDiv.textContent = 'Extracting MFCC...';
    const formData = new FormData();
    formData.append('file', lastAudioBlob, 'audio.wav');
    fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            statusDiv.textContent = 'Error: ' + data.error;
            return;
        }
        statusDiv.innerHTML = '<span>MFCC extracted successfully</span>';
            statusDiv.innerHTML = '<span style="background:linear-gradient(90deg,#0ff,#f0f,#ff0);padding:2px 10px;border-radius:8px;font-weight:bold;color:#222;box-shadow:0 0 12px #0ff,0 0 24px #f0f;">MFCC extracted successfully</span>';
        if (data.mfcc) {
            drawMFCCHeatmap(data.mfcc);
            showMFCCStats(data.mfcc);
            window.lastMFCCData = data.mfcc; // Save for download
            // Show MFCC shape if available, highlighted
            let shapeStr = '';
            if (data.mfcc_shape && Array.isArray(data.mfcc_shape)) {
                shapeStr = `[${data.mfcc_shape.join(", ")}]`;
            } else if (Array.isArray(data.mfcc) && Array.isArray(data.mfcc[0])) {
                shapeStr = `[${data.mfcc.length}, ${data.mfcc[0].length}]`;
            }
                if (shapeStr) {
                    statusDiv.innerHTML += ` | <span style="background:linear-gradient(90deg,#f0f,#ff0,#0ff);padding:2px 10px;border-radius:8px;font-weight:bold;color:#fff;box-shadow:0 0 16px #ff0,0 0 32px #f0f;">MFCC shape: ${shapeStr}</span>`;
            }
            // Draw MFCC line graph with wake word highlight
            let wakeWordFrameRange = null;
            if (data.command && data.mfcc_shape && data.mfcc_shape.length > 0) {
                // For demo, highlight middle 20% frames if wake word detected
                const totalFrames = data.mfcc_shape[0];
                const start = Math.floor(totalFrames * 0.35);
                const end = Math.floor(totalFrames * 0.55);
                wakeWordFrameRange = [start, end];
            }
            drawMFCCLineGraph(data.mfcc, wakeWordFrameRange);
            // Show MFCC coefficients and wake word detection in console
            updateMFCCConsole(data.mfcc, data.command);
            if (data.command) {
                addCommandToHistory(data.command);
            }
        }
        // Show detected wake word/command in a dedicated panel
        const wakeWordResult = document.getElementById('wakeWordResult');
        if (wakeWordResult) {
            if (data.command) {
                wakeWordResult.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:80px;">
                    <span style="background:rgba(255,255,128,0.8);padding:18px 40px;border-radius:12px;font-size:2em;font-weight:bold;color:#222;box-shadow:0 0 16px #ff0;">Wake Word Detected!</span>
                </div>`;
            } else {
                wakeWordResult.innerHTML = `<span style="color:#0ff;font-size:1.3em;">No wake word detected.</span>`;
            }
        }
    })
    .catch(err => {
        statusDiv.textContent = 'Error sending audio: ' + err;
    });
};

// Draw waveform on canvas
function drawWaveform(blob) {
    const ctx = waveformCanvas.getContext('2d');
    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    const reader = new FileReader();
    reader.onload = function(e) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.decodeAudioData(e.target.result, buffer => {
            const data = buffer.getChannelData(0);
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            const step = Math.ceil(data.length / waveformCanvas.width);
            for (let i = 0; i < waveformCanvas.width; i++) {
                const min = Math.min(...data.slice(i * step, (i + 1) * step));
                const max = Math.max(...data.slice(i * step, (i + 1) * step));
                ctx.moveTo(i, (1 - min) * 50);
                ctx.lineTo(i, (1 - max) * 50);
            }
            ctx.stroke();
        });
    };
    reader.readAsArrayBuffer(blob);
}

// Draw MFCC heatmap (dummy, expects 2D array)
function drawMFCCHeatmap(mfcc) {
    const ctx = mfccHeatmapCanvas.getContext('2d');
    ctx.clearRect(0, 0, mfccHeatmapCanvas.width, mfccHeatmapCanvas.height);
    if (!mfcc || !mfcc.length) return;
    const rows = mfcc.length, cols = mfcc[0].length;
    // Use log-mel energies (dB values) for color mapping
    // If you want to use MFCCs, replace mfcc with logMel
    let minDB = Infinity, maxDB = -Infinity;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const v = mfcc[i][j];
            if (v < minDB) minDB = v;
            if (v > maxDB) maxDB = v;
        }
    }
    // Clamp color scale to [-100, 20] dB for typical log-mel
    minDB = Math.max(minDB, -100);
    maxDB = Math.min(maxDB, 20);
    const canvasW = mfccHeatmapCanvas.width;
    const canvasH = mfccHeatmapCanvas.height;
    const xScale = cols / canvasW;
    const yScale = rows / canvasH;
    const imgData = ctx.createImageData(canvasW, canvasH);
    function dBToColor(dB) {
        // Map dB to color: purple (-100) to yellow (20)
        const norm = (dB - minDB) / (maxDB - minDB);
        // Use a simple colormap: purple->red->yellow
        const r = Math.round(255 * norm);
        const g = Math.round(64 * norm);
        const b = Math.round(255 * (1 - norm));
        return [r, g, b];
    }
    for (let y = 0; y < canvasH; y++) {
        for (let x = 0; x < canvasW; x++) {
            const mfccY = Math.floor(y * yScale);
            const mfccX = Math.floor(x * xScale);
            const dB = mfcc[mfccY][mfccX];
            const [r, g, b] = dBToColor(dB);
            const idx = (y * canvasW + x) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
            imgData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    // (Removed: do not draw dB numbers over the main heatmap)

    // Draw colorbar legend on right side (styled like 2nd image)
    const legendW = 18, legendH = canvasH - 20;
    const legendX = canvasW - legendW - 10;
    const legendY = 10;
    // Draw colorbar
    for (let y = 0; y < legendH; y++) {
        const frac = 1 - y / legendH;
        const dB = minDB + frac * (maxDB - minDB);
        const [r, g, b] = dBToColor(dB);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(legendX, legendY + y, legendW, 1);
    }
    // Draw dB tick marks and labels
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const numTicks = 6;
    for (let i = 0; i < numTicks; i++) {
        const frac = i / (numTicks - 1);
        const y = legendY + Math.round((1 - frac) * legendH);
        const dB = minDB + frac * (maxDB - minDB);
        // Tick mark
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(legendX + legendW, y);
        ctx.lineTo(legendX + legendW + 8, y);
        ctx.stroke();
        // Label
        ctx.fillText(`${Math.round(dB)}`, legendX + legendW + 12, y);
    }
    // Top and bottom labels
    ctx.font = '14px Arial';
    ctx.fillText('-DB', legendX + legendW + 12, legendY + 8);
    ctx.fillText('DB', legendX + legendW + 12, legendY + legendH - 8);

    // Overlay color-coded dB values outside the colorbar for clarity
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < legendH; i += Math.floor(legendH / 20)) {
        const frac = 1 - i / legendH;
        const dB = minDB + frac * (maxDB - minDB);
        // Color code: yellow for high, blue for low, orange for mid
        let color;
        if (dB > 0) color = 'rgba(255,255,100,1)';
        else if (dB > -40) color = 'rgba(255,180,80,1)';
        else color = 'rgba(80,180,255,1)';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        ctx.fillText(`${Math.round(dB)}`, legendX + legendW + 40, legendY + i);
        ctx.shadowBlur = 0;
    }
}

// Show MFCC statistics
function showMFCCStats(mfcc) {
    if (!mfcc || !mfcc.length) {
        mfccStats.textContent = '';
        return;
    }
    const mfccArr = mfcc;
    const mean = mfccArr.map(row => row.reduce((a, b) => a + b, 0) / row.length);
    const std = mfccArr.map((row, i) => Math.sqrt(row.reduce((a, b) => a + (b - mean[i]) ** 2, 0) / row.length));

    // Energy: mean of first MFCC coefficient (C0 or log energy)
    let energy = null;
    if (Array.isArray(mfccArr) && mfccArr.length > 0 && Array.isArray(mfccArr[0])) {
        // C0 is usually the first coefficient
        energy = mfccArr.map(row => row[0]).reduce((a, b) => a + b, 0) / mfccArr.length;
    }

    // Duration: estimate from number of frames (rows) and typical frame stride (10ms)
    const frameStrideSec = 0.01; // 10ms
    const durationSec = mfccArr.length * frameStrideSec;

    mfccStats.textContent =
        'MFCC Mean (first 5): ' + mean.slice(0, 5).map(x => x.toFixed(3)).join(', ') + '\n' +
        'MFCC Std (first 5): ' + std.slice(0, 5).map(x => x.toFixed(3)).join(', ') + '\n' +
        (energy !== null ? ('Energy (mean C0): ' + energy.toFixed(3) + '\n') : '') +
        'Duration (s): ' + durationSec.toFixed(2);
}
