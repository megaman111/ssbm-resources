import json, zipfile, re, sys

with zipfile.ZipFile('animation-zips/fox.zip') as z:
    data = json.loads(z.read('AttackAirB.json'))
    print(f"Type: {type(data)}, len: {len(data)}")
    if isinstance(data, list):
        for i, frame in enumerate(data):
            print(f"  frame {i}: type={type(frame)}, keys={list(frame.keys()) if isinstance(frame, dict) else 'N/A'}")
            if i >= 3:
                break
