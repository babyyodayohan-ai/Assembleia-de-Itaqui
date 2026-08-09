/* ====================================================
   1. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE
   ==================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyCTDM1w_Bl2uJhcsVQXyUivAR4vQWq1DZ4",
  authDomain: "igrejadeitaqui.firebaseapp.com",
  projectId: "igrejadeitaqui",
  storageBucket: "igrejadeitaqui.firebasestorage.app",
  messagingSenderId: "694873463575",
  appId: "1:694873463575:web:09518c36cfab2ac318b552",
  measurementId: "G-JRRF2W6GW3"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  
  // Define a persistência local para manter o utilizador ligado
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
}

let userObj = null;
let userData = null;
const baseMail = "@aditaqui.app"; // Email fictício para o Firebase Auth funcionar sem pedir email ao utilizador

// Filtro de Palavrões para a Conversa
const badWords = ['merda', 'porra', 'caralho', 'puta', 'fdp', 'bosta', 'cacete', 'cuzão', 'cuzao', 'desgraça'];

/* ====================================================
   2. TRATAMENTO DE DATAS E TELA DE CARREGAMENTO (COM TEMPORIZADOR DE SEGURANÇA)
   ==================================================== */
let loadTimeout = null;

function showLoad() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.remove('hidden');

  // Trava de segurança: esconde o carregamento em 2.5s no máximo para não bloquear o utilizador
  clearTimeout(loadTimeout);
  loadTimeout = setTimeout(() => {
    hideLoad();
  }, 2500);
}

function hideLoad() {
  clearTimeout(loadTimeout);
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.add('hidden');
}

function formatDateStr(dateObj) {
  return dateObj.toISOString().split('T')[0]; // Formato "YYYY-MM-DD"
}

const todayObj = new Date();
const todayStr = formatDateStr(todayObj);

const yesterdayObj = new Date(todayObj);
yesterdayObj.setDate(yesterdayObj.getDate() - 1);
const yesterdayStr = formatDateStr(yesterdayObj);

// Atualiza a data no topo do Card Central
const optDate = { day: '2-digit', month: 'short', year: 'numeric' };
const dateTextElem = document.getElementById('dateTodayText');
if (dateTextElem) {
  dateTextElem.innerText = `Hoje • ${todayObj.toLocaleDateString('pt-BR', optDate)}`;
}

/* ====================================================
   3. AUTENTICAÇÃO (SÓ NOME DE UTILIZADOR E PALAVRA-PASSE)
   ==================================================== */
let isLogin = true;

function toggleAuth() {
  isLogin = !isLogin;
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('loginForm').classList.toggle('flex', isLogin);
  document.getElementById('registerForm').classList.toggle('hidden', isLogin);
  document.getElementById('registerForm').classList.toggle('flex', !isLogin);
  
  const toggleText = document.getElementById('authToggleText');
  if (toggleText) {
    toggleText.innerHTML = isLogin 
      ? 'Novo por aqui? <button onclick="toggleAuth()" class="text-church-600 font-bold">Registe-se</button>' 
      : 'Já tem conta? <button onclick="toggleAuth()" class="text-church-600 font-bold">Entrar</button>';
  }
}

let pFoto = null;
function previewPhoto(input) {
  if (input.files && input.files[0]) {
    const r = new FileReader();
    r.onload = e => {
      document.getElementById('regPhotoPreview').src = e.target.result;
      pFoto = e.target.result;
    };
    r.readAsDataURL(input.files[0]);
  }
}

