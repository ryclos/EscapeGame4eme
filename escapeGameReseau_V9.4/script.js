// ======================================================================
// SCRIPT.JS — Escape Game Réseau (version avec PDF)
// ======================================================================

// -----------------------------
// Références DOM
// -----------------------------
const splash = document.getElementById("splash");
const gameSection = document.getElementById("gameSection");
const gameContent = document.getElementById("gameContent");
const voiceText = document.getElementById("voiceText");
const glitchOverlay = document.getElementById("glitchOverlay");
const timerEl = document.getElementById("timer");
const status = document.getElementById("status");
const agentsDisplay = document.getElementById("agentsDisplay");

const agentInputs = [
  document.getElementById("agent1"),
  document.getElementById("agent2"),
  document.getElementById("agent3"),
  document.getElementById("agent4"),
];

// -----------------------------
// Audios HTML
// -----------------------------
const audioRadio = document.getElementById("audio_radio_static");
const audioIntro = document.getElementById("audio_intro_agents");
const audioConnexion = document.getElementById("audio_connexion_secure");
const audioGlitch = document.getElementById("audio_glitch");
const audioParasite = document.getElementById("audio_parasite_radio");
const audioClic = document.getElementById("audio_clic");
const audioInternet = document.getElementById("audio_internet");
const audioAmbiance = document.getElementById("audio_ambiance");
const audioErreur = document.getElementById("audio_erreur");

// Audios supplémentaires
const audioSuspenseMid = document.getElementById("audio_suspense_mid");      // 5 minutes restantes
const audioAlerteFinale = document.getElementById("audio_alerte_finale");    // 30 secondes restantes
const audioErreurReseau = document.getElementById("audio_erreur_reseau");    // échec
const audioExtinction = document.getElementById("audio_extinction_systeme"); // échec

// -----------------------------
// Timer & score
// -----------------------------
let totalSeconds = 600;     // 10 minutes
let remaining = totalSeconds;
let timerId = null;

// Note max : 20 la première fois, 16 ensuite
let hasFailedOnce = false;

// Alertes timer
let suspensePlayed = false;     // 5 min
let finalAlertPlayed = false;   // 30 s

// -----------------------------
// Suivi pour le rapport PDF
// -----------------------------
let teacherName = "";
let agentsNames = [];

const enigmeStats = {
  1: { attempts: 0, success: false },
  2: { attempts: 0, success: false },
  3: { attempts: 0, success: false },
  4: { attempts: 0, success: false },
  5: { attempts: 0, success: false },
};

let lastMissionWin = false;
let lastScore = 0;
let lastMaxScore = 20;
let lastTimeRemaining = 0;

// ======================================================================
// Utilitaires interface
// ======================================================================

function setVoiceMessage(text) {
  if (!text) {
    voiceText.style.display = "none";
    voiceText.textContent = "";
  } else {
    voiceText.style.display = "block";
    voiceText.textContent = text;
  }
}

function disableSelection() {
  document.body.style.userSelect = "none";
  document.onselectstart = () => false;
}

function enableSelection() {
  document.body.style.userSelect = "";
  document.onselectstart = null;
}

// 1 erreur = une tentative supplémentaire (au-delà de la 1re) sur une énigme
function countErrors() {
  let errors = 0;
  for (let i = 1; i <= 5; i++) {
    const a = enigmeStats[i]?.attempts || 0;
    errors += Math.max(0, a - 1);
  }
  return errors;
}

// Niveau de compétence Cycle 4 par énigme (formative)
function getCompetenceLevel(enigmeId) {
  const e = enigmeStats[enigmeId];
  if (!e || !e.success) return "Non acquis";
  if (e.attempts === 1) return "Très bonne maîtrise";
  if (e.attempts === 2) return "Satisfaisant";
  return "Fragile";
}

