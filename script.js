// Audio Context for synthesizing tones
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(frequency, type, duration, vol = 0.5) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Envelope to prevent clicking
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

function playCountdownBeep() {
    // Short, mid-pitch beep
    playTone(600, 'sine', 0.2, 0.6);
}

function playIntervalEnd() {
    // Double beep or higher pitch to signal switch
    playTone(880, 'triangle', 0.15, 0.7);
    setTimeout(() => playTone(880, 'triangle', 0.3, 0.7), 200);
}

function playWorkoutComplete() {
    // Triumphant chord
    playTone(440, 'sine', 1.0, 0.5); // A4
    playTone(554.37, 'sine', 1.0, 0.5); // C#5
    playTone(659.25, 'sine', 1.0, 0.5); // E5
    setTimeout(() => {
        playTone(880, 'sine', 1.5, 0.6); // A5
    }, 200);
}


// Wake Lock API
let wakeLock = null;

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Screen Wake Lock released');
            });
        }
    } catch (err) {
        console.error('Wake Lock error:', err.name, err.message);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
        });
    }
}

// App State
let config = {
    workTime: 30,
    restTime: 10,
    exercises: ['Jumping Jacks', 'Pushups', 'High Knees', 'Plank']
};

let state = {
    currentInterval: 1,
    phase: 'setup', // setup, prepare, work, rest, done
    timeLeft: 0,
    totalPhaseTime: 0,
    timerId: null,
    isPaused: false
};

// DOM Elements
const views = {
    setup: document.getElementById('setup-view'),
    timer: document.getElementById('timer-view'),
    done: document.getElementById('done-view')
};

const inputs = {
    work: document.getElementById('work-time'),
    rest: document.getElementById('rest-time')
};

const display = {
    statusText: document.getElementById('status-text'),
    timeLeft: document.getElementById('time-left'),
    intervalCount: document.getElementById('interval-count'),
    currentExercise: document.getElementById('current-exercise'),
    nextExercise: document.getElementById('next-exercise'),
    circleRing: document.querySelector('.progress-ring__circle'),
    pauseBtn: document.getElementById('pause-btn')
};

const exercisesListEl = document.getElementById('exercises-list');
const routineSelectEl = document.getElementById('routine-select');

// SVG Circle setup
const circleRadius = display.circleRing.r.baseVal.value;
const circleCircumference = circleRadius * 2 * Math.PI;
display.circleRing.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
display.circleRing.style.strokeDashoffset = circleCircumference; // 0 progress