async function handleAuth(e, type) {
  e.preventDefault();
  showLoad();

  const user = type === 'login' 
    ? document.getElementById('loginUser').value.trim() 
    : document.getElementById('regUser').value.trim();
  const pass = type === 'login' 
    ? document.getElementById('loginPass').value 
    : document.getElementById('regPass').value;
  const errDiv = document.getElementById(type === 'login' ? 'loginError' : 'regError');
  errDiv.classList.add('hidden');

  const finalEmail = user.replace(/\s+/g, '').toLowerCase() + baseMail;
  const isAdmin = user.toLowerCase() === 'admin' && pass === 'Admin@';

  try {
    if (type === 'login') {
      try {
        await auth.signInWithEmailAndPassword(finalEmail, pass);
      } catch (err) {
        // Se a conta de Admin não existir no banco, cria-a automaticamente
        if (isAdmin && err.code === 'auth/user-not-found') {
          const cr = await auth.createUserWithEmailAndPassword(finalEmail, pass);
          await cr.user.updateProfile({ displayName: "Administrador" });
        } else {
          throw new Error("Nome de utilizador ou palavra-passe incorretos.");
        }
      }
    } else {
      if (user.toLowerCase() === 'admin') throw new Error("O nome 'Admin' é reservado.");
      const cr = await auth.createUserWithEmailAndPassword(finalEmail, pass);
      const pic = pFoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";
      await cr.user.updateProfile({ displayName: user, photoURL: pic });
      await db.collection('users').doc(cr.user.uid).set({ uid: cr.user.uid, name: user, role: 'member', photoURL: pic });
    }
  } catch (err) {
    errDiv.innerText = err.message || "Erro de autenticação.";
    errDiv.classList.remove('hidden');
  } finally {
    hideLoad();
  }
}