// Timer avec alertes 5 min et 30 s
function startTimer() {
  remaining = totalSeconds;
  timerEl.textContent = formatTime(remaining);

  suspensePlayed = false;
  finalAlertPlayed = false;

  if (timerId) clearInterval(timerId);

  timerId = setInterval(() => {
    remaining--;
    timerEl.textContent = formatTime(remaining);

    // Alerte à 5 minutes
    if (!suspensePlayed && remaining === 300) {
      suspensePlayed = true;
      safePlay(audioSuspenseMid, { volume: 1, loop: false });
      setVoiceMessage("Attention agents : il ne reste plus que 5 minutes.");
    }

    // Alerte à 30 secondes
    if (!finalAlertPlayed && remaining === 30) {
      finalAlertPlayed = true;
      safePlay(audioAlerteFinale, { volume: 1, loop: false });
      setVoiceMessage("ALERTE FINALE : plus que 30 secondes pour sauver le réseau.");
    }

    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      endMission(false);
    }
  }, 1000);
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function safePlay(audio, { volume = 1, loop = false } = {}) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    audio.loop = loop;
    audio.play().catch(() => {});
  } catch (e) {}
}

async function playSequentialAudios(audios, volumes) {
  for (let i = 0; i < audios.length; i++) {
    const audio = audios[i];
    if (!audio) continue;
    audio.volume = volumes[i] || 1;
    audio.currentTime = 0;

    await new Promise((res) => {
      audio.onended = res;
      audio.play().catch(() => res());
    });
  }
}

// ======================================================================
// Séquence de démarrage
// ======================================================================

async function startSequence() {
  splash.classList.add("hidden");
  gameSection.classList.remove("hidden");

  agentsNames = agentInputs
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);

  agentsDisplay.innerHTML = agentsNames
    .map((name) => `<span>${name}</span>`)
    .join("");

  setVoiceMessage("Authentification…");
  glitchOverlay.classList.remove("hidden");

  await playSequentialAudios(
    [audioParasite, audioConnexion, audioIntro],
    [0.5, 0.8, 1]
  );

  glitchOverlay.classList.add("hidden");
  setVoiceMessage("Agents prêts. Cliquez pour commencer.");

  gameContent.innerHTML = `<button id="go">Commencer mission</button>`;

  document.getElementById("go").onclick = () => {
    setVoiceMessage("");
    status.textContent = "Statut : mission en cours";
    safePlay(audioAmbiance, { volume: 0.4, loop: true });
    showEnigme1();
    startTimer();
  };
}

// ======================================================================
// Énigme 1 — Connexion physique
// ======================================================================

function showEnigme1() {
  gameContent.innerHTML = `
    <h3>Énigme 1 — Connexion physique</h3>
    <p>Observez la situation et rétablissez la connexion.</p>
    <div class="network-row" id="networkRow" style="position:relative;">
      <img src="images/image_1.png" id="networkImage">
      <img src="images/image_3.png" id="cableImage" style="display:none;position:absolute;width:120px;z-index:10;">
    </div>
    <div style="margin-top:15px;">
      <input id="labelInput" placeholder="Mot de passe">
      <button id="checkLabel">Valider</button>
    </div>
    <div id="feedback" style="margin-top:10px;color:#0f0;"></div>
  `;

  const cableImage = document.getElementById("cableImage");
  const networkImage = document.getElementById("networkImage");

  const zoneCable = document.createElement("div");
  const zoneSwitch = document.createElement("div");

  zoneCable.style.position = "absolute";
  zoneCable.style.left = "981px";
  zoneCable.style.top = "895px";
  zoneCable.style.width = "60px";
  zoneCable.style.height = "60px";
  zoneCable.style.cursor = "pointer";
  zoneCable.style.zIndex = 20;

  zoneSwitch.style.position = "absolute";
  zoneSwitch.style.left = "663px";
  zoneSwitch.style.top = "743px";
  zoneSwitch.style.width = "90px";
  zoneSwitch.style.height = "60px";
  zoneSwitch.style.zIndex = 20;

  document.getElementById("networkRow").appendChild(zoneCable);
  document.getElementById("networkRow").appendChild(zoneSwitch);

  let dragging = false;
  let cableOK = false;

  zoneCable.addEventListener("mousedown", () => {
    dragging = true;
    cableImage.style.display = "block";
    disableSelection();
  });

  document.addEventListener("mousemove", (e) => {
    if (dragging) {
      const rect = gameContent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Ajustement curseur -> câble (si besoin, affiner ici)
      cableImage.style.left = `${x - cableImage.width / 2 + 150}px`;
      cableImage.style.top = `${y - cableImage.height / 2 - 80}px`;
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!dragging) return;

    const rect = zoneSwitch.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      cableOK = true;
      networkImage.src = "images/image_2.png";
      cableImage.style.display = "none";
      document.getElementById("feedback").textContent = "Connexion établie ✅";
      safePlay(audioClic);
    } else {
      cableImage.style.display = "none";
    }

    dragging = false;
    enableSelection();
  });

  document.getElementById("checkLabel").onclick = () => {
    const v = document.getElementById("labelInput").value.trim().toUpperCase();
    enigmeStats[1].attempts++;
    if (v === "CONNEXION" && cableOK) {
      enigmeStats[1].success = true;
      document.getElementById("feedback").textContent =
        "Correct ✅ Accès autorisé";
      safePlay(audioClic);
      setTimeout(showEnigme2, 1000);
    } else {
      document.getElementById("feedback").textContent =
        "Erreur ❌ Branche le câble puis saisis CONNEXION.";
      safePlay(audioParasite);
    }
  };
}

