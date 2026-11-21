const STORAGE_KEY = "nosleep-training-timer-state";
const WORKOUT_STORAGE_KEY = "nosleep-workout-state";
const TABATA_STORAGE_KEY = "nosleep-tabata-state";

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

const tabata = {
  status: "setup",
  workSeconds: 20,
  restSeconds: 10,
  intervalCount: 8,
  soundEnabled: true,
  voiceEnabled: true,
  interval: 1,
  phase: "work",
  phaseEndsAt: null,
  startedAt: null,
  finishedAt: null,
  lastCueSecond: null,
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
  tabataView: document.querySelector("#tabata-view"),
  trainingSetup: document.querySelector("#training-setup"),
  trainingCard: document.querySelector("#training-view .training-card"),
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
  tabataSetup: document.querySelector("#tabata-setup"),
  tabataCard: document.querySelector("#tabata-view .training-card"),
  tabataSetupError: document.querySelector("#tabata-setup-error"),
  tabataAudioNote: document.querySelector("#tabata-audio-note"),
  tabataWorkSeconds: document.querySelector("#tabata-work-seconds"),
  tabataRestSeconds: document.querySelector("#tabata-rest-seconds"),
  tabataIntervalCount: document.querySelector("#tabata-interval-count"),
  tabataSoundEnabled: document.querySelector("#tabata-sound-enabled"),
  tabataVoiceEnabled: document.querySelector("#tabata-voice-enabled"),
  tabataSession: document.querySelector("#tabata-session"),
  tabataComplete: document.querySelector("#tabata-complete"),
  tabataElapsed: document.querySelector("#tabata-elapsed"),
  tabataPhaseBanner: document.querySelector("#tabata-phase-banner"),
  tabataPhaseIcon: document.querySelector("#tabata-phase-icon"),
  tabataPhaseLabel: document.querySelector("#tabata-phase-label"),
  tabataPhaseInstruction: document.querySelector("#tabata-phase-instruction"),
  tabataCountdown: document.querySelector("#tabata-countdown"),
  tabataIntervalCountLabel: document.querySelector("#tabata-current-interval"),
  tabataProgressTrack: document.querySelector("#tabata-progress-track"),
  tabataSummary: document.querySelector("#tabata-summary"),
  endTabata: document.querySelector("#end-tabata"),
  newTabata: document.querySelector("#new-tabata"),
};

let audioContext = null;
let workoutFormInitialized = false;
let workoutProgressKey = "";
let tabataFormInitialized = false;
let tabataProgressKey = "";

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