auth.onAuthStateChanged(async (u) => {
  showLoad();
  try {
    if (u) {
      userObj = u;
      try {
        let doc = await db.collection('users').doc(u.uid).get();
        if (doc.exists) {
          userData = doc.data();
        } else {
          const isAd = u.email === ('admin' + baseMail);
          userData = { uid: u.uid, name: isAd ? "Administrador" : (u.displayName || "Membro"), role: isAd ? 'admin' : 'member', photoURL: u.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" };
          await db.collection('users').doc(u.uid).set(userData);
        }
      } catch (dbErr) {
        console.warn("Erro ao obter dados do utilizador do Firestore:", dbErr);
        userData = { uid: u.uid, name: u.displayName || "Membro", role: 'member', photoURL: u.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" };
      }

      const navName = document.getElementById('navName');
      const navPic = document.getElementById('navPic');
      if (navName) navName.innerText = userData.name || "Membro";
      if (navPic) navPic.src = userData.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";
      
      if (userData.role === 'admin') {
        const badge = document.getElementById('navAdminBadge');
        const btnAdmin = document.getElementById('navBtnAdmin');
        if (badge) badge.classList.remove('hidden');
        if (btnAdmin) {
          btnAdmin.classList.remove('hidden');
          btnAdmin.classList.add('flex');
        }
      }

      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('flex');

      startDB();
      nav('Mural');
    } else {
      userObj = null;
      userData = null;
      document.getElementById('authContainer').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
      document.getElementById('mainApp').classList.remove('flex');
    }
  } catch (err) {
    console.error("Erro na verificação de autenticação:", err);
  } finally {
    hideLoad();
  }
});

function handleLogout() {
  if (confirm("Deseja sair da sua conta?")) auth.signOut();
}

/* ====================================================
   4. NAVEGAÇÃO ENTRE ABAS
   ==================================================== */
function nav(t) {
  ['secMural', 'secMensagens', 'secAdmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const targetSec = document.getElementById('sec' + t);
  if (targetSec) {
    targetSec.classList.remove('hidden');
    targetSec.classList.add('flex');
  }

  const inat = "text-slate-400 flex flex-col items-center w-full";
  const btnMural = document.getElementById('navBtnMural');
  const btnMsg = document.getElementById('navBtnMensagens');
  const btnAdmin = document.getElementById('navBtnAdmin');

  if (btnMural) btnMural.className = t === 'Mural' ? "text-church-600 flex flex-col items-center w-full" : inat;
  if (btnMsg) btnMsg.className = t === 'Mensagens' ? "text-church-600 flex flex-col items-center w-full relative" : inat + " relative";
  if (btnAdmin) btnAdmin.className = t === 'Admin' ? "text-amber-500 flex flex-col items-center w-full" : inat;

  if (t === 'Mensagens') {
    const unread = document.getElementById('unreadChatBadge');
    if (unread) unread.classList.add('hidden');
    scrollToBottomChat();
  }
}

/* ====================================================
   5. MURAL 3D E LIMPEZA AUTOMÁTICA DE POSTAGENS
   ==================================================== */
function startDB() {
  // Listener de Avisos no Mural
  db.collection('avisos').onSnapshot(snap => {
    let postToday = null, postYest = null;
    const contT = document.getElementById('contentToday');
    const contY = document.getElementById('contentYesterday');

    snap.docs.forEach(doc => {
      let d = doc.data();
      // Auto-exclusão para manter a aplicação rápida (apaga tudo o que for mais antigo que ontem)
      if (userData?.role === 'admin' && d.dateStr < yesterdayStr) {
        db.collection('avisos').doc(doc.id).delete();
        return;
      }
      if (d.dateStr === todayStr) postToday = { id: doc.id, ...d };
      if (d.dateStr === yesterdayStr) postYest = { id: doc.id, ...d };
    });

    // Renderizar Card do Dia de Hoje
    if (contT) {
      if (postToday) {
        contT.innerHTML = buildCardUI(postToday, true);
        const alertNoPost = document.getElementById('adminAlertNoPost');
        if (alertNoPost) alertNoPost.classList.add('hidden');
      } else {
        contT.innerHTML = `<i class="fa-solid fa-calendar-xmark text-4xl text-slate-200 mb-2"></i><p class="text-xs text-slate-400 font-bold">Nenhum evento para hoje.</p>`;
        if (userData?.role === 'admin') {
          const alertNoPost = document.getElementById('adminAlertNoPost');
          if (alertNoPost) alertNoPost.classList.remove('hidden');
        }
      }
    }

    // Renderizar Card de Ontem
    if (contY) {
      if (postYest) {
        contY.innerHTML = buildCardUI(postYest, false);
      } else {
        contY.innerHTML = `<i class="fa-solid fa-clock-rotate-left text-3xl text-slate-300 mb-2"></i><p class="text-[10px] text-slate-400 font-bold uppercase">Passou</p>`;
      }
    }
  }, err => console.error("Erro no Listener de Avisos:", err));

  // Listener das Mensagens na Conversa
  db.collection('chat').orderBy('timestamp', 'asc').onSnapshot(snap => {
    const feed = document.getElementById('chatFeed');
    if (feed) {
      feed.innerHTML = '';
      snap.docs.forEach(doc => feed.appendChild(renderMsg(doc.data())));
      feed.scrollTop = feed.scrollHeight;
    }
  }, err => console.error("Erro no Listener do Chat:", err));
}

function buildCardUI(post, isToday) {
  const del = (isToday && userData?.role === 'admin') 
    ? `<button onclick="db.collection('avisos').doc('${post.id}').delete()" class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"><i class="fa-solid fa-trash-can text-[10px]"></i></button>` 
    : '';
  const cov = post.coverUrl ? `<div class="h-32 w-full bg-slate-200 shrink-0"><img src="${post.coverUrl}" class="w-full h-full object-cover"></div>` : '';
  const fSize = isToday ? 'text-base' : 'text-sm';
  const dateRender = post.dateStr ? post.dateStr.split('-').reverse().join('/') : '';

  return `
    ${cov}
    <div class="flex-1 p-3 flex flex-col text-left w-full relative">
      ${del}
      <div class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black uppercase rounded self-start mb-1">${post.type || 'Evento'}</div>
      <h3 class="font-bold ${fSize} text-slate-800 leading-tight">${post.title || ''}</h3>
      
      <div class="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 self-start">
        <i class="fa-solid fa-calendar mr-1"></i>${dateRender} • <i class="fa-solid fa-clock ml-1 mr-1"></i>${post.time || ''}
      </div>
      
      ${post.desc ? `<p class="text-[10px] text-slate-500 mt-2 line-clamp-3 leading-snug">${post.desc}</p>` : ''}
    </div>
  `;
}

async function publishToday(e) {
  e.preventDefault();
  showLoad();

  try {
    const type = document.getElementById('pubType').value;
    const title = document.getElementById('pubTitle').value;
    const time = document.getElementById('pubTime').value;
    const desc = document.getElementById('pubDesc').value;
    const file = document.getElementById('pubCover').files[0];

    let coverUrl = null;
    if (file) {
      coverUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = ev => r(ev.target.result);
        fr.readAsDataURL(file);
      });
    }

    await db.collection('avisos').add({
      dateStr: todayStr,
      type,
      title,
      time,
      desc,
      coverUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('formAdmin').reset();
    nav('Mural');
  } catch (err) {
    alert("Erro ao publicar: " + err.message);
  } finally {
    hideLoad();
  }
}

/* ====================================================
   6. MENSAGENS E ÁUDIO COM FILTRO DE PALAVRÕES
   ==================================================== */
function filterText(txt) {
  let f = txt;
  badWords.forEach(w => {
    f = f.replace(new RegExp(`\\b${w}\\b`, 'gi'), '######');
  });
  return f;
}

const chatInpElem = document.getElementById('chatInput');
if (chatInpElem) {
  chatInpElem.addEventListener('input', function() {
    const btnMic = document.getElementById('btnMic');
    const btnSend = document.getElementById('btnSend');
    if (btnMic) btnMic.classList.toggle('hidden', this.value.trim().length > 0);
    if (btnSend) btnSend.classList.toggle('hidden', this.value.trim().length === 0);
  });
}

async function sendMsg(e) {
  e.preventDefault();
  const inp = document.getElementById('chatInput');
  const val = inp.value.trim();
  if (!val) return;

  inp.value = '';
  const btnMic = document.getElementById('btnMic');
  const btnSend = document.getElementById('btnSend');
  if (btnMic) btnMic.classList.remove('hidden');
  if (btnSend) btnSend.classList.add('hidden');

  try {
    await db.collection('chat').add({
      text: filterText(val),
      audioUrl: null,
      senderUid: userObj.uid,
      senderName: userData?.name || 'Membro',
      senderPhoto: userData?.photoURL || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
  }
}

function renderMsg(m) {
  const isMe = m.senderUid === userObj?.uid;
  const d = document.createElement('div');
  d.className = `flex gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`;

  const content = m.audioUrl 
    ? `<div class="flex items-center gap-1.5"><i class="fa-solid fa-microphone text-emerald-500"></i><audio controls src="${m.audioUrl}" class="h-6 max-w-[150px]"></audio></div>` 
    : `<p class="text-xs break-words">${m.text}</p>`;

  d.innerHTML = `
    ${!isMe ? `<img src="${m.senderPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" class="w-6 h-6 rounded-full self-end shadow-sm">` : ''}
    <div class="max-w-[80%] px-3 py-2 rounded-xl shadow-sm ${isMe ? 'bg-[#d9fdd3] text-slate-900 rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}">
      ${!isMe ? `<p class="text-[9px] font-black text-emerald-600 mb-0.5">${m.senderName || 'Membro'}</p>` : ''}
      ${content}
    </div>
  `;
  return d;
}

function scrollToBottomChat() {
  const c = document.getElementById('chatFeed');
  if (c) c.scrollTop = c.scrollHeight;
}

/* Lógica de Gravação de Áudio */
let mRec = null;
let aCh = [];
let isRec = false;
let recIntr = null;
let s = 0;

async function toggleAudio() {
  if (!isRec) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mRec = new MediaRecorder(stream);
      aCh = [];
      mRec.ondataavailable = e => { if (e.data.size > 0) aCh.push(e.data); };
      mRec.start();
      isRec = true;

      document.getElementById('chatForm').classList.add('hidden');
      const audioBar = document.getElementById('audioBar');
      if (audioBar) {
        audioBar.classList.remove('hidden');
        audioBar.classList.add('flex');
      }

      s = 0;
      recIntr = setInterval(() => {
        s++;
        const recTime = document.getElementById('recTime');
        if (recTime) recTime.innerText = `00:${String(s).padStart(2, '0')}`;
      }, 1000);
    } catch (e) {
      alert("Permissão para microfone não concedida.");
    }
  } else {
    mRec.onstop = async () => {
      const rd = new FileReader();
      rd.readAsDataURL(new Blob(aCh, { type: 'audio/webm' }));
      rd.onloadend = async () => {
        await db.collection('chat').add({
          text: null,
          audioUrl: rd.result,
          senderUid: userObj.uid,
          senderName: userData?.name || 'Membro',
          senderPhoto: userData?.photoURL || '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      };
      mRec.stream.getTracks().forEach(t => t.stop());
    };
    mRec.stop();
    rstAudio();
  }
}

function cancelAudio() {
  if (mRec) {
    mRec.stop();
    mRec.stream.getTracks().forEach(t => t.stop());
  }
  rstAudio();
}

function rstAudio() {
  isRec = false;
  clearInterval(recIntr);
  const audioBar = document.getElementById('audioBar');
  if (audioBar) {
    audioBar.classList.add('hidden');
    audioBar.classList.remove('flex');
  }
  const chatForm = document.getElementById('chatForm');
  if (chatForm) chatForm.classList.remove('hidden');
     }
