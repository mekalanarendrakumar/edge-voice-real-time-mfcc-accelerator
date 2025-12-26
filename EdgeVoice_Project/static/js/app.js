document.getElementById('upload-btn').addEventListener('click', async function() {
    const fileInput = document.getElementById('audio-upload');
    const resultText = document.getElementById('result-text');
    if (!fileInput.files.length) {
        resultText.textContent = 'Please select a WAV file.';
        return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    resultText.textContent = 'Uploading...';
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        const data = await response.json();
        resultText.textContent = data.result || 'No result.';
    } catch (err) {
        resultText.textContent = 'Error: ' + err.message;
    }
});
