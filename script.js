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
  
  // Define persistência local para manter o utilizador conectado
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
}

let currentUser = null;
let currentUserData = null;
let currentTab = 'avisos';

// Configurações do Administrador
const ADMIN_USER = "Admin2026";
const ADMIN_PASS = "Admin";
const ADMIN_EMAIL = "admin2026@igrejadeitaqui.com";

/* ====================================================
   2. ALTERNÂNCIA DE TELA (LOGIN / REGISTRO ESTILO INSTAGRAM)
   ==================================================== */
let isLoginMode = true;

function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  const formLogin = document.getElementById('loginForm');
  const formReg = document.getElementById('registerForm');
  const switchText = document.getElementById('switchText');

  if (isLoginMode) {
    formLogin.classList.remove('hidden');
    formLogin.classList.add('flex');
    formReg.classList.add('hidden');
    formReg.classList.remove('flex');
    switchText.innerHTML = `Não tem uma conta? <button type="button" onclick="toggleAuthMode()" class="text-blue-500 font-bold outline-none">Cadastre-se</button>`;
  } else {
    formLogin.classList.add('hidden');
    formLogin.classList.remove('flex');
    formReg.classList.remove('hidden');
    formReg.classList.add('flex');
    switchText.innerHTML = `Já tem uma conta? <button type="button" onclick="toggleAuthMode()" class="text-blue-500 font-bold outline-none">Conecte-se</button>`;
  }
}

// Monitor de estado do utilizador (Mostra App ou Formulário de Login)
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await carregarPerfil(user);
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('authContainer').classList.remove('flex');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('flex');
    iniciarRealtime();
  } else {
    currentUser = null;
    currentUserData = null;
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('authContainer').classList.add('flex');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('flex');
  }
});

async function carregarPerfil(user) {
  const doc = await db.collection('users').doc(user.uid).get();
  if (doc.exists) {
    currentUserData = doc.data();
  } else {
    const isAdmin = user.email === ADMIN_EMAIL;
    currentUserData = {
      uid: user.uid,
      name: isAdmin ? "Administrador" : (user.displayName || "Membro"),
      email: user.email,
      photoURL: user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      role: isAdmin ? "admin" : "member",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(user.uid).set(currentUserData);
  }
  
  // Atualiza informações na barra superior
  document.getElementById('navUserName').innerText = currentUserData.name;
  document.getElementById('navUserProfilePic').src = currentUserData.photoURL;
  
  if (currentUserData.role === 'admin') {
    document.getElementById('navAdminBadge').classList.remove('hidden');
    document.getElementById('navBtnAdmin').classList.remove('hidden');
    document.getElementById('navBtnAdmin').classList.add('flex');
  }
}

/* ====================================================
   3. FUNÇÕES DE AUTENTICAÇÃO E CADASTRO
   ==================================================== */
async function handleLogin(e) {
  e.preventDefault();
  const login = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const err = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');
  
  err.classList.add('hidden');
  btn.disabled = true; 
  btn.innerText = "Entrando...";

  let emailTarget = login;
  if (login.toLowerCase() === ADMIN_USER.toLowerCase()) emailTarget = ADMIN_EMAIL;

  try {
    await auth.signInWithEmailAndPassword(emailTarget, pass);
  } catch (error) {
    // Criação automática do Admin na primeira execução
    if (emailTarget === ADMIN_EMAIL && pass === ADMIN_PASS && error.code === 'auth/user-not-found') {
      try {
        const acc = await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASS);
        await acc.user.updateProfile({ displayName: "Administrador" });
      } catch (e) { 
        err.innerText = "Erro ao criar conta de Administrador."; 
        err.classList.remove('hidden'); 
      }
    } else {
      err.innerText = "Dados de acesso incorretos. Tente novamente.";
      err.classList.remove('hidden');
    }
  } finally {
    btn.disabled = false; 
    btn.innerText = "Entrar";
  }
}

let regFoto = null;
function previewProfilePhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('regPhotoPreview').src = e.target.result;
      regFoto = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const err = document.getElementById('regError');
  const btn = document.getElementById('btnRegister');

  err.classList.add('hidden');
  if (email.toLowerCase() === ADMIN_EMAIL) {
    err.innerText = "Este e-mail é reservado."; 
    err.classList.remove('hidden'); 
    return;
  }

  btn.disabled = true; 
  btn.innerText = "Criando conta...";
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const pic = regFoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";
    await cred.user.updateProfile({ displayName: name, photoURL: pic });
    
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      name: name,
      email: email,
      photoURL: pic,
      role: 'member',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    err.innerText = "Erro: Este e-mail já está em uso."; 
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false; 
    btn.innerText = "Cadastre-se";
  }
}