// ======================================================================
// Énigme 2 — Connexion Wi-Fi
// ======================================================================

function showEnigme2() {
  gameContent.innerHTML = `
    <h3>Énigme 2 — Connexion Wi-Fi</h3>
    <p>Connectez cet ordinateur au réseau.</p>
    <div style="position:relative;width:95%;max-width:900px;">
      <img id="wifiImage" src="images/image_wifi_off.png" style="width:100%;">
      <div id="wifiZone" style="position:absolute;left:480px;top:380px;width:40px;height:40px;cursor:pointer;z-index:10;"></div>
      <select id="wifiSelect" style="display:none;position:absolute;left:480px;top:330px;z-index:20;">
        <option value="">-- Choisir un réseau --</option>
        <option value="inconnu">Réseau inconnu</option>
        <option value="agent">Réseau agent sécurisé</option>
        <option value="hackers">Les hackers libres</option>
      </select>
    </div>
    <div id="wifiFeedback" style="margin-top:12px;color:#0f0;"></div>
    <div style="margin-top:20px;">
      <input id="wifiPassword" placeholder="Mot de passe">
      <button id="wifiValidate">Valider</button>
    </div>
  `;

  const wifiImage = document.getElementById("wifiImage");
  const wifiSelect = document.getElementById("wifiSelect");
  const wifiZone = document.getElementById("wifiZone");
  const feedback = document.getElementById("wifiFeedback");

  wifiZone.addEventListener("click", () => {
    if (wifiSelect.disabled) return;
    wifiSelect.style.display = "block";
  });

  wifiSelect.addEventListener("change", () => {
    if (wifiSelect.value === "agent") {
      wifiImage.src = "images/image_wifi_on.png";
      feedback.textContent = "Connexion établie ✅";
      safePlay(audioInternet);

      // Masquer le menu une fois le bon réseau choisi
      wifiSelect.style.display = "none";
      wifiSelect.disabled = true;

      setTimeout(() => (feedback.textContent = ""), 2000);
    } else if (wifiSelect.value === "inconnu" || wifiSelect.value === "hackers") {
      wifiImage.src = "images/image_reseau_erreur.png";
      feedback.textContent = "Réseau non sécurisé ❌";
      setTimeout(() => {
        wifiImage.src = "images/image_wifi_off.png";
        feedback.textContent = "";
        wifiSelect.value = "";
        wifiSelect.disabled = false;
        wifiSelect.style.display = "none";
      }, 10000);
    } else {
      wifiImage.src = "images/image_wifi_off.png";
      feedback.textContent = "";
    }
  });

  document.getElementById("wifiValidate").onclick = () => {
    const v = document.getElementById("wifiPassword").value.trim().toUpperCase();
    enigmeStats[2].attempts++;
    if (v === "SIGNAL" && wifiSelect.value === "agent") {
      enigmeStats[2].success = true;
      feedback.textContent = "Accès autorisé ✅";
      safePlay(audioClic);
      setTimeout(showEnigme3, 1200);
    } else {
      feedback.textContent =
        "Erreur ❌ Sélectionne le bon réseau et saisis SIGNAL.";
      safePlay(audioParasite);
    }
  };
}

// ======================================================================
// Énigme 3 — Attribution IP
// ======================================================================

