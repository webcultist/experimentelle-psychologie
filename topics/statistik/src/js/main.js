function toggleDD(id){document.getElementById(id).classList.toggle('open')}
function checkQuiz(id,btn,ok){
  const q=document.getElementById(id),os=q.querySelectorAll('.quiz-option'),fc=q.querySelector('.correct-fb'),fw=q.querySelector('.wrong-fb');
  os.forEach(o=>{o.disabled=true;o.classList.remove('correct','wrong')});
  if(ok){btn.classList.add('correct');fc.classList.add('show');fw.classList.remove('show')}
  else{btn.classList.add('wrong');fw.classList.add('show');fc.classList.remove('show');os.forEach(o=>{if(o.dataset.correct==='true')o.classList.add('correct')})}
}
const secs=document.querySelectorAll('section[id]'),navs=document.querySelectorAll('nav a');
function upNav(){const y=window.scrollY+100;secs.forEach(s=>{if(y>=s.offsetTop&&y<s.offsetTop+s.offsetHeight)navs.forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+s.id))})}
function upProg(){document.getElementById('progressBar').style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100+'%'}
function upTop(){document.getElementById('topBtn').classList.toggle('visible',window.scrollY>500)}
window.addEventListener('scroll',()=>{upNav();upProg();upTop()});upNav();
navs.forEach(l=>l.addEventListener('click',e=>{e.preventDefault();document.querySelector(l.getAttribute('href'))?.scrollIntoView({behavior:'smooth'})}));
