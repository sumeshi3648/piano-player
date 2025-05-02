function interactiveMode() {
    document.getElementById("interactiveButtons").style.display = "flex";
    document.getElementById("preparedButtons").style.display = "none";
    document.querySelector('.interactive-btn').classList.add('active');
    document.querySelector('.prepared-btn').classList.remove('active');
}
function preparedMode() {
    document.getElementById("preparedButtons").style.display = "flex";
    document.getElementById("interactiveButtons").style.display = "none";
    document.querySelector('.prepared-btn').classList.add('active');
    document.querySelector('.interactive-btn').classList.remove('active');
}

const audioContext = new (window.AudioContext || window.webkitAudioContext) ();
const activeOscillators = {};

// Creating a object of Audio with a default sound
const noteFrequencies = {
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 
    'F#3': 185.0, 'G3': 196.0, 'G#3': 207.65, 'A3': 220.0, 'A#3': 233.08, 'B3': 246.94,

    'C4': 261.63, 'C#4': 277.18, 'D4': 293.67, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 
    'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.0, 'A#4': 466.16, 'B4': 493.88,

    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.26
}

const keyToNote = {
    'q': 'C3', '2': 'C#3', 'w': 'D3', '3': 'D#3', 'e': 'E3', 'r': 'F3', '5': 'F#3', 't': 'G3', 
    '6': 'G#3', 'y': 'A3', '7': 'A#3', 'u': 'B3', 'i': 'C4', '9': 'C#4', 'o': 'D4', '0': 'D#4', 
    'p': 'E4', 'z': 'F4', 's': 'F#4', 'x': 'G4', 'd': 'G#4', 'c': 'A4', 'f': 'A#4', 'v': 'B4', 
    'b': 'C5', 'h': 'C#5', 'n': 'D5', 'j': 'D#5', 'm': 'E5'
}
function playNote(note){
    // check note exists
    if (!noteFrequencies[note]) return;
    //create sound generator
    const oscillator = audioContext.createOscillator();
    //create volume control
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine'; //basic smooth waveform
    oscillator.frequency.value = noteFrequencies[note];
    //initial volume (30%)
    gainNode.gain.value = 0.3;
    //connect nodes: oscillator - gain - output
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    //start the sound
    oscillator.start();
    //store reference to stop later
    activeOscillators[note] = { oscillator, gainNode };
    //visual feedback
    const keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) keyElement.classList.add('active');

}
function stopNote(note) {
    if (!activeOscillators[note]) return;

    activeOscillators[note].gainNode.gain.setValueAtTime(
        activeOscillators[note].gainNode.gain.value, // current volume
        audioContext.currentTime // start fade
    );
    activeOscillators[note].gainNode.gain.exponentialRampToValueAtTime(
        0.001, //very quiet
        audioContext.currentTime + 0.03 //over 30ms
    );
    
    //stop oscillator after fade completes
    setTimeout(() => {
        activeOscillators[note].oscillator.stop();
        delete activeOscillators[note];
    }, 30);
    
    //remove visual highlight
    const keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) keyElement.classList.remove('active');
}
document.querySelectorAll('.white-key, .black-key').forEach(key => {
    const note = key.getAttribute('data-note');
    
    key.addEventListener('mousedown', () => playNote(note));
    key.addEventListener('mouseup', () => stopNote(note));
    key.addEventListener('mouseleave', () => stopNote(note));
});

document.addEventListener('keydown', (e) => {
    const note = keyToNote[e.key];
    if (note && !activeOscillators[note]) {
        playNote(note);
    }
});

document.addEventListener('keyup', (e) => {
    const note = keyToNote[e.key];
    if (note) {
        stopNote(note);
    }
});

