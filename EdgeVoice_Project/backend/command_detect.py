# Command detection logic placeholder
def detect_command(mfcc_features):
    import numpy as np
    import os
    # Load stored MFCC patterns
    model_dir = os.path.join(os.path.dirname(__file__), '../models')
    commands = ['light_on', 'light_off', 'fan_on']
    min_dist = float('inf')
    detected = None
    for cmd in commands:
        model_path = os.path.join(model_dir, f'{cmd}.mfcc')
        if not os.path.exists(model_path):
            continue
        try:
            model_mfcc = np.loadtxt(model_path)
            # Compare using Euclidean distance (mean over frames)
            dist = np.linalg.norm(np.mean(mfcc_features, axis=0) - np.mean(model_mfcc, axis=0))
            if dist < min_dist:
                min_dist = dist
                detected = cmd
        except Exception as e:
            continue
    return detected