function persistTabata() {
  localStorage.setItem(TABATA_STORAGE_KEY, JSON.stringify(tabata));
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

function restoreTabata() {
  const raw = localStorage.getItem(TABATA_STORAGE_KEY);
  if (!raw) return;

  try {
    const snapshot = JSON.parse(raw);
    tabata.status = ["setup", "running", "completed"].includes(snapshot.status) ? snapshot.status : "setup";
    tabata.workSeconds = Math.max(1, Number(snapshot.workSeconds) || 20);
    tabata.restSeconds = Math.max(1, Number(snapshot.restSeconds) || 10);
    tabata.intervalCount = Math.min(1000, Math.max(1, Number(snapshot.intervalCount) || 8));
    tabata.soundEnabled = snapshot.soundEnabled !== false;
    tabata.voiceEnabled = snapshot.voiceEnabled !== false;
    tabata.interval = Math.min(tabata.intervalCount, Math.max(1, Number(snapshot.interval) || 1));
    tabata.phase = snapshot.phase === "rest" ? "rest" : "work";
    tabata.phaseEndsAt = typeof snapshot.phaseEndsAt === "number" ? snapshot.phaseEndsAt : null;
    tabata.startedAt = typeof snapshot.startedAt === "number"
      ? snapshot.startedAt
      : tabata.status === "running" ? Date.now() : null;
    tabata.finishedAt = typeof snapshot.finishedAt === "number" ? snapshot.finishedAt : null;
    tabata.lastCueSecond = null;
    if (tabata.status === "running" && tabata.phaseEndsAt == null) {
      tabata.phaseEndsAt = Date.now() + tabata.workSeconds * 1000;
    }
  } catch {
    localStorage.removeItem(TABATA_STORAGE_KEY);
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
  const tabataIsActive = tabata.status === "running";
  if (!state.wakeLockSupported || (!state.isRunning && !workoutIsActive && !tabataIsActive) || document.visibilityState !== "visible") {
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
  if (!state.isRunning && !workoutIsActive && tabata.status !== "running") releaseWakeLock();
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
  renderTabata();
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
  elements.trainingCard.classList.toggle("session-active", isActive);
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

function getTabataElapsed(now = Date.now()) {
  if (tabata.startedAt == null) return 0;
  return Math.max(0, (tabata.finishedAt ?? now) - tabata.startedAt);
}

function renderTabata() {
  if (tabata.status === "running") advanceTabata(Date.now());

  const isActive = tabata.status === "running";
  elements.tabataCard.classList.toggle("session-active", isActive);
  elements.tabataSetup.hidden = isActive || tabata.status === "completed";
  elements.tabataSession.hidden = !isActive;
  elements.tabataComplete.hidden = tabata.status !== "completed";

  if (!tabataFormInitialized) {
    elements.tabataWorkSeconds.value = String(tabata.workSeconds);
    elements.tabataRestSeconds.value = String(tabata.restSeconds);
    elements.tabataIntervalCount.value = String(tabata.intervalCount);
    elements.tabataSoundEnabled.checked = tabata.soundEnabled;
    elements.tabataVoiceEnabled.checked = tabata.voiceEnabled;
    tabataFormInitialized = true;
  }

  const elapsed = formatDuration(getTabataElapsed(), true);
  if (elements.tabataElapsed.textContent !== elapsed) elements.tabataElapsed.textContent = elapsed;
  if (tabata.status === "completed") {
    elements.tabataSummary.textContent = `${tabata.intervalCount} intervalos · ${tabata.workSeconds} s de trabajo y ${tabata.restSeconds} s de descanso · ${formatDuration(getTabataElapsed(), true)}`;
  }

  const progressKey = `${tabata.intervalCount}-${tabata.interval}-${tabata.phase}-${tabata.status}`;
  if (progressKey !== tabataProgressKey) {
    tabataProgressKey = progressKey;
    elements.tabataProgressTrack.innerHTML = Array.from({ length: tabata.intervalCount }, (_, index) => {
      const interval = index + 1;
      const isDone = interval < tabata.interval || tabata.status === "completed";
      const isCurrent = interval === tabata.interval && tabata.status === "running";
      return `<span class="tabata-step${isDone ? " done" : ""}${isCurrent ? ` current ${tabata.phase}` : ""}" aria-label="Intervalo ${interval}${isDone ? ", completado" : isCurrent ? `, actual, ${tabata.phase === "work" ? "trabajo" : "descanso"}` : ""}">${interval}</span>`;
    }).join("");
  }

  if (isActive) {
    const isResting = tabata.phase === "rest";
    const remainingSeconds = Math.max(0, Math.ceil((tabata.phaseEndsAt - Date.now()) / 1000));
    elements.tabataPhaseBanner.classList.toggle("phase-resting", isResting);
    elements.tabataPhaseBanner.classList.toggle("phase-working", !isResting);
    elements.tabataPhaseIcon.textContent = isResting ? "Ⅱ" : "▶";
    elements.tabataPhaseLabel.textContent = isResting ? "DESCANSO" : "TRABAJO";
    elements.tabataPhaseInstruction.textContent = `Intervalo ${tabata.interval} de ${tabata.intervalCount}`;
    elements.tabataCountdown.textContent = formatClock(remainingSeconds);
    elements.tabataCountdown.classList.toggle("resting", isResting);
    elements.tabataIntervalCountLabel.textContent = `${tabata.interval} de ${tabata.intervalCount} intervalos`;
    if (remainingSeconds <= 3 && remainingSeconds > 0 && tabata.lastCueSecond !== remainingSeconds) {
      tabata.lastCueSecond = remainingSeconds;
      if (tabata.soundEnabled) playTabataTone("tick");
      if (tabata.voiceEnabled) speakTabata(["", "uno", "dos", "tres"][remainingSeconds]);
    }
  }
}

function advanceTabata(now) {
  let transitions = 0;
  while (tabata.status === "running" && tabata.phaseEndsAt != null && now >= tabata.phaseEndsAt && transitions < 2001) {
    transitions += 1;
    if (tabata.phase === "work") {
      tabata.phase = "rest";
      tabata.phaseEndsAt += tabata.restSeconds * 1000;
    } else {
      if (tabata.interval >= tabata.intervalCount) {
        tabata.status = "completed";
        tabata.finishedAt = tabata.phaseEndsAt;
        tabata.phaseEndsAt = null;
        tabata.lastCueSecond = null;
        break;
      }
      tabata.phase = "work";
      tabata.interval += 1;
      tabata.phaseEndsAt += tabata.workSeconds * 1000;
    }
    tabata.lastCueSecond = null;
  }

  if (transitions > 0) {
    if (tabata.status === "completed") {
      if (tabata.soundEnabled) playTabataTone("finish");
      if (tabata.voiceEnabled) speakTabata("Tabata completado. Buen trabajo.");
      releaseWakeLockIfIdle();
    } else {
      const cue = tabata.phase === "work"
        ? `Trabajo. Intervalo ${tabata.interval} de ${tabata.intervalCount}. ¡Vamos!`
        : `Descanso. Intervalo ${tabata.interval} de ${tabata.intervalCount}.`;
      if (tabata.soundEnabled) playTabataTone(tabata.phase);
      if (tabata.voiceEnabled) speakTabata(cue);
    }
    persistTabata();
  }
}

function speakTabata(message) {
  if (!tabata.voiceEnabled || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "es-ES";
    utterance.rate = 1.04;
    utterance.pitch = 1;
    utterance.volume = 1;
    const spanishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("es"));
    if (spanishVoice) utterance.voice = spanishVoice;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn("Spoken Tabata cues are not available", error);
  }
}

function playTabataTone(kind) {
  if (!tabata.soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "rest" ? 520 : kind === "finish" ? 1040 : 760;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "tick" ? 0.08 : 0.2, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "tick" ? 0.12 : 0.32));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === "tick" ? 0.14 : 0.34));
  } catch (error) {
    console.warn("Tabata sound cue could not be played", error);
  }
}