function showEnigme3() {
  gameContent.innerHTML = `
    <h3>Énigme 3 — Attribution IP</h3>
    <p>Complétez la configuration réseau des postes PC3 et PC4.</p>
    <div style="position: relative; width: 100%; max-width: 1280px;">
      <img src="images/reseau_on.png" style="width: 100%; height: auto;">
      <input id="ipPC3" style="position:absolute; bottom:309px; left:159px; width:170px; background:#000; color:#0f0; border:1px solid #0f0; font-family:monospace; padding:4px; text-align:center;">
      <input id="ipPC4" style="position:absolute; bottom:309px; left:610px; width:170px; background:#000; color:#0f0; border:1px solid #0f0; font-family:monospace; padding:4px; text-align:center;">
    </div>
    <div style="margin-top:20px;"><button id="validerIP" disabled>Valider</button></div>
    <div id="ipFeedback" style="margin-top:10px; color:#0f0;"></div>
  `;

  const ipPC3 = document.getElementById("ipPC3");
  const ipPC4 = document.getElementById("ipPC4");
  const validerBtn = document.getElementById("validerIP");
  const feedback = document.getElementById("ipFeedback");

  const validateFields = () => {
    validerBtn.disabled = !(ipPC3.value.trim() && ipPC4.value.trim());
  };

  ipPC3.addEventListener("input", validateFields);
  ipPC4.addEventListener("input", validateFields);

  validerBtn.addEventListener("click", () => {
    const ip3 = ipPC3.value.trim();
    const ip4 = ipPC4.value.trim();
    enigmeStats[3].attempts++;
    if (ip3 === "192.168.1.12" && ip4 === "192.168.1.13") {
      enigmeStats[3].success = true;
      feedback.textContent = "Configuration réussie ✅";
      safePlay(audioClic);
      setTimeout(showEnigme4, 1000);
    } else {
      feedback.textContent = "Erreur ❌ Recommence.";
      safePlay(audioErreur);
      ipPC3.value = "";
      ipPC4.value = "";
      validerBtn.disabled = true;
    }
  });
}

// ======================================================================
// Énigme 4 — Test de connectivité
// ======================================================================

function showEnigme4() {
  const agent1 = agentInputs[0].value.trim() || "agent1";

  gameContent.innerHTML = `
    <h3>Énigme 4 — Test de connectivité</h3>
    <p>Utilise la commande nécessaire pour vérifier si le serveur communique avec PC3.</p>

    <div style="position:relative; width:100%; max-width:1000px;">
      <img id="pingImage" src="images/image_ping.png" style="width:100%; height:auto;">

      <div id="pingField" style="position:absolute; top: 276px; left: 492px;">
        <input id="pingCommand"
          value="C:\\agent\\${agent1}>"
          style="width:222px; padding:4px; font-family:monospace;
                 background:#000; color:#0f0; border:1px solid #0f0;">
      </div>
    </div>

    <div id="pingFeedback" style="margin-top:10px; color:#0f0;"></div>

    <div style="margin-top:20px;">
      <button id="validatePing">Valider</button>
      <button id="nextStep" style="display:none;">Dernière étape</button>
    </div>
  `;

  const input = document.getElementById("pingCommand");
  const fieldContainer = document.getElementById("pingField");
  const feedback = document.getElementById("pingFeedback");
  const pingImage = document.getElementById("pingImage");
  const validate = document.getElementById("validatePing");
  const nextBtn = document.getElementById("nextStep");

  let locked = false;

  validate.addEventListener("click", () => {
    if (locked) return;

    const fullCmd = input.value.trim();
    const prefix = `C:\\agent\\${agent1}>`;

    enigmeStats[4].attempts++;

    fieldContainer.style.display = "none";

    if (
      fullCmd.toLowerCase().startsWith(prefix.toLowerCase()) &&
      fullCmd.slice(prefix.length).trim().toLowerCase() === "ping 192.168.1.12"
    ) {
      enigmeStats[4].success = true;
      pingImage.src = "images/image_ping_on.png";
      feedback.textContent = "Connexion établie ✅";
      nextBtn.style.display = "inline-block";
      safePlay(audioClic);
      nextBtn.onclick = () => {
        showEnigme5();
      };
    } else {
      pingImage.src = "images/image_ping_off.png";
      feedback.textContent = "Commande incorrecte. Réessaie dans 10 secondes.";
      safePlay(audioErreur);
      input.disabled = true;
      validate.disabled = true;
      locked = true;

      setTimeout(() => {
        pingImage.src = "images/image_ping.png";
        feedback.textContent = "";
        input.value = `C:\\agent\\${agent1}>`;
        fieldContainer.style.display = "block";
        input.disabled = false;
        validate.disabled = false;
        locked = false;
      }, 10000);
    }
  });
}

