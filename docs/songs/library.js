/**
 * Song library for Rhythm Mode
 * Each song entry contains:
 * - id: unique identifier
 * - name: display name
 * - artist: artist name (optional)
 * - audioPath: path to audio file relative to docs/
 * - beatMapPath: path to beat map JSON file relative to docs/
 */

export const SONG_LIBRARY = [
  {
    id: 'tension',
    name: 'Tension',
    artist: 'Artist Name',
    audioPath: 'songs/Tension.mp3',
    beatMapPath: 'songs/tension.json'
  }
  // Add more songs here as needed
];

/**
 * Get a song by ID
 */
export function getSongById(id) {
  return SONG_LIBRARY.find(song => song.id === id);
}

/**
 * Get all song names for UI dropdown
 */
export function getSongList() {
  return SONG_LIBRARY.map(song => ({
    id: song.id,
    name: song.name,
    artist: song.artist
  }));
}
