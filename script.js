function interactiveMode() {
    document.getElementById("interactiveButtons").style.display = "flex";
    document.getElementById("progress-bar").style.display = "flex";
    document.getElementById("preparedButtons").style.display = "none";
    document.querySelector('.interactive-btn').classList.add('active');
    document.querySelector('.prepared-btn').classList.remove('active');
}
function preparedMode() {
    document.getElementById("preparedButtons").style.display = "flex";
    document.getElementById("interactiveButtons").style.display = "none";
    document.getElementById("progress-bar").style.display = "none";
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

document.addEventListener('mousedown', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
});

function playNote(note){
    if (!noteFrequencies[note]) return;

    if (activeOscillators[note]) {
        stopNote(note);
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = noteFrequencies[note];
    gainNode.gain.value = 0.3;
    
    // Connect nodes: oscillator -> gain -> analyser -> splitter
    oscillator.connect(gainNode);
    gainNode.connect(analyserNode);  // This is the key change - connect to analyser
    
    oscillator.start(0);
    
    activeOscillators[note] = { oscillator, gainNode };
    
    const keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) keyElement.classList.add('active');

    // If recording, track the note start time
    if (isRecording) {
        const currentTime = Date.now() - recordingStartTime;
        activeNotes[note] = currentTime;
    }
}

function stopNote(note) {
    if (!activeOscillators[note]) return;
    // Stop immediately without fade
    activeOscillators[note].oscillator.stop();
    activeOscillators[note].gainNode.disconnect();
    delete activeOscillators[note];

    // Remove visual highlight
    const keyElement = document.querySelector(`[data-note="${note}"]`);
    if (keyElement) keyElement.classList.remove('active');

    // If recording and note was pressed, record the note duration
    if (isRecording && activeNotes[note] !== undefined) {
        const currentTime = Date.now() - recordingStartTime;
        const startTime = activeNotes[note];
        const duration = currentTime - startTime;
        
        recordedNotes.push({
            key: note,
            startTime: startTime,
            duration: duration
        });
        
        delete activeNotes[note];
    }
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

//======CREATING RECORDINGS======//
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination;
let splitterGain; 
let analyserNode;
let dataArray;
let canvas;
let canvasCtx;

// JSON variables
let recordingStartTime;
let isRecording = false;
let recordedNotes = [];
let activeNotes = {}; 

const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const downloadButton = document.getElementById('downloadButton');

function setupAudioRecording() {
    audioStreamDestination = audioContext.createMediaStreamDestination();
    
    // Create analyser node for visualization
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    // Get canvas for drawing waveform
    canvas = document.getElementById('waveform');
    canvasCtx = canvas.getContext('2d');
    
    // The audio chain should be: oscillator -> gain -> analyser -> splitter
    // Where splitter goes to both destination and recorder
    splitterGain = audioContext.createGain();
    splitterGain.gain.value = 1.0;
    
    // Connect analyser to splitter
    analyserNode.connect(splitterGain);
    
    // Connect splitter to both speakers and recorder
    splitterGain.connect(audioContext.destination); // For playback
    splitterGain.connect(audioStreamDestination);   // For recording
}


function drawWaveform() {
    analyserNode.getByteFrequencyData(dataArray);
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw with more contrast
    canvasCtx.fillStyle = 'rgba(211, 3, 3, 0.8)';
    
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Draw the bar centered
        canvasCtx.fillRect(
            x, 
            canvas.height - barHeight, 
            barWidth, 
            barHeight
        );
        
        x += barWidth + 1;
    }
}


function animate() {
    drawWaveform();
    requestAnimationFrame(animate); // Keeps updating
}

// Start the animation loop
window.addEventListener('load', () => {
    setupAudioRecording();
    animate();
});

window.addEventListener('load', () => {
    setupAudioRecording();
    
    // Rest of your initialization code...
    document.querySelectorAll('.white-key, .black-key').forEach(key => {
        // Your existing event listeners...
    });
});

setupAudioRecording();