// ======================================================================
// Énigme 5 — Algorigramme de dépannage
// ======================================================================

function showEnigme5() {
  gameContent.innerHTML = `
    <h3>Énigme 5 — Algorigramme de dépannage</h3>
    <p>Complétez l’algorigramme du réseau en plaçant les étiquettes aux bons endroits.</p>

    <div id="flowchartContainer" style="position:relative; margin-top:20px;">
      <img src="images/algorigramme_5.png" id="flowchartImg">

      <!-- Zones de dépôt (coordonnées calculées) -->
      <div id="drop1" class="dropzone" style="top:122px; left:136px; width:260px; height:90px;"></div>
      <div id="drop2" class="dropzone" style="top:198px; left:-58px; width:260px; height:90px;"></div>
      <div id="drop3" class="dropzone" style="top:274px; left:155px; width:260px; height:90px;"></div>
      <div id="drop4" class="dropzone" style="top:411px; left:155px; width:260px; height:90px;"></div>
      <div id="drop5" class="dropzone" style="top:601px; left:155px; width:260px; height:90px;"></div>
    </div>

    <!-- Vignettes -->
    <div id="vignetteZone" style="margin-top:20px; display:flex; flex-wrap:wrap; gap:10px;">
      <div class="draggable" draggable="true" data-drop="drop1">Mettre les différents éléments du réseau sous tension</div>
      <div class="draggable" draggable="true" data-drop="drop2">Le terminal est-il en connexion filaire ?</div>
      <div class="draggable" draggable="true" data-drop="drop3">Vérifier la connexion wifi au réseau</div>
      <div class="draggable" draggable="true" data-drop="drop4">Vérifier le routage du terminal (adresse IP, masque de sous-réseau)</div>
      <div class="draggable" draggable="true" data-drop="drop5">Le terminal (PC) communique-t-il avec le serveur ?</div>
    </div>

    <div style="margin-top:20px;">
      <button id="validerAlgo">Valider</button>
      <div id="algoFeedback" style="margin-top:10px; color:#0f0;"></div>
    </div>
  `;

  const draggables = document.querySelectorAll('.draggable');
  const dropzones = document.querySelectorAll('.dropzone');
  const vignetteZone = document.getElementById("vignetteZone");

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Mélanger l’ordre d’affichage des étiquettes (bas de l’écran)
  const shuffledInit = shuffleArray(Array.from(draggables));
  shuffledInit.forEach(el => vignetteZone.appendChild(el));

  function resetVignettes() {
    const shuffled = shuffleArray(Array.from(draggables));
    shuffled.forEach(v => {
      v.style.position = "relative";
      v.style.top = "0";
      v.style.left = "0";
      v.style.width = "";
      v.style.height = "";
      v.style.lineHeight = "";
      v.style.display = "";
      vignetteZone.appendChild(v);
    });
  }

  draggables.forEach(el => {
    el.setAttribute("draggable", "true");
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.getAttribute('data-drop'));
      e.dataTransfer.setDragImage(el, 20, 20);
    });
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.background = 'rgba(0,255,0,0.1)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.background = 'rgba(0,40,0,0.25)';
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.background = 'rgba(0,40,0,0.25)';
      const id = e.dataTransfer.getData('text/plain');
      const dragged = document.querySelector(`[data-drop="${id}"]`);
      if (dragged) {
        zone.innerHTML = '';
        zone.appendChild(dragged);

        // Occupation complète, texte lisible sur plusieurs lignes
        dragged.style.position = "absolute";
        dragged.style.top = "0";
        dragged.style.left = "0";
        dragged.style.width = "100%";
        dragged.style.height = "100%";
        dragged.style.display = "flex";
        dragged.style.alignItems = "center";
        dragged.style.justifyContent = "center";
        dragged.style.textAlign = "center";
        dragged.style.whiteSpace = "normal";
        dragged.style.lineHeight = "1.2";
        dragged.style.padding = "6px";
        dragged.style.boxSizing = "border-box";
        dragged.style.overflow = "hidden";
        dragged.style.fontSize = "14px";
        dragged.style.margin = "0";
      }
    });
  });

  document.getElementById("validerAlgo").onclick = () => {
    enigmeStats[5].attempts++;

    const correct =
      document.getElementById("drop1").textContent.includes("sous tension") &&
      document.getElementById("drop2").textContent.includes("connexion filaire") &&
      document.getElementById("drop3").textContent.includes("wifi") &&
      document.getElementById("drop4").textContent.includes("routage") &&
      document.getElementById("drop5").textContent.includes("serveur");

    const feedback = document.getElementById("algoFeedback");

    if (correct) {
      enigmeStats[5].success = true;
      feedback.textContent = "Algorigramme complété correctement ✅";
      safePlay(audioClic);
      setTimeout(() => {
        safePlay(new Audio("audios/fanfare_victoire.mp3"));
        endMission(true);
      }, 1000);
    } else {
      feedback.textContent = "Il y a des erreurs ❌ Corrige-les.";
      safePlay(audioErreur);
      resetVignettes();
    }
  };
}