function startTabata(event) {
  event.preventDefault();
  const workSeconds = readWholeNumber(elements.tabataWorkSeconds.value, false);
  const restSeconds = readWholeNumber(elements.tabataRestSeconds.value, false);
  const intervalCount = readWholeNumber(elements.tabataIntervalCount.value, false);
  const totalMs = intervalCount == null || workSeconds == null || restSeconds == null
    ? null
    : intervalCount * (workSeconds + restSeconds) * 1000;
  if (workSeconds == null || restSeconds == null || intervalCount == null || intervalCount > 1000
    || !Number.isSafeInteger(workSeconds * 1000)
    || !Number.isSafeInteger(restSeconds * 1000)
    || !Number.isSafeInteger(totalMs)) {
    elements.tabataSetupError.textContent = "Escribe segundos e intervalos enteros mayores que cero. Se admiten hasta 1000 intervalos.";
    elements.tabataSetupError.hidden = false;
    return;
  }

  elements.tabataSetupError.hidden = true;
  tabata.workSeconds = workSeconds;
  tabata.restSeconds = restSeconds;
  tabata.intervalCount = intervalCount;
  tabata.soundEnabled = elements.tabataSoundEnabled.checked;
  tabata.voiceEnabled = elements.tabataVoiceEnabled.checked;
  tabata.interval = 1;
  tabata.phase = "work";
  tabata.status = "running";
  tabata.startedAt = Date.now();
  tabata.finishedAt = null;
  tabata.phaseEndsAt = tabata.startedAt + workSeconds * 1000;
  tabata.lastCueSecond = null;
  tabataProgressKey = "";
  if (tabata.soundEnabled) playTabataTone("work");
  if (tabata.voiceEnabled) speakTabata(`¡Vamos! Trabajo. Intervalo uno de ${intervalCount}.`);
  persistTabata();
  requestWakeLock();
  render();
}

function endTabata() {
  tabata.status = "setup";
  tabata.interval = 1;
  tabata.phase = "work";
  tabata.phaseEndsAt = null;
  tabata.startedAt = null;
  tabata.finishedAt = null;
  tabata.lastCueSecond = null;
  persistTabata();
  releaseWakeLockIfIdle();
  render();
}

function confirmEndTabata() {
  if (window.confirm("¿Terminar el Tabata ahora? Se perderá el progreso de esta sesión.")) endTabata();
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
  const tabataMode = mode === "tabata";
  elements.keepAwakeView.hidden = training || tabataMode;
  elements.trainingView.hidden = !training || tabataMode;
  elements.tabataView.hidden = !tabataMode;
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
elements.tabataSetup.addEventListener("submit", startTabata);
elements.endTabata.addEventListener("click", confirmEndTabata);
elements.newTabata.addEventListener("click", endTabata);
elements.durationMinutes.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  setDuration();
});

restoreState();
restoreWorkout();
restoreTabata();
render();
scheduleRenderLoop();

if (state.isRunning) {
  requestWakeLock();
}

if (["running", "resting"].includes(workout.status)) {
  requestWakeLock();
}

if (tabata.status === "running") {
  requestWakeLock();
}

if (!("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) {
  elements.tabataAudioNote.textContent = "La voz no está disponible en este navegador; se usarán los pitidos.";
}
