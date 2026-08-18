// Firebase-ready BloodLegensMC site. Add your Firebase web config below.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDIaT4VD2rzaGqsDv_RxGm_IYnX4OiJeXA',authDomain:'bloodlegen-5e51c.firebaseapp.com',projectId:'bloodlegen-5e51c',storageBucket:'bloodlegen-5e51c.firebasestorage.app',messagingSenderId:'130652097903',appId:'1:130652097903:web:e6fbbca95927cbe5486c9a',measurementId:'G-1Y2V69S719'};
const ADMIN_EMAIL='uncxchamiyaff@gmail.com';
const configured=!firebaseConfig.apiKey.startsWith('PASTE_');
let auth,db,currentUser;
if(configured){const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);}

const $=id=>document.getElementById(id);
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

// ---------- Login button(s) — present on every page's nav ----------
function login(){
  if(!configured){alert('Google Login is ready, but the Firebase config has not been added yet. Open README.txt and follow the setup steps.');return}
  signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>alert(e.message));
}
function logout(){signOut(auth).catch(e=>alert(e.message))}
function wireLoginButtons(){
  document.querySelectorAll('#loginBtn,#loginBtn2').forEach(btn=>{btn.addEventListener('click',login)});
  document.querySelectorAll('#navUser').forEach(el=>{el.addEventListener('click',logout)});
}
function setLoginButtonsState(signedIn,name,isAdmin){
  // Nav button: hide once signed in, replace with the account name (click to sign out)
  document.querySelectorAll('#loginBtn').forEach(b=>{b.style.display=signedIn?'none':'';b.textContent='Google Login';});
  document.querySelectorAll('#navUser').forEach(el=>{
    if(signedIn){el.style.display='';el.textContent=(name||'Signed in')+' ⏻';el.title='Click to sign out';}
    else{el.style.display='none';el.textContent='';}
  });
  // Community login card button: hide once signed in, userInfo box already shows the name
  document.querySelectorAll('#loginBtn2').forEach(b=>{b.style.display=signedIn?'none':'';b.textContent='Sign in with Google';});
  // Admin nav link(s): only visible to the admin account (top nav + bottom bar)
  document.querySelectorAll('.adminNavLink').forEach(el=>{el.style.display=isAdmin?'':'none';});
}

// ---------- Vote page ----------
function localVotes(){return JSON.parse(localStorage.getItem('bl_votes')||'[]')}
function renderVotes(v){
  const list=$('voteList');
  if(!list)return;
  list.innerHTML=v.length?v.slice(0,20).map(x=>`<div class="voteItem"><b>${escapeHtml(x.name)}</b><span class="stars">★★★★★</span></div>`).join(''):'<p class="muted">No votes yet.</p>';
}
function initVotePage(){
  const voteBtn=$('voteBtn');
  if(!voteBtn)return;
  renderVotes(localVotes());
  voteBtn.onclick=async()=>{
    const name=$('mcName').value.trim();
    if(!name){$('voteMsg').textContent='Enter your Minecraft name first.';return}
    if(configured&&currentUser){
      try{
        await addDoc(collection(db,'votes'),{name,userId:currentUser.uid,createdAt:serverTimestamp()});
        $('voteMsg').textContent='Vote recorded!';
      }catch(e){$('voteMsg').textContent='Could not save vote: '+e.message}
    }else{
      const v=localVotes();v.unshift({name});localStorage.setItem('bl_votes',JSON.stringify(v));renderVotes(v);
      $('voteMsg').textContent=configured?'Login with Google to sync votes publicly.':'Demo vote saved on this device. Add Firebase config to make votes public.';
    }
    $('mcName').value='';
  };
  if(configured){
    onSnapshot(query(collection(db,'votes'),orderBy('createdAt','desc'),limit(30)),snap=>{
      const v=[];snap.forEach(d=>v.push(d.data()));renderVotes(v);
    });
  }
}