function handleLogout() { 
  if (confirm("Deseja sair da sua conta?")) {
    auth.signOut(); 
  }
}

/* ====================================================
   4. NAVEGAÇÃO E ABAS DO APLICATIVO
   ==================================================== */
function switchMainTab(tab) {
  currentTab = tab;
  ['secAvisos', 'secMensagens', 'secAdmin'].forEach(id => document.getElementById(id).classList.add('hidden'));
  
  const targetSec = document.getElementById('sec' + tab.charAt(0).toUpperCase() + tab.slice(1));
  targetSec.classList.remove('hidden');
  targetSec.classList.add('flex');
  
  const inativo = "flex flex-col items-center text-slate-400 w-full";
  document.getElementById('navBtnAvisos').className = tab === 'avisos' ? "flex flex-col items-center text-blue-600 w-full" : inativo;
  document.getElementById('navBtnMensagens').className = tab === 'mensagens' ? "flex flex-col items-center text-blue-600 w-full relative" : inativo + " hover:text-blue-600 relative";
  document.getElementById('navBtnAdmin').className = tab === 'admin' ? "flex flex-col items-center text-amber-600 w-full" : inativo + " hover:text-amber-600";

  if (tab === 'mensagens') {
    document.getElementById('unreadChatBadge').classList.add('hidden');
    scrollToBottomChat();
  }
}

// Controla exibição do botão de enviar vs microfone no Chat
const chatInputElem = document.getElementById('chatInput');
if (chatInputElem) {
  chatInputElem.addEventListener('input', function() {
    const value = this.value.trim();
    document.getElementById('micBtn').classList.toggle('hidden', value.length > 0);
    document.getElementById('sendBtn').classList.toggle('hidden', value.length === 0);
  });
}

/* ====================================================
   5. TEMPO REAL (FIRESTORE BANCO DE DADOS)
   ==================================================== */
function iniciarRealtime() {
  // Atualizações do Mural de Avisos
  db.collection('avisos').orderBy('createdAt', 'desc').onSnapshot(snap => {
    const feed = document.getElementById('avisosFeed');
    feed.innerHTML = '';
    if (snap.empty) {
      document.getElementById('emptyAvisos').classList.remove('hidden');
    } else {
      document.getElementById('emptyAvisos').classList.add('hidden');
      snap.docs.forEach(doc => feed.appendChild(renderAviso(doc.id, doc.data())));
    }
  });

  // Atualizações das Mensagens no Chat
  let first = true;
  db.collection('chat').orderBy('timestamp', 'asc').onSnapshot(snap => {
    const feed = document.getElementById('chatFeed');
    feed.innerHTML = '';
    snap.docs.forEach(doc => feed.appendChild(renderChat(doc.data())));
    
    if (!first && snap.docChanges().some(c => c.type === 'added')) {
      if (currentTab !== 'mensagens') {
        document.getElementById('unreadChatBadge').classList.remove('hidden');
      }
    }
    first = false;
    scrollToBottomChat();
  });
}

function renderAviso(id, data) {
  const div = document.createElement('div');
  div.className = "bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm";
  
  const del = (currentUserData?.role === 'admin') ? 
    `<button onclick="db.collection('avisos').doc('${id}').delete()" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash-can text-sm"></i></button>` : '';
  
  div.innerHTML = `
    ${data.coverUrl ? `<img src="${data.coverUrl}" class="w-full h-36 object-cover">` : ''}
    <div class="p-3">
      <div class="flex justify-between items-start mb-1">
        <div class="flex gap-1 mb-1">
          <span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-500 border">${data.type}</span>
          <span class="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-100">${data.target}</span>
        </div>
        ${del}
      </div>
      <h3 class="font-bold text-[15px] leading-tight text-slate-800">${data.title}</h3>
      <p class="text-[11px] text-amber-600 font-semibold mt-1.5"><i class="fa-solid fa-clock mr-1"></i>${data.time}</p>
      ${data.description ? `<p class="text-[11px] text-slate-500 mt-2 leading-relaxed">${data.description}</p>` : ''}
    </div>
  `;
  return div;
}

