let bank = [];
let currentTest = [];
let userAnswers = [];
let currentIndex = 0;
let currentUser = null;
let timerInterval;

let pendingSubject = null;
let pendingPool = [];
let diffTime = 900; 
let orderMode = 'random'; 
let isExamMode = false;

// 1. Ma'lumotlarni yuklash va Tozalash (3 ta variant bo'lsa 4-sini qo'shish)
async function loadData() {
    const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
    let globalIndex = 0;
    
    for (const f of files) {
        try {
            const res = await fetch(f);
            const data = await res.json();
            const subject = f.split('.')[0];
            
            data.forEach((q) => {
                // Dublikatlarni tozalash
                let rawOpts = q.options.filter(o => o && o.toString().trim() !== ''); 
                let uniqueOpts = [...new Set(rawOpts)]; 
                
                let correctText = q.options[q.answer]; 
                
                // Aynan 3 ta qolgan bo'lsa:
                if (uniqueOpts.length === 3) {
                    uniqueOpts.push("Barcha javoblar to'g'ri");
                }
                
                let newAnsIdx = uniqueOpts.indexOf(correctText);
                if (newAnsIdx === -1) newAnsIdx = 0;

                bank.push({ ...q, id: `q_${globalIndex}`, subject, options: uniqueOpts, answer: newAnsIdx });
                globalIndex++;
            });
        } catch (e) { console.warn(f + " yuklanmadi. Serverda tekshiring."); }
    }
}

window.onload = async () => {
    await loadData();
    // Tungi rejim (Eye comfort) by default CSS da. Agar light kerak bo'lsa o'zgartiradi.
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
    }
};

function handleLogin() {
    const name = document.getElementById('student-name').value.trim();
    if (name.length < 2) return alert("Ismingizni kiriting!");
    
    currentUser = name;
    document.getElementById('display-name').innerText = name;
    updateStats();
    
    switchScreen('welcome-screen', 'dashboard-screen');
    document.getElementById('global-nav').classList.remove('hidden');
}

// O'zlashtirildi va Xatolar qat'iy 800 tadan hisoblanadi
function updateStats() {
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    
    document.getElementById('learned-count').innerText = userDb.learned.length;
    document.getElementById('error-count').innerText = userDb.errors.length;
    
    // Xatolar tugmasini bloklash / ochish
    const errBtn = document.getElementById('error-work-btn');
    if(userDb.errors.length === 0) {
        errBtn.style.opacity = '0.5';
        errBtn.onclick = () => alert("Sizda xatolar yo'q. Barakalla!");
    } else {
        errBtn.style.opacity = '1';
        errBtn.onclick = () => openSetup('errors', 'Xatolar ustida ishlash');
    }
}

function toggleChapters() {
    const grid = document.getElementById('chapters-grid');
    grid.classList.toggle('hidden');
    if(!grid.classList.contains('hidden')) renderChapterGrid();
}

function renderChapterGrid() {
    const grid = document.getElementById('chapters-grid');
    grid.innerHTML = '';
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };

    let totalChunks = Math.ceil(bank.length / 20);
    for (let i = 0; i < totalChunks; i++) {
        let start = i * 20;
        let end = Math.min(start + 20, bank.length);
        let chunk = bank.slice(start, end);
        
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        let btn = document.createElement('button');
        btn.className = 'chap-btn';
        let progClass = learnedInChunk === chunk.length ? 'chap-prog full' : 'chap-prog';
        btn.innerHTML = `${start + 1}-${end} <span class="${progClass}">${learnedInChunk}/${chunk.length}</span>`;
        
        btn.onclick = () => { pendingSubject = 'sequential'; pendingPool = chunk; showSetup(`Bo'lim: ${start+1}-${end}`); };
        grid.appendChild(btn);
    }
}

