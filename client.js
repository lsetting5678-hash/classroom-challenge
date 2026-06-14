// ---------------- Config & Constants ----------------
const OPT_Q2 = ["1. 網路安全守則", "2. 我的社交超能力", "3. 幸福商店模擬", "4. 母親節感恩手作", "5. 說話小火車", "6. 考試前應對策略", "7. 專注力遊戲"];
const OPT_CLASSES = ["101", "106", "205", "301", "404"];
const OPT_Q5 = ["A. 情緒穩定", "B. 溝通表達", "C. 勇敢求助", "D. 自訂目標"];
const chartColors = [
  'var(--color-red-grad)',
  'var(--color-blue-grad)',
  'var(--color-yellow-grad)',
  'var(--color-green-grad)',
  'var(--color-purple-grad)',
  'var(--color-teal-grad)',
  'var(--color-orange-grad)'
];

// ---------------- Application State ----------------
let currentRoom = '';
let studentClass = '';
let studentClientId = '';
let heartbeatInterval = null;
let currentStep = 1;
const totalSteps = 5; // Q2, Q3, Q4, Q5, Q6

// MQTT Client Configuration
let mqttClient = null;
let activeStudents = {}; // Teacher-side active student tracker: { clientId: { class, lastSeen } }

// ---------------- Navigation & View Routing ----------------
function hideAll() {
  document.getElementById('role-selection').classList.add('hidden');
  document.getElementById('teacher-setup').classList.add('hidden');
  document.getElementById('teacher-dashboard').classList.add('hidden');
  document.getElementById('student-setup').classList.add('hidden');
  document.getElementById('student-quiz-container').classList.add('hidden');
  document.body.classList.remove('teacher-mode');
}

function showRoleSelection() {
  hideAll();
  document.getElementById('role-selection').classList.remove('hidden');
}

function showTeacherSetup() {
  hideAll();
  document.getElementById('teacher-setup').classList.remove('hidden');
}

function showStudentSetup() {
  hideAll();
  document.getElementById('student-setup').classList.remove('hidden');
}

// ---------------- UI Helpers ----------------
function selectSingle(element, gridId) {
  const grid = document.getElementById(gridId);
  grid.querySelectorAll('.single-select').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
}

function toggleMulti(element) {
  element.classList.toggle('selected');
}

function showToast(message, isTeacher = false) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${isTeacher ? 'toast-teacher' : ''}`;
  toast.innerHTML = `<i class="fa-solid ${isTeacher ? 'fa-bell' : 'fa-info-circle'}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  
  // Slide out and remove toast after 3.5s
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------- MQTT Broker Connection ----------------
function initMqtt(clientIdPrefix, onConnectCallback) {
  const clientId = clientIdPrefix + '_' + Math.random().toString(16).substr(2, 8);
  
  showToast("正在連線到即時網路服務...");
  
  // Using public EMQX secure WebSockets broker
  const client = mqtt.connect('wss://broker.emqx.io:8086/mqtt', {
    clientId: clientId,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    showToast("即時網路連線成功！");
    if (onConnectCallback) onConnectCallback(client);
  });

  client.on('error', (err) => {
    console.error("MQTT Error: ", err);
    showToast("連線異常，正在嘗試重新連線...");
  });

  client.on('offline', () => {
    showToast("網路離線，請檢查網路連線。");
  });

  return client;
}