recordButton.addEventListener('click', async () => {
    try {
        audioChunks = [];
        recordedNotes = [];
        activeNotes = {};
        recordingStartTime = Date.now();
        isRecording = true;

        //create media recorder from audio stream
        mediaRecorder = new MediaRecorder(audioStreamDestination.stream);
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, {type: 'audio/mp3'});
            const audioUrl = URL.createObjectURL(audioBlob);

            //enable download
            downloadButton.disabled = false;
            downloadJSONButton.disabled = false;
            downloadButton.onclick = () => {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = audioUrl;
                a.download = 'piano-recording.mp3';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(audioUrl);
                }, 100);
            };

            //JSON download
            downloadJSONButton.onclick = () => {
                const recordingData = {
                    name: "Piano Recording",
                    duration: Date.now() - recordingStartTime,
                    notes: recordedNotes
                };
                const jsonBlob = new Blob([JSON.stringify(recordingData, null, 2)], {type: 'application/json'});
                const jsonUrl = URL.createObjectURL(jsonBlob);

                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = jsonUrl;
                a.download = 'piano-recording.json';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(jsonUrl);
                }, 100);
            };
        };
        mediaRecorder.start(100);

        recordButton.disabled = true;
        stopButton.disabled = false;
        downloadButton.disabled = true;
        downloadJSONButton.disabled = true;

        console.log('Recording started');


    } catch (error) {
        console.error('Error starting recording')
    }
});

stopButton.addEventListener('click', () => {
    if(mediaRecorder && mediaRecorder.state != 'inactive') {
        mediaRecorder.stop();
        isRecording = false;

        for (const note in activeNotes) {
            const currentTime = Date.now() - recordingStartTime;
            const startTime = activeNotes[note];
            const duration = currentTime - startTime;
            
            recordedNotes.push({
                key: note,
                startTime: startTime,
                duration: duration
            });
        }
        activeNotes = {};
        recordButton.disabled = false;
        stopButton.disabled = true;

        console.log('Recording stopped');
    }
});

//======PREPARED MODE======//
let playbackStartTime;
let playbackNotes = [];
let playbackInterval;
let currentPlaybackPosition = 0;
let isPlaying = false;
let playbackSpeed = 1.0;
let upcomingNotesDisplay = [];

function preparedMode() {
    document.getElementById("preparedButtons").style.display = "flex";
    document.getElementById("interactiveButtons").style.display = "none";
    document.querySelector('.prepared-btn').classList.add('active');
    document.querySelector('.interactive-btn').classList.remove('active');
    stopPlayback(); // Stop any ongoing playback when switching modes
}

function loadJSONFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.notes && Array.isArray(data.notes)) {
                playbackNotes = data.notes.sort((a, b) => a.startTime - b.startTime);
                upcomingNotesDisplay = [...playbackNotes];
                console.log("Loaded recording with", playbackNotes.length, "notes");
                document.querySelector('.play-button').disabled = false;
                document.querySelector('.stop-button').disabled = true;
            } else {
                console.error("Invalid JSON format");
            }
        } catch (error) {
            console.error("Error parsing JSON:", error);
        }
    };
    reader.readAsText(file);
}

function startPlayback() {
    if (playbackNotes.length === 0 || isPlaying) return;
    
    isPlaying = true;
    playbackStartTime = audioContext.currentTime * 1000;
    currentPlaybackPosition = 0;
    
    document.querySelector('.play-button').disabled = true;
    document.querySelector('.stop-button').disabled = false;
    
    if (playbackInterval) clearInterval(playbackInterval);
    
    playbackInterval = setInterval(() => {
        const elapsed = (audioContext.currentTime * 1000 - playbackStartTime) * playbackSpeed;

        while (currentPlaybackPosition < playbackNotes.length && 
               playbackNotes[currentPlaybackPosition].startTime <= elapsed) {
            const note = playbackNotes[currentPlaybackPosition];
            playNote(note.key);

            setTimeout(() => {
                stopNote(note.key);
            }, note.duration / playbackSpeed);
            
            currentPlaybackPosition++;
        }

        updateUpcomingNotes(elapsed);

        if (currentPlaybackPosition >= playbackNotes.length) {
            stopPlayback();
        }
    }, 10); //check every 10ms
}

function stopPlayback() {
    if (playbackInterval) clearInterval(playbackInterval);
    isPlaying = false;
    
    for (const note in activeOscillators) {
        stopNote(note);
    }
    
    document.querySelector('.play-button').disabled = false;
    document.querySelector('.stop-button').disabled = true;
    
    // Reset playback position
    currentPlaybackPosition = 0;
    upcomingNotesDisplay = [...playbackNotes];
    updateUpcomingNotes(0);
}

function updateUpcomingNotes(elapsed) {
    const upcoming = playbackNotes.filter(n => 
        n.startTime > elapsed && n.startTime <= elapsed + 2000 // Show next 2 seconds
    );

    console.log("Upcoming notes:", upcoming);
}

function changePlaybackSpeed(speed) {
    playbackSpeed = speed;
    if (isPlaying) {
        // Restart playback with new speed
        stopPlayback();
        startPlayback();
    }
}


document.getElementById('jsonUpload').addEventListener('change', loadJSONFile);
document.querySelector('.play-button').addEventListener('click', startPlayback);
document.querySelector('.stop-button').addEventListener('click', stopPlayback);