// 4 ta fanning 10 ta leveli
function openLevelsModal(subjectId, subjectName) {
    document.getElementById('level-modal-title').innerText = subjectName;
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    let subPool = bank.filter(q => q.subject === subjectId);
    
    for(let i=0; i<10; i++) {
        let start = i * 20;
        let end = start + 20;
        let chunk = subPool.slice(start, end);
        if(chunk.length === 0) break; 
        
        let learnedInChunk = chunk.filter(q => userDb.learned.includes(q.id)).length;
        
        let btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="lvl-num">${i+1}</span>
                <span>${start + 1}-${end}</span>
            </div>
            <span class="${learnedInChunk === chunk.length ? 'text-success' : 'text-sec'}">
                ${learnedInChunk}/${chunk.length}
            </span>
        `;
        btn.onclick = () => { 
            closeLevelsModal();
            pendingSubject = subjectId; 
            pendingPool = chunk; 
            showSetup(`${subjectName} (Level ${i+1})`); 
        };
        grid.appendChild(btn);
    }
    document.getElementById('levels-modal').classList.remove('hidden');
}

function closeLevelsModal() { document.getElementById('levels-modal').classList.add('hidden'); }

function openSetup(type, title) {
    const userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    isExamMode = false;

    if (type === 'errors') {
        pendingPool = bank.filter(q => userDb.errors.includes(q.id));
    } else if (type === 'mixed') {
        pendingPool = [...bank]; // 1-800
    }
    
    pendingSubject = type;
    showSetup(title);
}

function showSetup(title) {
    document.getElementById('setup-title').innerText = title;
    switchScreen('dashboard-screen', 'setup-screen');
    if (pendingSubject === 'sequential') setOrder('sequential', document.querySelector('.order-seq'));
    else setOrder('random', document.querySelector('.order-random'));
}

function setDifficulty(level, btn) {
    document.querySelectorAll('.difficulty-control .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(level === 'easy') diffTime = 1200; 
    if(level === 'medium') diffTime = 900; 
    if(level === 'hard') diffTime = 600; 
}

function setOrder(mode, btn) {
    document.querySelectorAll('.order-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderMode = mode;
}

// 8-tugma: 60 talik imtihon
function startExamMode() {
    isExamMode = true;
    let examPool = [];
    const subjects = ['musiqa_nazariyasi', 'cholgu_ijrochiligi', 'vokal_ijrochiligi', 'metodika_repertuar'];
    
    subjects.forEach(sub => {
       let subQ = bank.filter(q => q.subject === sub);
       let shuffled = shuffleArray([...subQ]).slice(0, 15);
       examPool = examPool.concat(shuffled);
    });
    
    pendingPool = shuffleArray(examPool); // 60 ta aralashtirildi
    diffTime = 3600; // 60 daqiqa
    orderMode = 'random'; 
    confirmSetupAndStart(true);
}

function confirmSetupAndStart(skipSetup = false) {
    let selectedQs = [];
    let count = isExamMode ? 60 : 20;
    
    // Faqat savollar ketma-ketligiga ta'sir qiladi!
    let poolCopy = [...pendingPool];
    if (orderMode === 'random') {
        selectedQs = shuffleArray(poolCopy).slice(0, Math.min(count, poolCopy.length));
    } else {
        selectedQs = poolCopy.slice(0, Math.min(count, poolCopy.length)); 
    }

    // Variantlar har doim aralashtiriladi
    currentTest = selectedQs.map(q => {
        let correctText = q.options[q.answer];
        let shuffledOpts = shuffleArray([...q.options]);
        return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
    });

    if(!skipSetup) switchScreen('setup-screen', 'test-screen');
    else switchScreen('dashboard-screen', 'test-screen');

    initTestUI();
}

function initTestUI() {
    document.getElementById('exit-test-btn').classList.remove('hidden');
    document.getElementById('exam-timer').classList.remove('hidden');

    userAnswers = new Array(currentTest.length).fill(null);
    currentIndex = 0;
    
    clearInterval(timerInterval);
    startTimer(diffTime);
    renderMap();
    renderAllQuestions(); 
}

function startTimer(seconds) {
    let time = seconds;
    document.getElementById('exam-timer').innerText = formatTime(time);
    timerInterval = setInterval(() => {
        time--;
        document.getElementById('exam-timer').innerText = formatTime(time);
        if (time <= 0) { clearInterval(timerInterval); finishExam(); }
    }, 1000);
}
function formatTime(secs) {
    let m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${s < 10 ? '0'+s : s}`;
}

function renderAllQuestions() {
    const area = document.getElementById('all-questions-area');
    area.innerHTML = currentTest.map((q, idx) => `
        <div class="q-block ${idx === currentIndex ? 'active-q' : 'blurred-q'}" id="q-block-${idx}">
            <div class="q-meta">
                SAVOL <span id="num-indicator-${idx}" class="q-num">${idx+1}</span> / ${currentTest.length}
            </div>
            <div class="q-text">${q.q}</div>
            <div class="options-box" id="opts-${idx}">
                ${q.options.map((opt, optIdx) => `
                    <button class="option-btn" id="btn-${idx}-${optIdx}" onclick="checkAns(${idx}, ${optIdx})" ${userAnswers[idx] ? 'disabled' : ''}>
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    updateMap();
    scrollToActive();
}

function updateFocus() {
    for(let i = 0; i < currentTest.length; i++) {
        const block = document.getElementById(`q-block-${i}`);
        if(block) {
            if(i === currentIndex) {
                block.classList.remove('blurred-q');
                block.classList.add('active-q');
                playSpinAnimation(i + 1, `num-indicator-${i}`); // Casino style spinner
            } else {
                block.classList.remove('active-q');
                block.classList.add('blurred-q');
            }
        }
    }
    scrollToActive();
    updateMap();
}

// Rapid Spin Animation
function playSpinAnimation(targetNum, elementId) {
    let el = document.getElementById(elementId);
    if(!el) return;
    el.classList.add('spin-number');
    let count = 0;
    let interval = setInterval(() => {
        el.innerText = Math.floor(Math.random() * currentTest.length) + 1;
        count++;
        if(count >= 8) {
            clearInterval(interval);
            el.innerText = targetNum;
            el.classList.remove('spin-number');
        }
    }, 30);
}

function scrollToActive() {
    const activeBlock = document.getElementById(`q-block-${currentIndex}`);
    if (activeBlock) activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function checkAns(qIdx, optIdx) {
    if (qIdx !== currentIndex || userAnswers[qIdx]) return;
    
    const isCorrect = optIdx === currentTest[qIdx].answer;
    userAnswers[qIdx] = { selected: optIdx, isCorrect };
    
    let userDb = JSON.parse(localStorage.getItem(`stats_${currentUser}`)) || { learned: [], errors: [] };
    const qId = currentTest[qIdx].id;
    const clickedBtn = document.getElementById(`btn-${qIdx}-${optIdx}`);
    
    if (isCorrect) {
        userDb.errors = userDb.errors.filter(id => id !== qId); 
        if (!userDb.learned.includes(qId)) userDb.learned.push(qId);
        clickedBtn.classList.add('magic-correct');
    } else {
        if (!userDb.errors.includes(qId)) userDb.errors.push(qId);
        clickedBtn.classList.add('magic-wrong');
    }
    
    localStorage.setItem(`stats_${currentUser}`, JSON.stringify(userDb));
    updateStats();
    
    const options = document.getElementById(`opts-${qIdx}`).getElementsByTagName('button');
    for(let btn of options) btn.disabled = true;

    if (userAnswers.filter(a => a !== null).length === currentTest.length) {
        document.getElementById('finish-btn').classList.remove('hidden');
    }

    setTimeout(() => { 
        let next = userAnswers.findIndex(ans => ans === null); 
        if (next !== -1) { currentIndex = next; updateFocus(); } 
    }, 600);
}

function finishExam() {
    clearInterval(timerInterval);
    const correct = userAnswers.filter(a => a?.isCorrect).length;
    let total = currentTest.length;
    let percent = Math.round((correct / total) * 100);
    
    // Result logic
    let msg, color;
    if (percent >= 90) {
        msg = "Barakalla! Siz haqiqiy profisiz!"; color = "var(--success)";
    } else if (percent >= 70) {
        msg = "Yaxshi natija! Yana ozgina harakat qiling."; color = "var(--primary)";
    } else if (percent >= 50) {
        msg = "Yomon emas. Ko'rdingizmi, siz hali yana mashq qilishingiz kerak."; color = "var(--warning)";
    } else {
        msg = "Yana urinib ko'ring! Xatolar ustida albatta ishlang."; color = "var(--error)";
    }

    // Donut chart update
    document.getElementById('donut-chart').style.setProperty('--percentage', `${percent}%`);
    document.getElementById('donut-chart').style.setProperty('--exam-color', color);
    document.getElementById('exam-percentage').innerText = `${percent}%`;
    document.getElementById('exam-percentage').style.color = color;
    
    document.getElementById('exam-message').innerText = msg;
    document.getElementById('exam-correct-count').innerText = correct;
    document.getElementById('exam-total-count').innerText = total;

    document.getElementById('exam-result-modal').classList.remove('hidden');
}

function restartCurrentTest() {
    document.getElementById('exam-result-modal').classList.add('hidden');
    confirmSetupAndStart(true); // Mavjud pendingPool bilan qayta ishga tushadi
}

function renderMap() {
    const map = document.getElementById('indicator-map');
    map.innerHTML = currentTest.map((_, i) => `<div class="dot" id="dot-${i}" onclick="goTo(${i})">${i+1}</div>`).join('');
}

function updateMap() {
    let answered = userAnswers.filter(a => a !== null).length;
    document.getElementById('progress-fill').style.width = `${(answered / currentTest.length) * 100}%`;
    
    let activeDot = null;
    currentTest.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        if(dot) {
            dot.className = 'dot';
            if (i === currentIndex) { dot.classList.add('active-dot'); activeDot = dot; }
            if (userAnswers[i]) dot.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
        }
    });

    // Avtomatik scroll (qotib qolmasligi uchun)
    if (activeDot) {
        activeDot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

// Boshqaruv
function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function goTo(i) { currentIndex = i; updateFocus(); }
function move(step) { let n = currentIndex + step; if (n >= 0 && n < currentTest.length) { currentIndex = n; updateFocus(); } }
function toggleTheme() { 
    document.body.classList.toggle('dark-mode'); 
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
}

// Chiqish faqat bitta orqaga (Reload qilinmaydi)
function exitToHome() {
    clearInterval(timerInterval);
    document.getElementById('exam-result-modal').classList.add('hidden');
    document.getElementById('exit-test-btn').classList.add('hidden');
    document.getElementById('exam-timer').classList.add('hidden');
    switchScreen('test-screen', 'dashboard-screen');
    updateStats();
}
function goHome() {
    document.getElementById('setup-screen').classList.replace('active', 'hidden');
    document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
}
function switchScreen(hideId, showId) {
    document.getElementById(hideId).classList.replace('active', 'hidden');
    document.getElementById(showId).classList.replace('hidden', 'active');
}