// ---------------- Teacher Mode Logic ----------------
function startTeacherMode() {
  const roomInput = document.getElementById('teacher-room-input').value.trim();
  if (!roomInput) return alert("請輸入房間代碼！");
  
  currentRoom = roomInput;
  document.body.classList.add('teacher-mode');
  hideAll();
  document.getElementById('teacher-dashboard').classList.remove('hidden');
  document.getElementById('display-room-code').innerText = roomInput;

  // Initialize charts outline
  initCharts();

  // Load existing records from LocalStorage (for stability across page refreshes)
  updateDashboard();

  // Generate QR Code for student quick login
  const studentUrl = window.location.origin + window.location.pathname + '?room=' + roomInput;
  document.getElementById('qr-link-input').value = studentUrl;

  try {
    new QRious({
      element: document.getElementById('qr-canvas'),
      value: studentUrl,
      size: 260,
      level: 'H',
      foreground: '#46178f',
      background: '#ffffff'
    });
    // Auto-open QR Code Modal so teacher can project it immediately
    openQrModal();
  } catch (e) {
    console.error("QR Code generation failed: ", e);
  }

  // Initialize MQTT
  mqttClient = initMqtt('teacher', (client) => {
    const subTopic = `classroom_challenge/rooms/${currentRoom}/submissions`;
    const hbTopic = `classroom_challenge/rooms/${currentRoom}/heartbeat`;
    const resetTopic = `classroom_challenge/rooms/${currentRoom}/reset`;
    
    client.subscribe(subTopic);
    client.subscribe(hbTopic);
    client.subscribe(resetTopic);
    
    console.log(`Teacher subscribed to topics for room: ${currentRoom}`);
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const subTopic = `classroom_challenge/rooms/${currentRoom}/submissions`;
      const hbTopic = `classroom_challenge/rooms/${currentRoom}/heartbeat`;
      const resetTopic = `classroom_challenge/rooms/${currentRoom}/reset`;

      if (topic === subTopic) {
        // Handle new student submission
        handleIncomingSubmission(payload);
      } else if (topic === hbTopic) {
        // Handle student heartbeat
        handleIncomingHeartbeat(payload);
      } else if (topic === resetTopic) {
        // Room was cleared by another dashboard instance
        handleLocalReset();
      }
    } catch (e) {
      console.error("Failed to parse message: ", e);
    }
  });

  // Start active student checker (prune students offline for > 16s)
  setInterval(pruneOfflineStudents, 3000);
}

function handleIncomingSubmission(record) {
  if (!record || !record.id) return;

  const storageKey = 'cc_submissions_' + currentRoom;
  let submissions = JSON.parse(localStorage.getItem(storageKey) || '[]');

  // Check for duplicates
  if (submissions.some(s => s.id === record.id)) return;

  // Save submission
  submissions.push(record);
  localStorage.setItem(storageKey, JSON.stringify(submissions));

  // Visual cues
  showToast(`來自 ${record.studentClass} 班的同學完成挑戰！ 🚀`, true);
  
  // Confetti burst for new submissions on the big board (mini effect)
  confetti({
    particleCount: 40,
    angle: 60,
    spread: 55,
    origin: { x: 0 }
  });
  confetti({
    particleCount: 40,
    angle: 120,
    spread: 55,
    origin: { x: 1 }
  });

  // Re-render dashboard
  updateDashboard();
}

function handleIncomingHeartbeat(hb) {
  if (!hb || !hb.clientId) return;
  activeStudents[hb.clientId] = {
    studentClass: hb.studentClass,
    lastSeen: Date.now()
  };
  updateOnlineCountDisplay();
}

function pruneOfflineStudents() {
  const now = Date.now();
  let updated = false;
  for (const cid in activeStudents) {
    if (now - activeStudents[cid].lastSeen > 16000) { // Offline if no heartbeat for 16 seconds
      delete activeStudents[cid];
      updated = true;
    }
  }
  if (updated) {
    updateOnlineCountDisplay();
  }
}

function updateOnlineCountDisplay() {
  const count = Object.keys(activeStudents).length;
  document.getElementById('online-count').innerText = count;
}

function confirmResetRoom() {
  if (confirm("確定要清除目前房間的所有作答數據嗎？此動作無法復原。")) {
    const resetTopic = `classroom_challenge/rooms/${currentRoom}/reset`;
    if (mqttClient) {
      mqttClient.publish(resetTopic, JSON.stringify({ action: 'reset', timestamp: Date.now() }), { qos: 1 });
    }
    handleLocalReset();
  }
}

function handleLocalReset() {
  const storageKey = 'cc_submissions_' + currentRoom;
  localStorage.removeItem(storageKey);
  activeStudents = {};
  updateOnlineCountDisplay();
  updateDashboard();
  showToast("房間數據已清空！");
}

