# Song Library

This folder contains songs and beat maps for Rhythm Mode.

## How to Add a Song

1. **Add your files to this folder:**
   - Your audio file (`.mp3`, `.wav`, `.ogg`, etc.)
   - Your beat map JSON file (`.json`)

2. **Register the song in `library.js`:**

Open `library.js` and add an entry to the `SONG_LIBRARY` array:

```javascript
export const SONG_LIBRARY = [
  {
    id: 'my-awesome-song',           // Unique ID (no spaces)
    name: 'My Awesome Song',         // Display name
    artist: 'Artist Name',           // Artist (optional)
    audioPath: 'songs/song.mp3',     // Path relative to docs/
    beatMapPath: 'songs/song.json'   // Path relative to docs/
  }
];
```

3. **That's it!** The song will now appear in the Rhythm Mode song selection dropdown.

## Example

If you have:
- `docs/songs/test-song.mp3`
- `docs/songs/test-song-beats.json`

Add this to library.js:

```javascript
{
  id: 'test-song',
  name: 'Test Song',
  artist: 'Test Artist',
  audioPath: 'songs/test-song.mp3',
  beatMapPath: 'songs/test-song-beats.json'
}
```

## Beat Map Format

Your JSON beat map should look like this:

```json
{
  "name": "Song Name",
  "bpm": 120,
  "beats": [
    { "time": 0.5, "lane": "center" },
    { "time": 1.0, "lane": "center" },
    { "time": 1.5, "lane": "center" }
  ]
}
```

- `time`: Beat time in seconds
- `lane`: Currently ignored (all rings spawn at center), but keep it for future use