// ======================================================================
// Fin de mission (victoire / échec) + PDF
// ======================================================================

function endMission(win) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (audioAmbiance) {
    audioAmbiance.pause();
    audioAmbiance.currentTime = 0;
  }

  lastMissionWin = win;
  lastTimeRemaining = Math.max(0, remaining);

  if (win) {
    // Header : arrêter le clignotement "INSTABLE" et afficher "RÉSEAU RESTAURÉ"
    const headerSpan = document.querySelector("header h1 .blink") || document.querySelector("header h1 span");
    if (headerSpan) {
      headerSpan.classList.remove("blink");
      headerSpan.classList.add("restored");
      headerSpan.textContent = "RÉSEAU RESTAURÉ";
    }

    const maxScore = hasFailedOnce ? 16 : 20;
    const ratio = lastTimeRemaining / totalSeconds;
    const errors = countErrors();

    // Barème temps : pénalité à partir de 6 min restantes
    let timePenalty = 0;
    if (ratio >= 0.60) timePenalty = 0;        // ≥ 6:00 restantes
    else if (ratio >= 0.45) timePenalty = 1;
    else if (ratio >= 0.30) timePenalty = 2;
    else timePenalty = 3;

    let score = maxScore - timePenalty;

    // Pénalité erreurs : 1 point par tentative supplémentaire
    score -= errors * 1;

    if (score < 0) score = 0;
    if (score > maxScore) score = maxScore;

    lastScore = score;
    lastMaxScore = maxScore;

    setVoiceMessage("Mission réussie.");

    gameContent.innerHTML = `
      <div class="final-screen">
        <h2>Mission réussie</h2>
        <p>Score : <strong>${score} / ${maxScore}</strong></p>
        <table class="score-table">
          <tr>
            <th>Temps total</th>
            <td>${formatTime(totalSeconds)}</td>
          </tr>
          <tr>
            <th>Temps restant</th>
            <td>${formatTime(lastTimeRemaining)}</td>
          </tr>
          <tr>
            <th>Première tentative</th>
            <td>${hasFailedOnce ? "Non (score max 16)" : "Oui (score max 20)"}</td>
          </tr>
          <tr>
            <th>Erreurs</th>
            <td>${errors}</td>
          </tr>
        </table>
        <button id="downloadPDF">Télécharger le rapport PDF</button>
        <button id="reloadGame">Recommencer</button>
      </div>
    `;

    status.textContent = "Statut : mission réussie";

  } else {
    hasFailedOnce = true;
    lastScore = 0;
    lastMaxScore = 16;
    lastTimeRemaining = 0;

    setVoiceMessage("Mission échouée.");

    // Chaînage : erreur_réseau puis extinction_système
    if (audioErreurReseau && audioExtinction) {
      audioErreurReseau.onended = () => {
        safePlay(audioExtinction, { volume: 1, loop: false });
      };
      safePlay(audioErreurReseau, { volume: 1, loop: false });
    } else {
      safePlay(audioErreur || audioExtinction);
    }

    gameContent.innerHTML = `
      <div class="final-screen">
        <h2>Mission échouée</h2>
        <p>Le temps est écoulé ou la mission a échoué.</p>
        <p>Vous pouvez recommencer : la note maximale sera alors de 16.</p>
        <p>Redémarrage automatique dans <span id="retryCountdown">60</span> secondes…</p>
        <button id="downloadPDF">Télécharger le rapport PDF</button>
        <button id="retryNow">Recommencer maintenant</button>
      </div>
    `;

    status.textContent = "Statut : mission échouée";

    let remainingRetry = 60;
    const countdownSpan = document.getElementById("retryCountdown");

    const retryInterval = setInterval(() => {
      remainingRetry--;
      if (countdownSpan) countdownSpan.textContent = remainingRetry;
      if (remainingRetry <= 0) {
        clearInterval(retryInterval);
        window.location.reload();
      }
    }, 1000);

    const retryBtn = document.getElementById("retryNow");
    if (retryBtn) {
      retryBtn.onclick = () => {
        clearInterval(retryInterval);
        window.location.reload();
      };
    }
  }

  // Boutons communs (PDF et reload)
  const pdfBtn = document.getElementById("downloadPDF");
  if (pdfBtn) {
    pdfBtn.onclick = generatePDFScore;
  }
  const reloadBtn = document.getElementById("reloadGame");
  if (reloadBtn) {
    reloadBtn.onclick = () => {
      window.location.reload();
    };
  }
}