// ---------------- Student Mode Logic ----------------
function startStudentQuiz() {
  const roomInput = document.getElementById('student-room-input').value.trim();
  const classOpt = document.querySelector('#setup-class-grid .selected');
  
  if (!roomInput) return alert("請輸入房間代碼！");
  if (!classOpt) return alert("請選擇你的班級！");

  currentRoom = roomInput;
  studentClass = classOpt.getAttribute('data-val');
  studentClientId = 'student_' + Math.random().toString(36).substr(2, 9);

  // Exclude student's own class from Q3 & Q4 options
  document.querySelectorAll('.class-opt').forEach(opt => {
    if (opt.getAttribute('data-val') === studentClass) {
      opt.classList.add('hidden'); // Exclude from display
    } else {
      opt.classList.remove('hidden');
    }
  });

  // Establish MQTT connection for student
  mqttClient = initMqtt('student', (client) => {
    // Start heartbeat
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 8000);
    
    // Switch to quiz page
    hideAll();
    document.getElementById('student-quiz-container').classList.remove('hidden');
    currentStep = 1;
    updateProgress();
  });
}

function sendHeartbeat() {
  if (!mqttClient || !currentRoom) return;
  const hbTopic = `classroom_challenge/rooms/${currentRoom}/heartbeat`;
  const hbData = {
    clientId: studentClientId,
    studentClass: studentClass,
    timestamp: Date.now()
  };
  mqttClient.publish(hbTopic, JSON.stringify(hbData));
}

function nextStep(nextId) {
  // Check if user made a choice in current step before moving forward
  if (currentStep === 1) {
    const q2Sel = document.querySelectorAll('#step-q2 .selected');
    if (q2Sel.length === 0) return alert("請至少選擇一個單元！");
  } else if (currentStep === 2) {
    const q3Sel = document.querySelectorAll('#step-q3 .selected');
    if (q3Sel.length === 0) return alert("請至少選擇一個班級！");
  } else if (currentStep === 3) {
    const q4Sel = document.querySelectorAll('#step-q4 .selected');
    if (q4Sel.length === 0) return alert("請選擇一個進步最多的班級！");
  } else if (currentStep === 4) {
    const q5Sel = document.querySelectorAll('#step-q5 .selected');
    if (q5Sel.length === 0) return alert("請選擇一個超人目標！");
  }

  // Go to next step
  document.querySelectorAll('.quiz-step').forEach(step => step.classList.add('hidden'));
  document.getElementById(nextId).classList.remove('hidden');
  currentStep++;
  updateProgress();
}

function updateProgress() {
  document.getElementById('current-step-num').innerText = currentStep;
  
  // Q2 is step 1, Q6 is step 5
  const pct = Math.round(((currentStep - 1) / totalSteps) * 100);
  document.getElementById('current-step-pct').innerText = pct + '%';
  document.getElementById('quiz-progress').style.width = pct + '%';
}

function submitStudentQuiz() {
  const getVals = (selector) => Array.from(document.querySelectorAll(selector)).map(el => el.getAttribute('data-val'));
  
  const ansQ2 = getVals('#step-q2 .selected');
  const ansQ3 = getVals('#step-q3 .selected');
  const ansQ4 = document.querySelector('#step-q4 .selected')?.getAttribute('data-val') || '';
  const ansQ5 = document.querySelector('#step-q5 .selected')?.getAttribute('data-val') || '';
  const ansQ6 = document.getElementById('q6-text').value.trim();

  // Create submission record
  const record = {
    id: studentClass + '_' + studentClientId + '_' + Date.now(),
    timestamp: Date.now(),
    studentClass: studentClass,
    q2: ansQ2,
    q3: ansQ3,
    q4: ansQ4,
    q5: ansQ5,
    q6: ansQ6
  };

  // Publish to MQTT
  const subTopic = `classroom_challenge/rooms/${currentRoom}/submissions`;
  if (mqttClient) {
    mqttClient.publish(subTopic, JSON.stringify(record), { qos: 1 }, (err) => {
      if (err) {
        console.error("Submission failed: ", err);
        alert("傳送失敗，請重新送出！");
        return;
      }
      
      // Clean up local heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (mqttClient) mqttClient.end();
      
      // Show success screen with massive confetti
      showSuccessScreen();
    });
  } else {
    alert("連線中斷，請重新整理頁面。");
  }
}

