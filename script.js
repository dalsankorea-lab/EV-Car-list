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

function makeShareText(){
  const now = new Date().toLocaleString("ko-KR");
  let text = `[전기차량 주차 확인]\n확인일시: ${now}\n총 ${vehicles.length}대\n\n`;
  vehicles.forEach((v,i)=> text += `${i+1}. ${v.plate} / ${v.model}\n`);
  return text.trim();
}
document.getElementById("shareBtn").addEventListener("click", async ()=>{
  if(!vehicles.length){ showToast("공유할 차량 정보가 없습니다."); return; }
  const text = makeShareText();

  // 모바일에서는 카카오톡을 포함한 운영체제 공유창을 열어 카카오톡으로 바로 보낼 수 있습니다.
  if(navigator.share){
    try{
      await navigator.share({title:"전기차량 주차 확인", text});
      return;
    }catch(e){
      if(e.name === "AbortError") return;
    }
  }
  try{
    await navigator.clipboard.writeText(text);
    showToast("차량 정보가 복사되었습니다. 카카오톡에 붙여넣어 주세요.");
  }catch(e){
    window.prompt("아래 내용을 복사해 카카오톡으로 공유하세요.", text);
  }
});
function showToast(msg){
  toast.textContent=msg; toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);
}
render();