// ======================================================================
// Génération du PDF — jsPDF
// ======================================================================

function generatePDFScore() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Impossible de générer le PDF (jsPDF non chargé).");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 10;

  doc.setFont("courier", "normal");
  doc.setFontSize(16);
  doc.text("Escape Game Reseau - Rapport de mission", 10, y);
  y += 10;

  doc.setFontSize(11);
  const dateStr = new Date().toLocaleString();
  doc.text(`Date : ${dateStr}`, 10, y); y += 6;

  doc.text(`Enseignant : ${teacherName || "Non renseigne"}`, 10, y); y += 6;

  if (agentsNames.length > 0) {
    doc.text(`Agents : ${agentsNames.join(", ")}`, 10, y);
    y += 8;
  } else {
    doc.text("Agents : (non renseignes)", 10, y);
    y += 8;
  }

  // Résumé mission
  doc.setFontSize(12);
  doc.text("Résumé de la mission", 10, y); y += 6;
  doc.setFontSize(11);
  doc.text(`Statut : ${lastMissionWin ? "REUSSIE" : "ECHOUÉE"}`, 10, y); y += 6;
  doc.text(`Score : ${lastScore} / ${lastMaxScore}`, 10, y); y += 6;
  doc.text(`Temps total : ${formatTime(totalSeconds)}`, 10, y); y += 6;
  doc.text(`Temps restant : ${formatTime(lastTimeRemaining)}`, 10, y); y += 10;

  // Évaluation des compétences (Cycle 4)
  doc.setFontSize(12);
  doc.text("Évaluation des compétences (Cycle 4)", 10, y);
  y += 6;
  doc.setFontSize(11);

  const competences = {
    1: "Identifier un dysfonctionnement matériel",
    2: "Choisir une solution de connexion",
    3: "Configurer un réseau (adressage IP)",
    4: "Tester une communication réseau",
    5: "Appliquer une démarche de dépannage"
  };

  for (let i = 1; i <= 5; i++) {
    const level = getCompetenceLevel(i);
    doc.text(`• ${competences[i]} : ${level}`, 10, y);
    y += 6;
    if (y > 280 && i < 5) {
      doc.addPage();
      y = 10;
    }
  }

  y += 4;

  // Détail par énigme
  doc.setFontSize(12);
  doc.text("Détail par énigme", 10, y); y += 6;
  doc.setFontSize(11);

  for (let i = 1; i <= 5; i++) {
    const e = enigmeStats[i];
    const statusText = e.success ? "Réussie" : "Non réussie";
    const attemptsText = e.attempts === 0 ? "0" : (e.attempts > 2 ? "2+" : String(e.attempts));
    doc.text(
      `Énigme ${i} : ${statusText} | Tentatives : ${attemptsText}`,
      10,
      y
    );
    y += 6;
    if (y > 280 && i < 5) {
      doc.addPage();
      y = 10;
    }
  }

  doc.save("rapport_escape_game_reseau.pdf");
}

// ======================================================================
// Lancement depuis le formulaire d’identification
// ======================================================================

document.getElementById("startForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const teacher = document.getElementById("teacherName");
  teacherName = teacher.value.trim() || "Enseignant";
  if (!teacher.value.trim()) teacher.value = "Enseignant";
  startSequence();
});