function showSuccessScreen() {
  document.getElementById('student-quiz-container').innerHTML = `
    <div class="success-screen fade-in" style="text-align: center; padding: 40px 10px;">
      <div class="emoji-header" style="font-size: 5em;">🎉</div>
      <h1 style="color: #10b981; margin-bottom: 20px; font-size: 2.8em;">數據傳送成功！</h1>
      <h2 style="font-weight: 700; color: #4b5563; font-size: 1.5em; line-height: 1.5;">
        太棒了！你的挑戰數據已升空🚀<br>快抬頭看看老師的大螢幕看板吧！
      </h2>
      <button class="nav-btn" style="max-width: 280px; margin: 40px auto 0 auto;" onclick="window.location.reload()">
        <i class="fa-solid fa-rotate-left"></i> 再玩一次
      </button>
    </div>
  `;
  
  // Perfect school celebratory confetti explosion
  const duration = 4 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    // since particles fall down, animate a bit higher than random
    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
  }, 250);
}

// ---------------- Chart & Dashboard Rendering ----------------
function initCharts() {
  buildBarChartHTML('chart-q2', OPT_Q2);
  buildBarChartHTML('chart-q4', OPT_CLASSES);
  buildBarChartHTML('chart-q5', OPT_Q5);
}

function buildBarChartHTML(containerId, optionsList) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  optionsList.forEach((opt, index) => {
    const color = chartColors[index % chartColors.length];
    container.innerHTML += `
      <div class="bar-row">
        <div class="bar-label" title="${opt}">${opt}</div>
        <div class="bar-track">
          <div class="bar-fill" id="${containerId}-fill-${index}" style="background: ${color}; width: 0%;">
            <span class="bar-value" id="${containerId}-val-${index}">0</span>
          </div>
        </div>
      </div>
    `;
  });
}