// ---------- Community / chat page ----------
function renderMessages(snap){
  const box=$('messages');
  if(!box)return;
  box.innerHTML='';
  snap.forEach(d=>{
    const x=d.data();
    box.innerHTML+=`<div class="message"><b>${escapeHtml(x.name||'Member')}</b> <small>${x.createdAt?.toDate?x.createdAt.toDate().toLocaleTimeString():''}</small><div>${escapeHtml(x.text||'')}</div></div>`;
  });
}
function initCommunityPage(){
  const sendBtn=$('sendBtn');
  if(!sendBtn)return;
  const chatText=$('chatText');
  sendBtn.onclick=async()=>{
    if(!currentUser)return;
    const text=chatText.value.trim();
    if(!text)return;
    await addDoc(collection(db,'messages'),{text,name:currentUser.displayName||currentUser.email,uid:currentUser.uid,createdAt:serverTimestamp()});
    chatText.value='';
  };
  chatText.addEventListener('keydown',e=>{if(e.key==='Enter')sendBtn.click()});
  if(configured){
    onSnapshot(query(collection(db,'messages'),orderBy('createdAt','asc'),limit(100)),renderMessages);
  }
}

// ---------- Auth state (affects nav + community + vote pages) ----------
function initAuth(){
  if(!configured)return;
  onAuthStateChanged(auth,u=>{
    currentUser=u;
    const userInfo=$('userInfo');
    const chatText=$('chatText');
    const sendBtn=$('sendBtn');
    if(u){
      const name=u.displayName||u.email;
      if(userInfo)userInfo.innerHTML=`<p>Signed in as <b>${escapeHtml(name)}</b></p>`;
      if(chatText)chatText.disabled=false;
      if(sendBtn)sendBtn.disabled=false;
      setLoginButtonsState(true,name.split(' ')[0],u.email===ADMIN_EMAIL);
    }else{
      if(userInfo)userInfo.innerHTML='';
      if(chatText)chatText.disabled=true;
      if(sendBtn)sendBtn.disabled=true;
      setLoginButtonsState(false,null,false);
    }
  });
}

// ---------- Announcements (public list) ----------
function renderAnnouncements(snap){
  const box=$('announcementsList');
  if(!box)return;
  const items=[];
  snap.forEach(d=>items.push(d.data()));
  box.innerHTML=items.length?items.map(x=>`<div class="announcement">${x.imageUrl?`<img class="annImg" src="${escapeHtml(x.imageUrl)}" alt="">`:''}<div class="announcementHead"><b>${escapeHtml(x.title||'Announcement')}</b><small>${x.createdAt?.toDate?x.createdAt.toDate().toLocaleString():''}</small></div><p>${escapeHtml(x.text||'')}</p></div>`).join(''):'<p class="muted">No announcements yet.</p>';
}
function initAnnouncementsPage(){
  const box=$('announcementsList');
  if(!box)return;
  if(configured){
    onSnapshot(query(collection(db,'announcements'),orderBy('createdAt','desc'),limit(50)),renderAnnouncements);
  }
}

// ---------- Admin (announcement posting, gated by ADMIN_EMAIL) ----------
function initAdminPage(){
  const postBtn=$('postBtn');
  if(!postBtn)return;
  const gate=$('adminGate');
  const panel=$('adminPanel');
  postBtn.onclick=async()=>{
    if(!currentUser||currentUser.email!==ADMIN_EMAIL)return;
    const title=$('annTitle').value.trim();
    const text=$('annText').value.trim();
    const imageUrl=$('annImageUrl').value.trim();
    if(!text){$('postMsg').textContent='Write an announcement first.';return}
    try{
      await addDoc(collection(db,'announcements'),{title,text,imageUrl,createdAt:serverTimestamp()});
      $('postMsg').textContent='Posted!';
      $('annTitle').value='';$('annText').value='';$('annImageUrl').value='';
    }catch(e){$('postMsg').textContent='Could not post: '+e.message}
  };
  onAuthStateChanged(auth,u=>{
    const isAdmin=u&&u.email===ADMIN_EMAIL;
    if(gate)gate.style.display=isAdmin?'none':'';
    if(panel)panel.style.display=isAdmin?'':'none';
  });
}

wireLoginButtons();
initVotePage();
initCommunityPage();
initAnnouncementsPage();
initAdminPage();
initAuth();
