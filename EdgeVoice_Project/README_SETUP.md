# EdgeVoice Project Setup Guide

## Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```
   cd EdgeVoice_Project/backend
   ```
2. (Recommended) Create a virtual environment:
   ```
   python -m venv .venv
   .venv\Scripts\activate  # On Windows
   # Or
   source .venv/bin/activate  # On Mac/Linux
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```
   python app.py
   ```
   The server will run at http://localhost:5000/

## Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```
   cd EdgeVoice_Project/frontend
   ```
2. Start a simple HTTP server:
   ```
   python -m http.server 8000
   ```
3. Open your browser and go to:
   ```
   http://localhost:8000/
   ```

## Usage
- Use the web UI to record or upload a WAV file and click "Extract MFCC".
- You should see the waveform, MFCC heatmap, and success message as in the example image.

## Troubleshooting
- Ensure the backend server is running before using the frontend.
- Use only WAV files for upload.
- If you see errors, check the browser console and backend terminal for details.
