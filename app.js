// 화면(클라이언트) 코드 - API 키는 서버에만 있고, 여기서는 /api/analyze만 호출합니다.

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 서버 제한과 동일하게 유지 (Vercel 요청 본문 한도 4.5MB)

let selectedFile = null;

const pdfFileInput = document.getElementById('pdfFile');
const fileInfo = document.getElementById('fileInfo');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const generateBtn = document.getElementById('generateBtn');
const dropZone = document.getElementById('dropZone');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultSection = document.getElementById('resultSection');
const errorBox = document.getElementById('errorBox');
const copyBtn = document.getElementById('copyBtn');
const accessCodeBox = document.getElementById('accessCodeBox');
const accessCodeInput = document.getElementById('accessCodeInput');

// ---------- 유틸 ----------
let toastTimer;
function showNotification(message) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { notif.style.opacity = '0'; }, 2500);
}

function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function resetFile() {
    selectedFile = null;
    generateBtn.disabled = true;
    fileInfo.classList.add('hidden');
    fileInfo.classList.remove('flex');
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/25');
}

// ---------- 파일 선택 ----------
pdfFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    resetFile();
    errorBox.classList.add('hidden');

    if (file.type !== 'application/pdf') {
        showNotification('PDF 파일만 업로드할 수 있습니다.');
        pdfFileInput.value = '';
        return;
    }
    if (file.size > MAX_FILE_BYTES) {
        showNotification('4MB 이하의 PDF만 업로드할 수 있습니다.');
        pdfFileInput.value = '';
        return;
    }

    fileNameDisplay.textContent = file.name;
    fileInfo.classList.remove('hidden');
    fileInfo.classList.add('flex');
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50/25');

    selectedFile = file;
    generateBtn.disabled = false;
    showNotification('PDF 파일이 준비되었습니다.');
});

// 드래그 중 하이라이트
['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, () => dropZone.classList.add('border-indigo-500', 'bg-indigo-50/30'))
);
['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, () => {
        if (!selectedFile) dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/30');
    })
);

// ---------- 분석 요청 ----------
generateBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showNotification('먼저 PDF 파일을 업로드해 주세요.');
        return;
    }

    errorBox.classList.add('hidden');
    resultSection.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    loadingIndicator.classList.add('flex');
    generateBtn.disabled = true;

    try {
        const headers = { 'Content-Type': 'application/octet-stream' };
        const code = accessCodeInput.value.trim() || sessionStorage.getItem('accessCode') || '';
        if (code) headers['x-access-code'] = code;

        // PDF 원본 바이트를 그대로 전송 (base64보다 약 33% 작음)
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers,
            body: selectedFile,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (data.code === 'ACCESS_CODE_REQUIRED') {
                accessCodeBox.classList.remove('hidden');
                sessionStorage.removeItem('accessCode');
                accessCodeInput.focus();
            }
            throw new Error(data.error || `요청에 실패했습니다. (HTTP ${response.status})`);
        }
        if (code) sessionStorage.setItem('accessCode', code);

        renderResults(data);
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error(error);
        showError(error.message || '분석 중 오류가 발생했습니다.');
    } finally {
        loadingIndicator.classList.add('hidden');
        loadingIndicator.classList.remove('flex');
        generateBtn.disabled = false;
    }
});

// ---------- 결과 렌더링 (innerHTML 대신 textContent로 XSS 방지) ----------
function renderResults(data) {
    document.getElementById('card1Content').textContent =
        data.card1_easy_explanation || '내용이 없습니다.';

    const card2El = document.getElementById('card2Content');
    card2El.replaceChildren();
    (data.card2_takeaways || []).forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100';

        const badge = document.createElement('span');
        badge.className = 'flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 font-bold rounded-full flex items-center justify-center text-xs';
        badge.textContent = index + 1;

        const text = document.createElement('span');
        text.className = 'text-slate-700 text-sm mt-0.5';
        text.textContent = item;

        row.append(badge, text);
        card2El.appendChild(row);
    });

    const card3El = document.getElementById('card3Content');
    card3El.replaceChildren();
    const slides = data.card3_card_news || [];
    slides.forEach((slide, index) => {
        const card = document.createElement('div');
        card.className = 'bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col justify-between relative overflow-hidden min-h-[140px]';

        const head = document.createElement('div');
        head.className = 'flex justify-between items-center mb-3';

        const label = document.createElement('span');
        label.className = 'text-xs font-semibold uppercase tracking-wider text-indigo-300';
        label.textContent = `Slide 0${index + 1} / 0${slides.length}`;

        const tag = document.createElement('span');
        tag.className = 'text-xs bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full';
        tag.textContent = 'Card News';

        head.append(label, tag);

        const body = document.createElement('p');
        body.className = 'text-sm font-medium leading-snug';
        body.textContent = slide;

        card.append(head, body);
        card3El.appendChild(card);
    });
}

// ---------- 전체 복사 ----------
copyBtn.addEventListener('click', async () => {
    const card1 = document.getElementById('card1Content').textContent;
    const card2 = Array.from(document.querySelectorAll('#card2Content > div'))
        .map((el, i) => `${i + 1}. ${el.querySelector('span:last-child').textContent}`)
        .join('\n');
    const card3 = Array.from(document.querySelectorAll('#card3Content p'))
        .map((el) => el.textContent)
        .join('\n\n');

    const fullText = `[초등학생도 이해하는 쉬운 말 해설]\n${card1}\n\n[핵심 테이크어웨이]\n${card2}\n\n[SNS 카드뉴스 슬라이드]\n${card3}`;

    try {
        await navigator.clipboard.writeText(fullText);
        showNotification('전체 결과가 클립보드에 복사되었습니다!');
    } catch {
        showNotification('복사에 실패했습니다. 직접 선택해서 복사해 주세요.');
    }
});