function updateDashboard() {
  const storageKey = 'cc_submissions_' + currentRoom;
  const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
  
  document.getElementById('total-responses').innerText = data.length;

  // Setup counts
  let tallyQ2 = {}, tallyQ3 = {}, tallyQ4 = {}, tallyQ5 = {}, submissionsQ6 = [];
  OPT_Q2.forEach(k => tallyQ2[k] = 0);
  OPT_CLASSES.forEach(k => { tallyQ3[k] = 0; tallyQ4[k] = 0; });
  OPT_Q5.forEach(k => tallyQ5[k] = 0);

  // Tally responses
  data.forEach(sub => {
    if (sub.q2) sub.q2.forEach(ans => { if (tallyQ2[ans] !== undefined) tallyQ2[ans]++; });
    if (sub.q3) sub.q3.forEach(ans => { if (tallyQ3[ans] !== undefined) tallyQ3[ans]++; });
    if (sub.q4 && tallyQ4[sub.q4] !== undefined) tallyQ4[sub.q4]++;
    if (sub.q5 && tallyQ5[sub.q5] !== undefined) tallyQ5[sub.q5]++;
    if (sub.q6 && sub.q6.trim() !== '') {
      submissionsQ6.push({ studentClass: sub.studentClass, content: sub.q6, timestamp: sub.timestamp });
    }
  });

  // Update animated bar charts helper
  const updateBars = (containerId, optionsList, tallyDict) => {
    const maxVal = Math.max(...Object.values(tallyDict), 0);
    optionsList.forEach((opt, idx) => {
      const val = tallyDict[opt];
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const fillEl = document.getElementById(`${containerId}-fill-${idx}`);
      const valEl = document.getElementById(`${containerId}-val-${idx}`);
      
      if (fillEl) fillEl.style.width = pct + '%';
      if (valEl) {
        valEl.innerText = val > 0 ? val + ' 票' : '0';
      }
    });
  };

  updateBars('chart-q2', OPT_Q2, tallyQ2);
  updateBars('chart-q4', OPT_CLASSES, tallyQ4);
  updateBars('chart-q5', OPT_Q5, tallyQ5);

  // Update Q3 Leaderboard (best teammate)
  const q3Arr = Object.keys(tallyQ3).map(k => ({ name: k + '班', votes: tallyQ3[k] })).sort((a, b) => b.votes - a.votes);
  const lbContainer = document.getElementById('chart-q3');
  const lbEmpty = document.getElementById('q3-empty');
  
  lbContainer.innerHTML = '';
  
  const hasVotes = q3Arr.some(item => item.votes > 0);
  if (hasVotes) {
    lbEmpty.classList.add('hidden');
    q3Arr.forEach((item, index) => {
      if (item.votes === 0) return; // Hide zero votes
      const rank = index + 1;
      let rClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
      
      lbContainer.innerHTML += `
        <li class="leaderboard-item" style="animation-delay: ${index * 0.1}s">
          <div class="rank-badge ${rClass}">${rank}</div>
          <div class="leaderboard-name"><i class="fa-solid fa-users"></i> ${item.name}</div>
          <div class="votes">${item.votes} 票</div>
        </li>
      `;
    });
  } else {
    lbEmpty.classList.remove('hidden');
  }

  // Update Q6 Message Wall
  const msgContainer = document.getElementById('chart-q6');
  const msgEmpty = document.getElementById('q6-empty');
  msgContainer.innerHTML = '';

  if (submissionsQ6.length > 0) {
    msgEmpty.classList.add('hidden');
    submissionsQ6.forEach((sub, index) => {
      // Rotate cards dynamically
      const themeIndex = (index % 5) + 1; // Themes 1-5
      msgContainer.innerHTML += `
        <div class="message-note msg-theme-${themeIndex}">
          <div class="class-tag"><i class="fa-solid fa-graduation-cap"></i> 來自 ${sub.studentClass} 班的同學：</div>
          <div class="message-content">${escapeHTML(sub.content)}</div>
        </div>
      `;
    });
  } else {
    msgEmpty.classList.remove('hidden');
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// ---------------- Speech Dictation (Web Speech API) ----------------
let recognition = null;

function startDictation() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("您的瀏覽器不支援語音辨識功能，請直接鍵盤輸入！(推薦使用 Google Chrome 瀏覽器)");
    return;
  }
  
  const micBtn = document.getElementById('mic-btn');
  const micStatus = document.getElementById('mic-status');

  // Toggle active dictation
  if (micBtn.classList.contains('recording')) {
    if (recognition) recognition.stop();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "zh-TW"; // Taiwan Traditional Chinese

  recognition.onstart = () => {
    micBtn.classList.add('recording');
    micBtn.querySelector('span').innerText = "🛑 錄音中... (點擊停止)";
    micStatus.innerText = "請開始說話...";
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const textarea = document.getElementById('q6-text');
    textarea.value = (textarea.value + " " + transcript).trim();
  };

  recognition.onend = () => {
    micBtn.classList.remove('recording');
    micBtn.querySelector('span').innerText = "點我語音輸入";
    micStatus.innerText = "";
  };

  recognition.onerror = (e) => {
    console.error("Speech Recognition Error: ", e.error);
    micStatus.innerText = "沒有聽清楚，可以再試一次！";
    setTimeout(() => { if(micStatus.innerText.includes("沒有聽清楚")) micStatus.innerText = ""; }, 3000);
  };

  recognition.start();
}

// ---------------- QR Code Modal Helpers ----------------
function openQrModal() {
  document.getElementById('qr-modal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qr-modal').classList.add('hidden');
}

function copyQrLink() {
  const linkInput = document.getElementById('qr-link-input');
  linkInput.select();
  linkInput.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    navigator.clipboard.writeText(linkInput.value);
    showToast("連結複製成功！");
  } catch (err) {
    // Fallback copy method
    document.execCommand('copy');
    showToast("連結複製成功！");
  }
}

// ---------------- URL Query Parameter Auto-Fill ----------------
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    showStudentSetup();
    document.getElementById('student-room-input').value = roomParam;
    showToast("已自動載入房間代碼：" + roomParam);
  }
});

