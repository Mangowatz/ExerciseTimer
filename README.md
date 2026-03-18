# HIIT Interval Timer

**This is my first vibe-coded project made with Gemini 3.1 in antigravity!**

A premium, highly-customizable High-Intensity Interval Training (HIIT) timer built entirely with Vanilla HTML, CSS, and JavaScript. Zero dependencies, no build steps required—just open `index.html` in your browser.

## Features

- **Custom Workouts:** Define your own workout types and configure the duration for both work and rest periods.
- **Specific Exercises:** Rather than just tracking interval numbers, you can configure a list of exactly which exercises you will be performing during each interval.
- **Save & Load Routines:** Your favorite workouts are saved to your browser's local storage so they are always ready to go.
- **Audio Tones:** Fully synthesized audio cues (using the Web Audio API) play a 5-second countdown beep, an interval change chime, and a triumphant workout-complete tone. No external sound files needed.
- **Skip & Jump:** Quickly step through phases (forward or backward) using the skip buttons.
- **Responsive Dark UI:** A beautiful, glowing, dark-mode aesthetic with a dynamic smooth-animating circular progress timer.

## Usage

1. **Launch:** Double-click the `index.html` file to open the app in any modern web browser (Edge, Chrome, Safari, Firefox).
2. **Setup:**
   - Use the `+` / `-` buttons to configure your **Work** and **Rest** times (in seconds).
   - Enter your **Workout Type** (e.g., "Morning Tabata").
   - Click `+` or `-` to add or remove intervals in your **Exercises** list. You can click into each input box to give each interval a specific name (e.g., "Pushups", "Plank").
3. **Save (Optional):** Click the "Saved Routines" button to expand the menu. Click "SAVE" to save your current configuration to the browser. You can load it later using the dropdown list.
4. **Start:** Click `START WORKOUT`. The timer will begin with a 10-second preparation countdown.

## Technologies Used

- **HTML5:** App structure and SVG for the circular timer.
- **CSS3:** Glassmorphism styling, CSS variables for theming, CSS Grid/Flexbox layouts, and dynamic transitions.
- **JavaScript (ES6):** State management, interval counting, dynamic DOM updates, Web Audio API synthesis, and localStorage integration.