function renderChat(msg) {
  const isMe = msg.senderUid === currentUser?.uid;
  const isAdmin = msg.senderRole === 'admin';
  const div = document.createElement('div');
  div.className = `flex gap-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`;

  let content = msg.audioUrl ? 
    `<div class="flex items-center gap-2"><i class="fa-solid fa-microphone ${isMe ? 'text-blue-200' : 'text-emerald-500'}"></i><audio controls src="${msg.audioUrl}" class="h-6 max-w-[150px] outline-none"></audio></div>` : 
    `<p class="text-[13px] leading-snug break-words">${msg.text}</p>`;

  const bg = isMe ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-sm' : (isAdmin ? 'bg-slate-800 text-white rounded-tl-sm' : 'bg-white text-slate-900 border border-slate-200 rounded-tl-sm');

  div.innerHTML = `
    ${!isMe ? `<img src="${msg.senderPhoto}" class="w-6 h-6 rounded-full object-cover shadow-sm self-end mb-1">` : ''}
    <div class="max-w-[80%] px-3 py-1.5 rounded-2xl shadow-sm ${bg}">
      ${!isMe ? `<p class="text-[10px] font-bold ${isAdmin ? 'text-amber-400' : 'text-emerald-600'} mb-0.5">${msg.senderName}</p>` : ''}
      ${content}
    </div>
  `;
  return div;
}

function scrollToBottomChat() {
  const c = document.getElementById('chatFeed');
  if (c) c.scrollTop = c.scrollHeight;
}

/* ====================================================
   6. MENSAGENS DE TEXTO E ÁUDIO
   ==================================================== */
async function sendTextMessage(e) {
  e.preventDefault();
  const inp = document.getElementById('chatInput');
  const text = inp.value.trim();
  if (!text) return;
  
  inp.value = ''; 
  document.getElementById('micBtn').classList.remove('hidden');
  document.getElementById('sendBtn').classList.add('hidden');

  await db.collection('chat').add({ 
    text: text, 
    audioUrl: null, 
    senderUid: currentUser.uid, 
    senderName: currentUserData.name, 
    senderPhoto: currentUserData.photoURL, 
    senderRole: currentUserData.role, 
    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
  });
}

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recInt = null;
let recSecs = 0;

async function toggleAudioRecording() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.start();
      isRecording = true;

      document.getElementById('chatForm').classList.add('hidden');
      document.getElementById('audioRecordingBar').classList.remove('hidden');
      document.getElementById('audioRecordingBar').classList.add('flex');
      
      recSecs = 0; 
      document.getElementById('recordingTimer').innerText = "00:00";
      recInt = setInterval(() => {
        recSecs++; 
        document.getElementById('recordingTimer').innerText = `00:${String(recSecs).padStart(2, '0')}`;
      }, 1000);
    } catch (e) { 
      alert("Permissão de microfone indisponível no navegador."); 
    }
  } else {
    mediaRecorder.onstop = async () => {
      const reader = new FileReader();
      reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
      reader.onloadend = async () => {
        await db.collection('chat').add({ 
          text: null, 
          audioUrl: reader.result, 
          senderUid: currentUser.uid, 
          senderName: currentUserData.name, 
          senderPhoto: currentUserData.photoURL, 
          senderRole: currentUserData.role, 
          timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
      };
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.stop();
    resetAudio();
  }
}

function cancelAudioRecording() {
  if (mediaRecorder) { 
    mediaRecorder.stop(); 
    mediaRecorder.stream.getTracks().forEach(t => t.stop()); 
  }
  resetAudio();
}

function resetAudio() {
  isRecording = false; 
  clearInterval(recInt);
  document.getElementById('audioRecordingBar').classList.add('hidden');
  document.getElementById('audioRecordingBar').classList.remove('flex');
  document.getElementById('chatForm').classList.remove('hidden');
  document.getElementById('chatForm').classList.add('flex');
}

/* ====================================================
   7. PUBLICAR AVISOS (PAINEL DO ADMINISTRADOR)
   ==================================================== */
async function publishAviso(e) {
  e.preventDefault();
  const btn = document.getElementById('btnPublishAviso');
  btn.innerText = "Publicando..."; 
  btn.disabled = true;

  const title = document.getElementById('avisoTitle').value;
  const time = document.getElementById('avisoTime').value;
  const type = document.getElementById('avisoType').value;
  const target = document.getElementById('avisoTarget').value;
  const desc = document.getElementById('avisoDescription').value;
  const file = document.getElementById('avisoCoverFile').files[0];
  
  let coverUrl = null;
  if (file) {
    coverUrl = await new Promise(r => {
      const reader = new FileReader(); 
      reader.onload = ev => r(ev.target.result); 
      reader.readAsDataURL(file);
    });
  }

  await db.collection('avisos').add({ 
    title, 
    time, 
    type, 
    target, 
    description: desc, 
    coverUrl, 
    createdAt: firebase.firestore.FieldValue.serverTimestamp() 
  });

  document.getElementById('avisoAdminForm').reset();
  switchMainTab('avisos');
  btn.innerText = "Publicar Aviso"; 
  btn.disabled = false;
}