function setProgress(percent) {
    const offset = circleCircumference - percent * circleCircumference;
    display.circleRing.style.strokeDashoffset = offset;
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

function adjustValue(inputId, amount) {
    const el = document.getElementById(inputId);
    let val = parseInt(el.value) + amount;
    const min = parseInt(el.getAttribute('min'));
    if (val >= min) {
        el.value = val;
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateColors(phase) {
    display.statusText.className = '';
    const root = document.documentElement;
    
    if (phase === 'prepare') {
        display.statusText.classList.add('state-prepare');
        root.style.setProperty('--accent-primary', 'var(--accent-prepare)');
    } else if (phase === 'work') {
        display.statusText.classList.add('state-work');
        root.style.setProperty('--accent-primary', 'var(--accent-work)');
    } else if (phase === 'rest') {
        display.statusText.classList.add('state-rest');
        root.style.setProperty('--accent-primary', 'var(--accent-rest)');
    } else {
        root.style.setProperty('--accent-primary', '#00f0ff');
    }
}

// Exercise List Management
function renderExercises() {
    exercisesListEl.innerHTML = '';
    config.exercises.forEach((ex, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'exercise-input-wrapper';
        wrapper.draggable = true;
        wrapper.dataset.index = index;
        
        wrapper.addEventListener('dragstart', handleDragStart);
        wrapper.addEventListener('dragover', handleDragOver);
        wrapper.addEventListener('drop', handleDrop);
        wrapper.addEventListener('dragend', handleDragEnd);

        wrapper.innerHTML = `
            <span class="drag-handle">☰</span>
            <span class="exercise-number">${index + 1}.</span>
            <input type="text" class="list-input" value="${ex}" placeholder="Exercise ${index + 1}" onchange="updateExercise(${index}, this.value)">
        `;
        exercisesListEl.appendChild(wrapper);
    });
}

let dragStartIndex = null;

function handleDragStart(e) {
    dragStartIndex = +e.currentTarget.dataset.index;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const draggingElement = document.querySelector('.exercise-input-wrapper.dragging');
    if (!draggingElement) return;
    
    const overElement = e.currentTarget;
    if (draggingElement === overElement) return;

    const bounding = overElement.getBoundingClientRect();
    const offset = e.clientY - bounding.top;
    
    if (offset > bounding.height / 2) {
        overElement.after(draggingElement);
    } else {
        overElement.before(draggingElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
    // Reordering handled dynamically in handleDragOver
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    dragStartIndex = null;
    
    // Update config.exercises based on new DOM order
    const inputs = [...exercisesListEl.querySelectorAll('.list-input')];
    config.exercises = inputs.map(input => input.value);
    
    // Re-render to correctly reassign sequence numbers and DOM event state
    renderExercises();
}

function updateExercise(index, value) {
    config.exercises[index] = value;
}

function addExercise() {
    config.exercises.push('');
    renderExercises();
    exercisesListEl.scrollTop = exercisesListEl.scrollHeight;
}

function removeExercise() {
    if (config.exercises.length > 1) {
        config.exercises.pop();
        renderExercises();
    }
}

// UI Toggles
function toggleRoutines() {
    const content = document.getElementById('routines-content');
    const icon = document.getElementById('accordion-icon');
    
    content.classList.toggle('expanded');
    if (content.classList.contains('expanded')) {
        icon.textContent = '▼';
    } else {
        icon.textContent = '▲';
    }
}

// Close accordion if clicked outside
document.addEventListener('click', (event) => {
    const accordion = document.querySelector('.routines-accordion');
    const content = document.getElementById('routines-content');
    const icon = document.getElementById('accordion-icon');

    if (accordion && !accordion.contains(event.target)) {
        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            icon.textContent = '▲';
        }
    }
});

// Routine Save/Load Management
function loadSavedRoutines() {
    const saved = JSON.parse(localStorage.getItem('hiit_routines') || '{}');
    routineSelectEl.innerHTML = '<option value="">-- Load Saved Routine --</option>';
    Object.keys(saved).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        routineSelectEl.appendChild(opt);
    });
}

function saveConfig() {
    let name = prompt("Enter a name to save this routine:");
    if (!name) return;
    name = name.trim();
    if (name === '') return;
    
    config.workTime = parseInt(inputs.work.value);
    config.restTime = parseInt(inputs.rest.value);
    
    const saved = JSON.parse(localStorage.getItem('hiit_routines') || '{}');
    saved[name] = {
        workTime: config.workTime,
        restTime: config.restTime,
        exercises: [...config.exercises]
    };
    
    localStorage.setItem('hiit_routines', JSON.stringify(saved));
    loadSavedRoutines();
    routineSelectEl.value = name;
    alert(`Routine "${name}" saved!`);
}

function loadConfig() {
    const name = routineSelectEl.value;
    if (!name) return;
    
    const saved = JSON.parse(localStorage.getItem('hiit_routines') || '{}');
    if (saved[name]) {
        config.workTime = saved[name].workTime || 30;
        config.restTime = saved[name].restTime || 10;
        config.exercises = saved[name].exercises || ['Interval 1'];
        
        inputs.work.value = config.workTime;
        inputs.rest.value = config.restTime;
        renderExercises();
        
        // Auto-close accordion
        toggleRoutines();
    }
}

function deleteConfig() {
    const name = routineSelectEl.value;
    if (!name) return;
    
    if (confirm(`Are you sure you want to delete the routine "${name}"?`)) {
        const saved = JSON.parse(localStorage.getItem('hiit_routines') || '{}');
        delete saved[name];
        localStorage.setItem('hiit_routines', JSON.stringify(saved));
        loadSavedRoutines();
    }
}

function startWorkout() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    requestWakeLock();
    
    // Read config
    config.workTime = parseInt(inputs.work.value);
    config.restTime = parseInt(inputs.rest.value);
    
    // Fallback if inputs were cleared
    config.exercises = config.exercises.map(e => e.trim() === '' ? 'Interval' : e.trim());
    
    state.currentInterval = 1;
    switchView('timer');
    startPhase('prepare', 10); // 10 second preparation
}

function startPhase(phase, timeOverride = null) {
    state.phase = phase;
    
    if (phase === 'prepare') {
        state.timeLeft = timeOverride || 10;
        display.statusText.textContent = "GET READY";
    } else if (phase === 'work') {
        state.timeLeft = config.workTime;
        display.statusText.textContent = "WORK";
    } else if (phase === 'rest') {
        state.timeLeft = config.restTime;
        display.statusText.textContent = "REST";
    }
    
    state.totalPhaseTime = state.timeLeft;
    
    // Update exercise labels
    const currentEx = config.exercises[state.currentInterval - 1];
    const nextEx = config.exercises[state.currentInterval] || "Done";
    
    if (phase === 'prepare' || phase === 'work') {
        display.currentExercise.textContent = currentEx;
        display.nextExercise.textContent = "";
    } else if (phase === 'rest') {
        display.currentExercise.textContent = "Rest";
        display.nextExercise.textContent = `Up Next: ${nextEx}`;
    }
    
    display.intervalCount.textContent = `Interval ${state.currentInterval}/${config.exercises.length}`;
    
    updateColors(state.phase);
    updateTimerDisplay();
    
    clearInterval(state.timerId);
    state.timerId = setInterval(tick, 1000);
}

function tick() {
    if (state.isPaused) return;
    
    state.timeLeft--;
    
    updateTimerDisplay();
    
    // Audio Cues
    if (state.timeLeft <= 5 && state.timeLeft > 0) {
        // 5 second countdown before a switch
        playCountdownBeep();
    }
    
    if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        
        if (state.phase === 'prepare') {
            playIntervalEnd();
            startPhase('work');
        } else if (state.phase === 'work') {
            if (state.currentInterval >= config.exercises.length) {
                // Workout Done
                playWorkoutComplete();
                finishWorkout();
            } else {
                // Go to rest
                playIntervalEnd();
                startPhase('rest');
            }
        } else if (state.phase === 'rest') {
            state.currentInterval++;
            playIntervalEnd();
            startPhase('work');
        }
    }
}

