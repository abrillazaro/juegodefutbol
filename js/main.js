'use strict';

let scene, renderer, camera, world;
let stadium, ball;
let players = [], humanPlayer;
let controls, gameCamera, gm;
let lastTime = 0;

function setLoading(pct, txt) {
  document.getElementById('loading-bar').style.width = pct + '%';
  if (txt) document.getElementById('loading-text').textContent = txt;
}

async function init() {
  setLoading(5, 'Iniciando motor 3D...');

  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth/window.innerHeight, 0.1, 800);
  camera.position.set(0, 16, 28);

  setLoading(15, 'Creando fisica...');

  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  const ground = new CANNON.Body({ type: CANNON.Body.STATIC });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
  world.addBody(ground);

  setLoading(30, 'Construyendo estadio...');
  stadium = new Stadium(scene);
  stadium.create();

  setLoading(55, 'Preparando jugadores...');
  ball = new Ball(scene, world);
  ball.create();
  ball.reset(0, 0);

  _createPlayers();

  setLoading(75, 'Configurando controles...');
  controls = new TouchControls();
  controls.init();

  controls.on('shoot', pressed => {
    if (pressed && humanPlayer) humanPlayer.shoot(ball);
  });

  controls.on('pass', pressed => {
    if (!pressed || !humanPlayer) return;
    const teammates = players.filter(p => p.team==='home' && !p.isHuman);
    if (!teammates.length) return;
    let best = null, bestScore = -Infinity;
    const fy = humanPlayer.mesh.rotation.y;
    const fx = Math.sin(fy), fz = Math.cos(fy);
    teammates.forEach(t => {
      const dx = t.body.position.x - humanPlayer.body.position.x;
      const dz = t.body.position.z - humanPlayer.body.position.z;
      const dist = Math.sqrt(dx*dx+dz*dz);
      const score = (dx*fx+dz*fz)/(dist+0.001) - dist*0.05;
      if (score > bestScore) { bestScore = score; best = t; }
    });
    if (best) humanPlayer.pass(ball, best);
  });

  controls.on('trick', pressed => {
    if (!pressed || !humanPlayer) return;
    const name = humanPlayer.doTrick(ball);
    if (name) {
      const labels = { rainbow:'RAINBOW!', elastico:'ELASTICO!', heel:'TACON!', rabona:'RABONA!' };
      _flash(labels[name] || 'TRUCO!');
    }
  });

  gameCamera = new GameCamera(camera);
  gm = new GameManager();
  gm.init(players, ball);
  gm._resetPositions();

  setLoading(100, 'Listo!');

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  await new Promise(r => setTimeout(r, 300));
  const ld = document.getElementById('loading');
  ld.style.transition = 'opacity 0.5s';
  ld.style.opacity = '0';
  setTimeout(() => ld.style.display = 'none', 500);

  requestAnimationFrame(loop);
}

function _createPlayers() {
  const homeCfg = [
    { pos: new THREE.Vector3(0,0,8),   isHuman:true, role:'field', number:10 },
    { pos: new THREE.Vector3(-9,0,18), role:'field' },
    { pos: new THREE.Vector3(9,0,18),  role:'field' },
    { pos: new THREE.Vector3(-15,0,32),role:'field' },
    { pos: new THREE.Vector3(15,0,32), role:'field' },
    { pos: new THREE.Vector3(0,0,46),  role:'goalkeeper' },
  ];
  const awayCfg = [
    { pos: new THREE.Vector3(0,0,-8),  role:'field' },
    { pos: new THREE.Vector3(-9,0,-18),role:'field' },
    { pos: new THREE.Vector3(9,0,-18), role:'field' },
    { pos: new THREE.Vector3(-15,0,-32),role:'field' },
    { pos: new THREE.Vector3(15,0,-32),role:'field' },
    { pos: new THREE.Vector3(0,0,-46), role:'goalkeeper' },
  ];

  homeCfg.forEach(cfg => {
    const p = new Player(scene, world, {
      team:'home', isHuman:cfg.isHuman||false,
      kitColor: cfg.isHuman ? 0x0033cc : 0x1155ee,
      shortColor: cfg.isHuman ? 0xffffff : 0xddddff,
      role: cfg.role, number: cfg.number||7, position: cfg.pos
    });
    p.create(cfg.pos);
    players.push(p);
    if (cfg.isHuman) humanPlayer = p;
  });

  awayCfg.forEach(cfg => {
    const p = new Player(scene, world, {
      team:'away', isHuman:false,
      kitColor:0xcc1111, shortColor:0x111111,
      role:cfg.role, number:9, position:cfg.pos
    });
    p.create(cfg.pos);
    players.push(p);
  });
}

function _flash(msg) {
  const el = document.getElementById('message');
  el.textContent = msg;
  clearTimeout(_flash._t);
  _flash._t = setTimeout(() => { el.textContent = ''; }, 1800);
}

function loop(timestamp) {
  requestAnimationFrame(loop);
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (dt <= 0) return;

  world.step(1/60, dt, 3);
  controls.update();
  gm.update(dt, gameCamera);

  if (gm.state === 'playing') {
    const home = players.filter(p => p.team==='home');
    const away = players.filter(p => p.team==='away');
    players.forEach(p => p.update(dt, controls, ball, home, away, gameCamera.angle));
  }

  ball.update();
  gameCamera.update(humanPlayer, ball);
  gameCamera.applyShake(dt);
  renderer.render(scene, camera);
}

window.addEventListener('load', init);
