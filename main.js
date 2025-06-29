// Constants for piano key mapping
const MIDI_START = 0; // C-1
const MIDI_END = 127; // G9
const NUM_KEYS = MIDI_END - MIDI_START + 1;
const KEY_HEIGHT = 5;

// Multicolor palette for tracks
const TRACK_COLORS = [
    '#FF5252', '#40C4FF', '#FFD740', '#69F0AE', '#FF6E40', '#B388FF',
    '#00E676', '#F50057', '#2979FF', '#FFEB3B', '#00B8D4', '#FF8A65', '#8D6E63'
];

const canvas = document.getElementById('pianoRoll');
const ctx = canvas.getContext('2d');

let midi, synth, now, notes = [], playing = false, loopId, startTime, midiDuration;
let activeTrack = 0;

// UI Elements
const fileInput = document.getElementById('midiFile');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const trackList = document.getElementById('trackList');

// Handle MIDI file loading
fileInput.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    const data = await e.target.files[0].arrayBuffer();
    midi = new Midi(data);
    notes = [];
    midi.tracks.forEach((tr, i) => {
        tr.notes.forEach(note => notes.push({...note, track: i}));
    });
    midiDuration = midi.duration;
    drawPianoRoll();
    playBtn.disabled = false;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;

    // Show track list
    trackList.innerHTML = '';
    midi.tracks.forEach((t, i) => {
        const btn = document.createElement('button');
        btn.textContent = t.name || `Track ${i+1}`;
        btn.style.background = TRACK_COLORS[i % TRACK_COLORS.length];
        btn.onclick = () => { activeTrack = i; drawPianoRoll(); };
        trackList.appendChild(btn);
    });
});

// Draw piano roll
function drawPianoRoll(currentTime = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw keys (horizontal lines)
    ctx.strokeStyle = "#333";
    for (let i = 0; i <= NUM_KEYS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * KEY_HEIGHT);
        ctx.lineTo(canvas.width, i * KEY_HEIGHT);
        ctx.stroke();
    }
    // Draw notes
    const pixelsPerSecond = canvas.width / (midiDuration || 1);
    for (const note of notes) {
        // If filtering by track, skip others
        if (typeof activeTrack === 'number' && note.track !== activeTrack) continue;
        const y = (NUM_KEYS - (note.midi - MIDI_START)) * KEY_HEIGHT;
        const x = note.time * pixelsPerSecond;
        const w = note.duration * pixelsPerSecond;
        ctx.fillStyle = TRACK_COLORS[note.track % TRACK_COLORS.length];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, w, KEY_HEIGHT - 1);
        ctx.globalAlpha = 1.0;
    }
    // Draw playhead
    if (currentTime > 0) {
        ctx.strokeStyle = "#fff";
        const px = currentTime * pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
    }
}

// Setup synth
function setupSynth() {
    if (synth) synth.dispose();
    synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {type: "triangle"},
        envelope: {attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2}
    }).toDestination();
}

// Playback code
async function play() {
    if (!midi) return;
    setupSynth();
    Tone.context.resume();
    playing = true;
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    startTime = Tone.now();
    now = 0;

    // Flat list of notes for scheduling
    const playNotes = notes.filter(n => typeof activeTrack !== 'number' || n.track === activeTrack);
    for (const note of playNotes) {
        synth.triggerAttackRelease(
            note.name,
            note.duration,
            startTime + note.time,
            note.velocity
        );
    }

    // Animation loop
    function loop() {
        if (!playing) return;
        now = Tone.now() - startTime;
        drawPianoRoll(now);
        if (now < midiDuration) {
            loopId = requestAnimationFrame(loop);
        } else {
            stop();
        }
    }
    loop();
}

function pause() {
    playing = false;
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    if (loopId) cancelAnimationFrame(loopId);
    if (synth) synth.releaseAll();
    Tone.Transport.pause();
}

function stop() {
    playing = false;
    playBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    if (loopId) cancelAnimationFrame(loopId);
    if (synth) synth.releaseAll();
    drawPianoRoll();
}

// Controls
playBtn.onclick = play;
pauseBtn.onclick = pause;
stopBtn.onclick = stop;

// Initial draw
drawPianoRoll();