function updateTimerDisplay() {
    display.timeLeft.textContent = formatTime(state.timeLeft);
    const progress = (state.totalPhaseTime - state.timeLeft) / state.totalPhaseTime;
    setProgress(progress);
}

function togglePause() {
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        display.pauseBtn.textContent = "RESUME";
        display.statusText.textContent = "PAUSED";
    } else {
        display.pauseBtn.textContent = "PAUSE";
        display.statusText.textContent = state.phase.toUpperCase();
        if (state.phase === 'prepare') display.statusText.textContent = "GET READY";
    }
}

function nextInterval() {
    if (state.phase === 'prepare') {
        startPhase('work');
    } else if (state.phase === 'work') {
        if (state.currentInterval >= config.exercises.length) {
            finishWorkout();
        } else {
            startPhase('rest');
        }
    } else if (state.phase === 'rest') {
        state.currentInterval++;
        startPhase('work');
    }
}

function prevInterval() {
    if (state.phase === 'rest') {
        startPhase('work');
    } else if (state.phase === 'work') {
        startPhase('prepare');
    } else if (state.phase === 'prepare') {
        if (state.currentInterval > 1) {
            state.currentInterval--;
            startPhase('rest');
        } else {
            // Already at the very beginning
            startPhase('prepare');
        }
    }
}

function stopWorkout() {
    clearInterval(state.timerId);
    state.isPaused = false;
    display.pauseBtn.textContent = "PAUSE";
    releaseWakeLock();
    resetApp();
}

function finishWorkout() {
    clearInterval(state.timerId);
    display.statusText.textContent = "DONE";
    display.statusText.className = '';
    releaseWakeLock();
    switchView('done');
    document.documentElement.style.setProperty('--accent-primary', '#00f0ff');
}

function resetApp() {
    switchView('setup');
    display.statusText.textContent = "Setup your workout";
    updateColors('setup');
}

// Input listener validations
['work-time', 'rest-time'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        const min = parseInt(e.target.getAttribute('min'));
        if (isNaN(val) || val < min) {
            e.target.value = min;
        }
    });
});

// Initialize Setup UI
renderExercises();
loadSavedRoutines();
