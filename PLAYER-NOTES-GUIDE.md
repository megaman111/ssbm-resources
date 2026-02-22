# Player Notes Workflow Guide

## How It Works

The Player Notes system stores all notes in `player-notes.json` in your repository. This means your notes are version-controlled and accessible from any device.

## Workflow

### 1. Add or Edit Notes
- Go to the Player Notes page
- Add new notes or edit existing ones
- The changes are stored temporarily in your browser

### 2. Export Your Changes
- Click the "📥 Export Notes (Download JSON)" button
- This downloads a `player-notes.json` file with all your notes

### 3. Update the Repository
```bash
# Replace the old player-notes.json with your downloaded file
# (Move the downloaded file to your repo directory, replacing the old one)

# Then commit and push
git add player-notes.json
git commit -m "Update player notes"
git push
```

### 4. Changes Go Live
- GitHub Pages will automatically update (1-2 minutes)
- Your notes are now accessible from any device
- Anyone visiting the site will see the updated noteshttps://www.youtube.com/playlist?list=PLjlNZeFuqCNF_MPoXHWJ-wMe1liFvKqBW

## Import Notes

If you're on a different device or want to load notes:
- Click "📤 Import Notes (Load JSON)"
- Select your `player-notes.json` file
- Notes will load into the page

## Tips

- Export frequently to avoid losing work
- Keep backups of your player-notes.json file
- You can manually edit the JSON file if needed
- The JSON file is version-controlled, so you can revert changes if needed

## JSON Format

```json
[
  {
    "playerName": "Mango",
    "character": "Falco",
    "notes": "Loves to approach with dair...",
    "date": "2024-01-15T12:00:00.000Z"
  }
]
```
