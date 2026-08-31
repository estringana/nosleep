const STORAGE_KEY = "nosleep-training-timer-state";

const state = {
  isRunning: false,
  totalAccumulatedMs: 0,
  lapAccumulatedMs: 0,
  runStartedAt: null,
  lapStartedAt: null,
  laps: [],
  wakeLock: null,
  wakeLockSupported: "wakeLock" in navigator,
};

const elements = {
  mainRing: document.querySelector("#main-ring"),
  totalTime: document.querySelector("#total-time"),
  lapTime: document.querySelector("#lap-time"),
  ringStatus: document.querySelector("#ring-status"),
  wakeStatus: document.querySelector("#wake-status"),
  wakeHint: document.querySelector("#wake-hint"),
  startPause: document.querySelector("#start-pause"),
  lapButton: document.querySelector("#lap-button"),
  resetButton: document.querySelector("#reset-button"),
  lapsList: document.querySelector("#laps-list"),
  lapsSummary: document.querySelector("#laps-summary"),
  emptyState: document.querySelector("#empty-state"),
};

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
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
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
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function requestWakeLock() {
  if (!state.wakeLockSupported || !state.isRunning || document.visibilityState !== "visible") {
    return;
  }

  if (state.wakeLock) {
    updateWakeStatus();
    return;
  }

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
      updateWakeStatus();
    });
  } catch (error) {
    console.error("Wake lock failed", error);
    state.wakeLock = null;
  }

  updateWakeStatus();
}

async function releaseWakeLock() {
  if (!state.wakeLock) {
    updateWakeStatus();
    return;
  }

  try {
    await state.wakeLock.release();
  } catch (error) {
    console.error("Wake lock release failed", error);
  } finally {
    state.wakeLock = null;
    updateWakeStatus();
  }
}

function updateWakeStatus() {
  if (!state.wakeLockSupported) {
    elements.wakeStatus.textContent = "No compatible";
    elements.wakeHint.textContent =
      "Este navegador no expone Screen Wake Lock API. Usa Safari reciente o Chromium.";
    return;
  }

  if (state.wakeLock) {
    elements.wakeStatus.textContent = "Activo";
    elements.wakeHint.textContent =
      "La pantalla debería seguir despierta mientras esta pestaña siga visible.";
    return;
  }

  if (state.isRunning && document.visibilityState !== "visible") {
    elements.wakeStatus.textContent = "En espera";
    elements.wakeHint.textContent =
      "Devuelve esta pestaña al primer plano para reacquirir el wake lock.";
    return;
  }

  if (state.isRunning) {
    elements.wakeStatus.textContent = "Reintentando";
    elements.wakeHint.textContent =
      "El cronómetro sigue corriendo, pero el navegador todavía tiene que conceder o restaurar el wake lock.";
    return;
  }

  elements.wakeStatus.textContent = "Inactivo";
  elements.wakeHint.textContent = "Pulsa empezar con esta pestaña en primer plano.";
}

function renderLaps() {
  elements.lapsSummary.textContent = `${state.laps.length} ${
    state.laps.length === 1 ? "vuelta guardada" : "vueltas guardadas"
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
  const lapElapsed = getLapElapsed(now);

  elements.totalTime.textContent = formatDuration(totalElapsed, true);
  elements.lapTime.textContent = formatDuration(lapElapsed, totalElapsed >= 3600000);
  elements.startPause.textContent = state.isRunning ? "Pausar" : "Empezar";
  elements.lapButton.disabled = !state.isRunning;
  elements.ringStatus.textContent = state.isRunning ? "Corriendo" : "Listo";
  elements.mainRing.classList.toggle("running", state.isRunning);

  renderLaps();
  updateWakeStatus();
}

function startTimer() {
  if (state.isRunning) {
    return;
  }

  const now = getNow();
  state.isRunning = true;
  state.runStartedAt = now;
  state.lapStartedAt = now;
  persistState();
  requestWakeLock();
  render();
}

function pauseTimer() {
  if (!state.isRunning) {
    return;
  }

  const now = getNow();
  state.totalAccumulatedMs = getTotalElapsed(now);
  state.lapAccumulatedMs = getLapElapsed(now);
  state.runStartedAt = null;
  state.lapStartedAt = null;
  state.isRunning = false;
  persistState();
  releaseWakeLock();
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
  persistState();
  releaseWakeLock();
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

restoreState();
render();
scheduleRenderLoop();

if (state.isRunning) {
  requestWakeLock();
}
