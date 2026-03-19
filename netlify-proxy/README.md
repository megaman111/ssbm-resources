# Slippi Proxy - Netlify Function

CORS proxy that lets the GitHub Pages site fetch character animation zips from slippilab.com.

## Deploy steps

1. Go to https://app.netlify.com
2. Click "Add new site" → "Deploy manually"
3. Drag and drop the entire `netlify-proxy` folder onto the deploy area
4. Wait ~30 seconds for deploy to finish
5. Copy your site URL (e.g. `https://amazing-fox-123456.netlify.app`)
6. Paste that URL into player-notes.html where it says NETLIFY_PROXY_URL

## Test it works

Open this in your browser (replace with your actual URL):
https://YOUR-SITE.netlify.app/.netlify/functions/slippi-proxy?file=fox.zip

You should get a zip file download. If so, you're good.
