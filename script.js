const STORAGE_KEY = "nosleep-training-timer-state";
const WORKOUT_STORAGE_KEY = "nosleep-workout-state";

const workout = {
  status: "setup",
  exerciseCount: 6,
  roundsPerExercise: 4,
  restSeconds: 60,
  soundEnabled: true,
  completedRounds: 0,
  startedAt: null,
  finishedAt: null,
  restUntil: null,
  lastRestCue: null,
};

const state = {
  isRunning: false,
  totalAccumulatedMs: 0,
  lapAccumulatedMs: 0,
  runStartedAt: null,
  lapStartedAt: null,
  laps: [],
  durationMs: 0,
  hasCompletedDuration: false,
  wakeLock: null,
  wakeLockSupported: "wakeLock" in navigator,
};

const elements = {
  mainRing: document.querySelector("#main-ring"),
  totalTime: document.querySelector("#total-time"),
  lapTime: document.querySelector("#lap-time"),
  ringStatus: document.querySelector("#ring-status"),
  startPause: document.querySelector("#start-pause"),
  lapButton: document.querySelector("#lap-button"),
  resetButton: document.querySelector("#reset-button"),
  durationMinutes: document.querySelector("#duration-minutes"),
  applyDuration: document.querySelector("#apply-duration"),
  durationStatus: document.querySelector("#duration-status"),
  lapsList: document.querySelector("#laps-list"),
  lapsSummary: document.querySelector("#laps-summary"),
  emptyState: document.querySelector("#empty-state"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  keepAwakeView: document.querySelector("#keep-awake-view"),
  trainingView: document.querySelector("#training-view"),
  trainingSetup: document.querySelector("#training-setup"),
  setupError: document.querySelector("#setup-error"),
  exerciseCount: document.querySelector("#exercise-count"),
  roundCount: document.querySelector("#round-count"),
  restSeconds: document.querySelector("#rest-seconds"),
  soundEnabled: document.querySelector("#sound-enabled"),
  trainingSession: document.querySelector("#training-session"),
  trainingComplete: document.querySelector("#training-complete"),
  trainingElapsed: document.querySelector("#training-elapsed"),
  phaseBanner: document.querySelector("#phase-banner"),
  phaseIcon: document.querySelector("#phase-icon"),
  trainingStatus: document.querySelector("#training-status"),
  currentProgress: document.querySelector("#current-progress"),
  trainingInstruction: document.querySelector("#training-instruction"),
  completedCount: document.querySelector("#completed-count"),
  progressTrack: document.querySelector("#progress-track"),
  restDisplay: document.querySelector("#rest-display"),
  restTime: document.querySelector("#rest-time"),
  restNext: document.querySelector("#rest-next"),
  workoutAction: document.querySelector("#workout-action"),
  workoutActionIcon: document.querySelector("#workout-action-icon"),
  workoutActionLabel: document.querySelector("#workout-action-label"),
  trainingSummary: document.querySelector("#training-summary"),
  newTraining: document.querySelector("#new-training"),
};

let audioContext = null;
let workoutFormInitialized = false;
let workoutProgressKey = "";

function formatDuration(ms, includeHours = true) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (includeHours || hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getNow() {
  return Date.now();
}

function getTotalElapsed(now = getNow()) {
  if (!state.isRunning || state.runStartedAt == null) {
    return state.totalAccumulatedMs;
  }

  return state.totalAccumulatedMs + (now - state.runStartedAt);
}

function getLapElapsed(now = getNow()) {
  if (!state.isRunning || state.lapStartedAt == null) {
    return state.lapAccumulatedMs;
  }

  return state.lapAccumulatedMs + (now - state.lapStartedAt);
}

function persistState() {
  const snapshot = {
    isRunning: state.isRunning,
    totalAccumulatedMs: state.totalAccumulatedMs,
    lapAccumulatedMs: state.lapAccumulatedMs,
    runStartedAt: state.runStartedAt,
    lapStartedAt: state.lapStartedAt,
    laps: state.laps,
    durationMs: state.durationMs,
    hasCompletedDuration: state.hasCompletedDuration,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function persistWorkout() {
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(workout));
}

function restoreWorkout() {
  const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
  if (!raw) return;

  try {
    const snapshot = JSON.parse(raw);
    workout.status = ["setup", "running", "resting", "completed"].includes(snapshot.status)
      ? snapshot.status
      : "setup";
    workout.exerciseCount = Math.max(1, Number(snapshot.exerciseCount) || 6);
    workout.roundsPerExercise = Math.max(1, Number(snapshot.roundsPerExercise) || 4);
    workout.restSeconds = Math.max(0, Number(snapshot.restSeconds) || 0);
    workout.soundEnabled = snapshot.soundEnabled !== false;
    workout.startedAt = typeof snapshot.startedAt === "number"
      ? snapshot.startedAt
      : ["running", "resting"].includes(workout.status) ? Date.now() : null;
    workout.finishedAt = typeof snapshot.finishedAt === "number" ? snapshot.finishedAt : null;
    workout.completedRounds = Math.min(
      workout.exerciseCount * workout.roundsPerExercise,
      Math.max(0, Number(snapshot.completedRounds) || 0),
    );
    workout.restUntil = typeof snapshot.restUntil === "number" ? snapshot.restUntil : null;
    workout.lastRestCue = null;
    if (workout.status === "resting" && workout.restUntil <= Date.now()) {
      workout.status = "running";
      workout.restUntil = null;
    }
  } catch {
    localStorage.removeItem(WORKOUT_STORAGE_KEY);
  }
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    state.isRunning = Boolean(snapshot.isRunning);
    state.totalAccumulatedMs = Number(snapshot.totalAccumulatedMs) || 0;
    state.lapAccumulatedMs = Number(snapshot.lapAccumulatedMs) || 0;
    state.runStartedAt = typeof snapshot.runStartedAt === "number" ? snapshot.runStartedAt : null;
    state.lapStartedAt = typeof snapshot.lapStartedAt === "number" ? snapshot.lapStartedAt : null;
    state.laps = Array.isArray(snapshot.laps) ? snapshot.laps : [];
    state.durationMs = Math.max(0, Number(snapshot.durationMs) || 0);
    state.hasCompletedDuration = Boolean(snapshot.hasCompletedDuration);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function requestWakeLock() {
  const workoutIsActive = ["running", "resting"].includes(workout.status);
  if (!state.wakeLockSupported || (!state.isRunning && !workoutIsActive) || document.visibilityState !== "visible") {
    return;
  }

  if (state.wakeLock) {
    return;
  }

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
    });
  } catch (error) {
    console.error("Wake lock failed", error);
    state.wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!state.wakeLock) {
    return;
  }

  try {
    await state.wakeLock.release();
  } catch (error) {
    console.error("Wake lock release failed", error);
  } finally {
    state.wakeLock = null;
  }
}

function releaseWakeLockIfIdle() {
  const workoutIsActive = ["running", "resting"].includes(workout.status);
  if (!state.isRunning && !workoutIsActive) releaseWakeLock();
}

function renderLaps() {
  elements.lapsSummary.textContent = `${state.laps.length} ${
    state.laps.length === 1 ? "vuelta" : "vueltas"
  }`;

  if (state.laps.length === 0) {
    elements.emptyState.hidden = false;
    elements.lapsList.innerHTML = "";
    elements.lapsList.append(elements.emptyState);
    return;
  }

  elements.emptyState.hidden = true;
  elements.lapsList.innerHTML = state.laps
    .slice()
    .reverse()
    .map(
      (lap) => `
        <article class="lap-row">
          <div class="lap-badge">Vuelta ${lap.index}</div>
          <div class="lap-metric">
            <span>Duración</span>
            <span>${formatDuration(lap.lapMs, false)}</span>
          </div>
          <div class="lap-metric">
            <span>Total al marcar</span>
            <span>${formatDuration(lap.totalMs, true)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function render() {
  const now = getNow();
  const totalElapsed = getTotalElapsed(now);

  if (state.isRunning && state.durationMs > 0 && totalElapsed >= state.durationMs) {
    pauseTimer({ automatic: true, now });
    return;
  }

  const lapElapsed = getLapElapsed(now);

  elements.totalTime.textContent = formatDuration(totalElapsed, true);
  elements.lapTime.textContent = formatDuration(lapElapsed, totalElapsed >= 3600000);
  elements.startPause.textContent = state.isRunning
    ? "Pausar"
    : state.hasCompletedDuration
      ? "Empezar de nuevo"
      : "Empezar";
  elements.lapButton.disabled = !state.isRunning;
  elements.ringStatus.textContent = state.isRunning
    ? "Corriendo"
    : state.hasCompletedDuration
      ? "Tiempo cumplido"
      : "Listo";
  elements.mainRing.classList.toggle("running", state.isRunning);
  if (document.activeElement !== elements.durationMinutes) {
    elements.durationMinutes.value = state.durationMs
      ? String(state.durationMs / 60000)
      : "";
  }
  elements.durationStatus.textContent = state.durationMs
    ? state.hasCompletedDuration
      ? "Tiempo cumplido. La sesión se ha detenido."
      : `Se detendrá tras ${formatDuration(state.durationMs, false)}.`
    : "Sin límite de tiempo";

  renderLaps();
  renderWorkout();
}

function playCue(kind = "tick") {
  if (!workout.soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "finish" ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "finish" ? 0.24 : 0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "finish" ? 0.42 : 0.14));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === "finish" ? 0.44 : 0.16));
    if (kind === "finish") {
      window.setTimeout(() => playShortSecondTone(), 170);
    }
  } catch (error) {
    console.warn("Sound cue could not be played", error);
  }
}

function playShortSecondTone() {
  if (!workout.soundEnabled || !audioContext || audioContext.state === "closed") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.value = 1046;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.34);
}

function getWorkoutProgress() {
  const total = workout.exerciseCount * workout.roundsPerExercise;
  const safeCompleted = Math.min(workout.completedRounds, total);
  return {
    total,
    completed: safeCompleted,
    exerciseIndex: Math.min(workout.exerciseCount - 1, Math.floor(safeCompleted / workout.roundsPerExercise)),
    roundIndex: safeCompleted % workout.roundsPerExercise,
  };
}

function getWorkoutElapsed(now = Date.now()) {
  if (workout.startedAt == null) return 0;
  const end = workout.finishedAt ?? now;
  return Math.max(0, end - workout.startedAt);
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function renderWorkout() {
  const isActive = ["running", "resting"].includes(workout.status);
  elements.trainingSetup.hidden = isActive || workout.status === "completed";
  elements.trainingSession.hidden = !isActive;
  elements.trainingComplete.hidden = workout.status !== "completed";
  const elapsedText = formatDuration(getWorkoutElapsed(), true);
  if (elements.trainingElapsed.textContent !== elapsedText) elements.trainingElapsed.textContent = elapsedText;
  if (!workoutFormInitialized) {
    elements.exerciseCount.value = String(workout.exerciseCount);
    elements.roundCount.value = String(workout.roundsPerExercise);
    elements.restSeconds.value = String(workout.restSeconds);
    elements.soundEnabled.checked = workout.soundEnabled;
    workoutFormInitialized = true;
  }

  const { total, completed, exerciseIndex, roundIndex } = getWorkoutProgress();
  elements.completedCount.textContent = `${completed} de ${total} rondas`;
  const progressKey = `${workout.exerciseCount}-${workout.roundsPerExercise}-${completed}-${workout.status === "completed"}`;
  if (progressKey !== workoutProgressKey) {
    workoutProgressKey = progressKey;
    if (total <= 5000) {
      elements.progressTrack.innerHTML = Array.from({ length: workout.exerciseCount }, (_, exercise) => {
        const dots = Array.from({ length: workout.roundsPerExercise }, (_, round) => {
          const sequenceIndex = exercise * workout.roundsPerExercise + round;
          const isDone = sequenceIndex < completed;
          const isCurrent = sequenceIndex === completed && workout.status !== "completed";
          return `<span class="round-dot${isDone ? " done" : ""}${isCurrent ? " current" : ""}" aria-label="Ronda ${round + 1}${isDone ? ", completada" : isCurrent ? ", actual" : ""}"></span>`;
        }).join("");
        return `<div class="exercise-progress${exercise === exerciseIndex && workout.status !== "completed" ? " current-exercise" : ""}"><span class="exercise-name">Ejercicio ${exercise + 1}</span><div class="round-dots">${dots}</div></div>`;
      }).join("");
    } else {
      const percentage = total ? Math.min(100, (completed / total) * 100) : 0;
      elements.progressTrack.innerHTML = `<div class="overall-progress"><div class="overall-progress-track"><span style="width: ${percentage}%"></span></div><p>Ejercicio ${exerciseIndex + 1} de ${workout.exerciseCount} · Ronda ${roundIndex + 1} de ${workout.roundsPerExercise}</p></div>`;
    }
  }

  if (workout.status === "completed") {
    elements.trainingSummary.textContent = `${workout.exerciseCount} ejercicios · ${workout.roundsPerExercise} rondas por ejercicio · ${formatDuration(getWorkoutElapsed(), true)}`;
  }

  if (isActive) {
    const isResting = workout.status === "resting";
    const exerciseNumber = Math.min(exerciseIndex + 1, workout.exerciseCount);
    const roundNumber = Math.min(roundIndex + 1, workout.roundsPerExercise);
    elements.phaseBanner.classList.toggle("phase-resting", isResting);
    elements.phaseBanner.classList.toggle("phase-working", !isResting);
    elements.trainingStatus.textContent = isResting ? "EN DESCANSO" : "EN EJERCICIO";
    elements.phaseIcon.textContent = isResting ? "Ⅱ" : "▶";
    elements.currentProgress.textContent = `Ejercicio ${exerciseNumber} de ${workout.exerciseCount} · Ronda ${roundNumber} de ${workout.roundsPerExercise}`;
    elements.trainingInstruction.textContent = isResting
      ? "Descansa hasta que el contador llegue a cero. Si acabas antes, pulsa «Saltar descanso»."
      : `Haz ahora la ronda ${roundNumber} del ejercicio ${exerciseNumber}. Cuando termines, pulsa «He terminado esta ronda».`;
    elements.restDisplay.hidden = !isResting;
    elements.workoutActionIcon.textContent = isResting ? "↪" : "✓";
    elements.workoutActionLabel.textContent = isResting ? "Saltar descanso" : "He terminado esta ronda";

    if (isResting) {
      const remaining = Math.max(0, workout.restUntil - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      elements.restTime.textContent = formatClock(seconds);
      elements.restNext.textContent = `Ejercicio ${exerciseNumber} · Ronda ${roundNumber}`;
      if (seconds <= 5 && seconds > 0 && workout.lastRestCue !== seconds) {
        workout.lastRestCue = seconds;
        playCue("tick");
      }
      if (remaining <= 0) finishRest();
    }
  }
}

function startWorkout(event) {
  event.preventDefault();
  const exercises = readWholeNumber(elements.exerciseCount.value, false);
  const rounds = readWholeNumber(elements.roundCount.value, false);
  const rest = readWholeNumber(elements.restSeconds.value, true);
  if (exercises == null || rounds == null || rest == null
    || !Number.isSafeInteger(exercises * rounds)
    || !Number.isSafeInteger(rest * 1000)) {
    elements.setupError.textContent = "Escribe números enteros válidos: al menos 1 ejercicio y 1 ronda; el descanso puede ser 0.";
    elements.setupError.hidden = false;
    return;
  }
  elements.setupError.hidden = true;
  workout.exerciseCount = exercises;
  workout.roundsPerExercise = rounds;
  workout.restSeconds = rest;
  workout.soundEnabled = elements.soundEnabled.checked;
  workout.completedRounds = 0;
  workout.startedAt = Date.now();
  workout.finishedAt = null;
  workout.restUntil = null;
  workout.lastRestCue = null;
  workout.status = "running";
  prepareAudio();
  persistWorkout();
  requestWakeLock();
  render();
}

function readWholeNumber(rawValue, allowZero) {
  const value = rawValue.trim();
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) return null;
  return number;
}

function prepareAudio() {
  if (!workout.soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.warn("Sound cues are not available", error);
  }
}

function completeWorkoutRound() {
  if (workout.status !== "running") return;
  workout.completedRounds += 1;
  const total = workout.exerciseCount * workout.roundsPerExercise;
  if (workout.completedRounds >= total) {
    workout.status = "completed";
    workout.finishedAt = Date.now();
    workout.restUntil = null;
    playCue("finish");
    persistWorkout();
    render();
    releaseWakeLockIfIdle();
    return;
  }
  if (workout.restSeconds > 0) {
    workout.status = "resting";
    workout.restUntil = Date.now() + workout.restSeconds * 1000;
    workout.lastRestCue = null;
  } else {
    workout.status = "running";
  }
  persistWorkout();
  render();
}

function finishRest() {
  if (workout.status !== "resting") return;
  workout.status = "running";
  workout.restUntil = null;
  workout.lastRestCue = null;
  playCue("finish");
  persistWorkout();
  render();
}

function skipWorkoutRest() {
  if (workout.status === "resting") {
    workout.status = "running";
    workout.restUntil = null;
    workout.lastRestCue = null;
    persistWorkout();
    render();
  }
}

function handleWorkoutAction() {
  if (workout.status === "resting") skipWorkoutRest();
  else completeWorkoutRound();
}

function endWorkout() {
  workout.status = "setup";
  workout.completedRounds = 0;
  workout.startedAt = null;
  workout.finishedAt = null;
  workout.restUntil = null;
  workout.lastRestCue = null;
  persistWorkout();
  render();
  releaseWakeLockIfIdle();
}

function confirmEndWorkout() {
  if (window.confirm("¿Terminar el entrenamiento ahora? Se perderá el progreso de esta sesión.")) {
    endWorkout();
  }
}

function showMode(mode) {
  const training = mode === "training";
  elements.keepAwakeView.hidden = training;
  elements.trainingView.hidden = !training;
  elements.modeTabs.forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
}

function startTimer() {
  if (state.isRunning) {
    return;
  }

  if (state.hasCompletedDuration) {
    state.totalAccumulatedMs = 0;
    state.lapAccumulatedMs = 0;
    state.laps = [];
    state.hasCompletedDuration = false;
  }

  const now = getNow();
  state.isRunning = true;
  state.runStartedAt = now;
  state.lapStartedAt = now;
  persistState();
  requestWakeLock();
  render();
}

function pauseTimer({ automatic = false, now = getNow() } = {}) {
  if (!state.isRunning) {
    return;
  }

  const totalElapsed = getTotalElapsed(now);
  state.totalAccumulatedMs = state.durationMs > 0
    ? Math.min(totalElapsed, state.durationMs)
    : totalElapsed;
  state.lapAccumulatedMs = getLapElapsed(now);
  state.runStartedAt = null;
  state.lapStartedAt = null;
  state.isRunning = false;
  state.hasCompletedDuration = automatic;
  persistState();
  releaseWakeLockIfIdle();
  render();
}

function toggleTimer() {
  if (state.isRunning) {
    pauseTimer();
    return;
  }

  startTimer();
}

function resetTimer() {
  state.isRunning = false;
  state.totalAccumulatedMs = 0;
  state.lapAccumulatedMs = 0;
  state.runStartedAt = null;
  state.lapStartedAt = null;
  state.laps = [];
  state.hasCompletedDuration = false;
  persistState();
  releaseWakeLockIfIdle();
  render();
}

function setDuration() {
  const rawMinutes = elements.durationMinutes.value.trim();

  if (rawMinutes === "") {
    state.durationMs = 0;
    state.hasCompletedDuration = false;
    persistState();
    render();
    return;
  }

  const minutes = Number(rawMinutes.replace(",", "."));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    elements.durationStatus.textContent = "Escribe un valor entre 1 y 1440 minutos.";
    return;
  }

  state.durationMs = minutes * 60000;
  state.hasCompletedDuration = state.durationMs > 0
    && getTotalElapsed() >= state.durationMs;
  elements.durationMinutes.value = String(minutes);
  persistState();
  render();
}

function captureLap() {
  if (!state.isRunning) {
    return;
  }

  const now = getNow();
  const lapMs = getLapElapsed(now);
  const totalMs = getTotalElapsed(now);

  state.laps.push({
    index: state.laps.length + 1,
    lapMs,
    totalMs,
  });

  state.lapAccumulatedMs = 0;
  state.lapStartedAt = now;
  persistState();
  render();
}

function scheduleRenderLoop() {
  render();
  window.setTimeout(scheduleRenderLoop, 250);
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await requestWakeLock();
  } else {
    await releaseWakeLock();
  }

  render();
});

window.addEventListener("focus", () => {
  requestWakeLock();
});

window.addEventListener("beforeunload", () => {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
  }
});

elements.mainRing.addEventListener("click", toggleTimer);
elements.startPause.addEventListener("click", toggleTimer);
elements.resetButton.addEventListener("click", resetTimer);
elements.lapButton.addEventListener("click", captureLap);
elements.applyDuration.addEventListener("click", setDuration);
elements.modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => showMode(tab.dataset.mode));
});
elements.trainingSetup.addEventListener("submit", startWorkout);
elements.workoutAction.addEventListener("click", handleWorkoutAction);
document.querySelector("#end-workout").addEventListener("click", confirmEndWorkout);
elements.newTraining.addEventListener("click", endWorkout);
elements.durationMinutes.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  setDuration();
});

restoreState();
restoreWorkout();
render();
scheduleRenderLoop();

if (state.isRunning) {
  requestWakeLock();
}

if (["running", "resting"].includes(workout.status)) {
  requestWakeLock();
}
