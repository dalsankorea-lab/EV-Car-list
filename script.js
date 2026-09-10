const STORAGE_KEY = "ev-parking-vehicles-v1";
let vehicles = loadVehicles();

const form = document.getElementById("vehicleForm");
const plateInput = document.getElementById("plate");
const modelInput = document.getElementById("model");
const vehicleList = document.getElementById("vehicleList");
const emptyState = document.getElementById("emptyState");
const vehicleCount = document.getElementById("vehicleCount");
const todayCount = document.getElementById("todayCount");
const lastRegistered = document.getElementById("lastRegistered");
const toast = document.getElementById("toast");

function loadVehicles(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveVehicles(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles)); }
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function formatTime(iso){
  const d = new Date(iso);
  return d.toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function render(){
  vehicleCount.textContent = vehicles.length;
  const today = new Date().toDateString();
  todayCount.textContent = vehicles.filter(v => new Date(v.createdAt).toDateString() === today).length;
  lastRegistered.textContent = vehicles.length ? formatTime(vehicles[vehicles.length-1].createdAt) : "-";

  emptyState.style.display = vehicles.length ? "none" : "block";
  vehicleList.innerHTML = vehicles.map((v,i)=>`
    <div class="vehicle">
      <div class="num">${i+1}</div>
      <div>
        <div class="plate">${escapeHtml(v.plate)}</div>
        <div class="model">${escapeHtml(v.model)}</div>
        <div class="time">등록 ${formatTime(v.createdAt)}</div>
      </div>
      <button class="delete" data-id="${v.id}">삭제</button>
    </div>
  `).join("");
}
const vehiclePhoto = document.getElementById("vehiclePhoto");
const photoPreview = document.getElementById("photoPreview");
const photoPreviewWrap = document.getElementById("photoPreviewWrap");
const ocrPlate = document.getElementById("ocrPlate");
const ocrModel = document.getElementById("ocrModel");
const ocrAddBtn = document.getElementById("ocrAddBtn");
const ocrStatus = document.getElementById("ocrStatus");
const ocrProgressWrap = document.getElementById("ocrProgressWrap");
const ocrProgress = document.getElementById("ocrProgress");
const ocrProgressText = document.getElementById("ocrProgressText");

function normalizePlate(text){
  return text
    .replace(/[\n\r\t]/g," ")
    .replace(/[^\uAC00-\uD7A30-9A-Za-z ]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function extractPlate(text){
  const clean = normalizePlate(text);
  // 한국 자동차 번호판의 대표적인 형태를 우선 탐색
  const patterns = [
    /\b\d{2,3}\s*[가-힣]\s*\d{4}\b/,
    /\b\d{2,3}\s*\d{4}\b/,
    /\b[가-힣]{2}\s*\d{2}\s*\d{4}\b/
  ];
  for(const p of patterns){
    const m = clean.match(p);
    if(m) return m[0].replace(/\s+/g," ");
  }
  // OCR이 한글/공백을 이상하게 읽은 경우 숫자 중심 후보
  const candidates = clean.match(/\d{2,3}\s*[가-힣A-Za-z]\s*\d{3,4}/g);
  return candidates?.[0]?.replace(/\s+/g," ") || clean.slice(0,12);
}

vehiclePhoto.addEventListener("change", async ()=>{
  const file = vehiclePhoto.files?.[0];
  if(!file) return;

  photoPreview.src = URL.createObjectURL(file);
  photoPreviewWrap.hidden = false;
  ocrProgressWrap.hidden = false;
  ocrProgress.style.width = "0%";
  ocrStatus.textContent = "인식 중";
  ocrStatus.classList.add("working");
  ocrProgressText.textContent = "차량번호를 인식하는 중입니다...";

  try{
    if(!window.Tesseract) throw new Error("OCR 라이브러리를 불러오지 못했습니다.");

    const result = await Tesseract.recognize(file, "kor+eng", {
      logger: m => {
        if(m.status === "recognizing text"){
          const pct = Math.round((m.progress || 0)*100);
          ocrProgress.style.width = pct + "%";
          ocrProgressText.textContent = `번호 인식 중... ${pct}%`;
        } else if(m.status === "loading language traineddata"){
          ocrProgressText.textContent = "한국어 OCR 자료를 준비하는 중...";
        }
      }
    });

    const raw = result.data.text || "";
    const plate = extractPlate(raw);
    ocrPlate.value = plate;
    ocrStatus.textContent = plate ? "인식 완료" : "재촬영 필요";
    ocrStatus.classList.remove("working");
    ocrProgress.style.width = "100%";
    ocrProgressText.textContent = plate ? "인식이 완료되었습니다. 번호를 확인한 후 등록하세요." : "차량번호를 찾지 못했습니다. 번호판을 크게 촬영해 주세요.";
    ocrPlate.focus();
  }catch(error){
    console.error(error);
    ocrStatus.textContent = "인식 실패";
    ocrStatus.classList.remove("working");
    ocrProgressText.textContent = "인식에 실패했습니다. 밝은 곳에서 번호판을 크게 촬영해 주세요.";
  }
});

ocrAddBtn.addEventListener("click", ()=>{
  const plate = ocrPlate.value.trim();
  const model = ocrModel.value.trim() || "차종 미입력";
  if(!plate){
    showToast("인식된 차량번호가 없습니다.");
    ocrPlate.focus();
    return;
  }
  if(vehicles.some(v => v.plate.replace(/\s/g,"") === plate.replace(/\s/g,""))){
    showToast("이미 등록된 차량번호입니다.");
    return;
  }
  vehicles.push({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    plate, model, createdAt:new Date().toISOString()
  });
  saveVehicles();
  render();
  ocrPlate.value = "";
  ocrModel.value = "";
  vehiclePhoto.value = "";
  photoPreviewWrap.hidden = true;
  ocrProgressWrap.hidden = true;
  ocrStatus.textContent = "대기";
  showToast("사진으로 인식한 차량이 등록되었습니다.");
});

form.addEventListener("submit", e=>{
  e.preventDefault();
  const plate = plateInput.value.trim();
  const model = modelInput.value.trim();
  if(!plate || !model) return;

  // 같은 차량번호의 중복 등록 방지
  if(vehicles.some(v => v.plate.replace(/\s/g,"") === plate.replace(/\s/g,""))){
    showToast("이미 등록된 차량번호입니다.");
    plateInput.focus();
    return;
  }
  vehicles.push({id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), plate, model, createdAt:new Date().toISOString()});
  saveVehicles();
  render();
  form.reset();
  plateInput.focus();
  showToast("전기차량이 등록되었습니다.");
});
vehicleList.addEventListener("click", e=>{
  const btn = e.target.closest(".delete");
  if(!btn) return;
  const item = vehicles.find(v=>v.id === btn.dataset.id);
  if(!item) return;
  if(confirm(`${item.plate} (${item.model}) 차량을 삭제하시겠습니까?`)){
    vehicles = vehicles.filter(v=>v.id !== item.id);
    saveVehicles(); render(); showToast("차량이 삭제되었습니다.");
  }
});
document.getElementById("clearBtn").addEventListener("click", ()=>{
  if(!vehicles.length){ showToast("삭제할 차량이 없습니다."); return; }
  if(confirm(`등록된 ${vehicles.length}대의 차량을 모두 삭제하시겠습니까?`)){
    vehicles=[]; saveVehicles(); render(); showToast("전체 차량이 삭제되었습니다.");
  }
});

const KAKAO_KEY_STORAGE = "kakao-js-key-v1";
const kakaoKeyInput = document.getElementById("kakaoKey");
const kakaoStatus = document.getElementById("kakaoStatus");
const saveKakaoKeyBtn = document.getElementById("saveKakaoKey");

function getKakaoKey(){
  return localStorage.getItem(KAKAO_KEY_STORAGE) || "";
}

function updateKakaoStatus(){
  const key = getKakaoKey();
  kakaoStatus.textContent = key ? "설정 완료" : "미설정";
  kakaoStatus.classList.toggle("ready", !!key);
  kakaoKeyInput.value = key;
}
updateKakaoStatus();

saveKakaoKeyBtn.addEventListener("click", ()=>{
  const key = kakaoKeyInput.value.trim();
  if(!key){
    localStorage.removeItem(KAKAO_KEY_STORAGE);
    updateKakaoStatus();
    showToast("카카오 JavaScript 키를 삭제했습니다.");
    return;
  }
  localStorage.setItem(KAKAO_KEY_STORAGE, key);
  updateKakaoStatus();
  showToast("카카오톡 공유 설정이 저장되었습니다.");
});

function makeShareText(){
  const now = new Date().toLocaleString("ko-KR");
  let text = `[전기차량 주차 확인]\n확인일시: ${now}\n총 ${vehicles.length}대\n\n`;
  vehicles.forEach((v,i)=> text += `${i+1}. ${v.plate} / ${v.model}\n`);
  return text.trim();
}

async function shareToKakao(){
  if(!vehicles.length){
    showToast("공유할 차량 정보가 없습니다.");
    return;
  }

  const key = getKakaoKey();
  if(!key){
    showToast("먼저 카카오 JavaScript 키를 입력하고 저장해 주세요.");
    kakaoKeyInput.focus();
    return;
  }

  if(!window.Kakao){
    showToast("카카오톡 공유 SDK를 불러오지 못했습니다.");
    return;
  }

  try{
    if(!Kakao.isInitialized()){
      Kakao.init(key);
    }

    const text = makeShareText();

    // 카카오톡의 친구/채팅방 선택 화면을 실제로 열고,
    // 사용자가 선택한 대상에게 메시지를 공유합니다.
    Kakao.Share.sendDefault({
      objectType: "text",
      text,
      link: {
        mobileWebUrl: window.location.href,
        webUrl: window.location.href
      },
      pickerSettings: {
        type: "default",
        limit: 10
      }
    });
  }catch(error){
    console.error(error);
    showToast("카카오톡 공유에 실패했습니다. JavaScript 키와 등록 도메인을 확인해 주세요.");
  }
}

document.getElementById("shareBtn").addEventListener("click", shareToKakao);

function showToast(msg){
  toast.textContent=msg; toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);
}
render();
