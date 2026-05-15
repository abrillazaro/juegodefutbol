'use strict';

let scene, renderer, camera, world;
let stadium, ball;
let players = [], humanPlayer;
let controls, gameCamera, gm;
let lastTime = 0;

// Show any JS error on screen so we can debug
window.onerror = function(msg, src, line) {
  const ld = document.getElementById('loading');
  if (ld) {
    ld.style.display = 'flex';
    ld.style.opacity = '1';
  }
  document.getElementById('loading-text').textContent = 'ERROR: ' + msg + ' (line ' + line + ')';
  document.getElementById('loading-text').style.color = '#ff4444';
  return false;
};

function setLoading(pct, txt) {
  document.getElementById('loading-bar').style.width = pct + '%';
  if (txt) document.getElementById('loading-text').textContent = txt;
}

function init() {
  try {
    setLoading(5, 'Iniciando motor 3D...');

    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
    camera.position.set(0, 16, 28);

    setLoading(15, 'Creando fisica...');

    // cannon-es world - use simple defaults
    world = new CANNON.World();
    world.gravity.set(0, -22, 0);

    // Static ground plane
    var ground = new CANNON.Body({ mass: 0 });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(ground);

    setLoading(30, 'Construyendo estadio...');
    stadium = new Stadium(scene);
    stadium.create();

    setLoading(55, 'Preparando pelota...');
    ball = new Ball(scene, world);
    ball.create();
    ball.reset(0, 0);

    setLoading(65, 'Creando jugadores...');
    _createPlayers();

    setLoading(80, 'Configurando controles...');
    controls = new TouchControls();
    controls.init();

    controls.on('shoot', function(pressed) {
      if (pressed && humanPlayer) humanPlayer.shoot(ball);
    });

    controls.on('pass', function(pressed) {
      if (!pressed || !humanPlayer) return;
      var teammates = players.filter(function(p) { return p.team === 'home' && !p.isHuman; });
      if (!teammates.length) return;
      var best = null, bestScore = -Infinity;
      var fy = humanPlayer.mesh.rotation.y;
      var fx = Math.sin(fy), fz = Math.cos(fy);
      teammates.forEach(function(t) {
        var dx = t.body.position.x - humanPlayer.body.position.x;
        var dz = t.body.position.z - humanPlayer.body.position.z;
        var dist = Math.sqrt(dx*dx + dz*dz);
        var score = (dx*fx + dz*fz) / (dist + 0.001) - dist * 0.05;
        if (score > bestScore) { bestScore = score; best = t; }
      });
      if (best) humanPlayer.pass(ball, best);
    });

    controls.on('trick', function(pressed) {
      if (!pressed || !humanPlayer) return;
      var name = humanPlayer.doTrick(ball);
      if (name) {
        var labels = { rainbow:'RAINBOW!', elastico:'ELASTICO!', heel:'TACON!', rabona:'RABONA!' };
        _flash(labels[name] || 'TRUCO!');
      }
    });

    gameCamera = new GameCamera(camera);
    gm = new GameManager();
    gm.init(players, ball);
    gm._resetPositions();

    setLoading(100, 'Listo!');

    window.addEventListener('resize', function() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Hide loading after short delay
    setTimeout(function() {
      var ld = document.getElementById('loading');
      ld.style.transition = 'opacity 0.5s';
      ld.style.opacity = '0';
      setTimeout(function() { ld.style.display = 'none'; }, 500);
      requestAnimationFrame(loop);
    }, 500);

  } catch (e) {
    document.getElementById('loading-text').textContent = 'ERROR: ' + e.message;
    document.getElementById('loading-text').style.color = '#ff4444';
    console.error(e);
  }
}

function _createPlayers() {
  var homeCfg = [
    { pos: new THREE.Vector3(0,0,8),    isHuman:true,  role:'field',      number:10 },
    { pos: new THREE.Vector3(-9,0,18),  isHuman:false, role:'field',      number:7  },
    { pos: new THREE.Vector3(9,0,18),   isHuman:false, role:'field',      number:11 },
    { pos: new THREE.Vector3(-15,0,32), isHuman:false, role:'field',      number:5  },
    { pos: new THREE.Vector3(15,0,32),  isHuman:false, role:'field',      number:4  },
    { pos: new THREE.Vector3(0,0,46),   isHuman:false, role:'goalkeeper', number:1  }
  ];
  var awayCfg = [
    { pos: new THREE.Vector3(0,0,-8),   role:'field' },
    { pos: new THREE.Vector3(-9,0,-18), role:'field' },
    { pos: new THREE.Vector3(9,0,-18),  role:'field' },
    { pos: new THREE.Vector3(-15,0,-32),role:'field' },
    { pos: new THREE.Vector3(15,0,-32), role:'field' },
    { pos: new THREE.Vector3(0,0,-46),  role:'goalkeeper' }
  ];

  homeCfg.forEach(function(cfg) {
    var p = new Player(scene, world, {
      team:'home', isHuman: cfg.isHuman,
      kitColor:   cfg.isHuman ? 0x0033cc : 0x1155ee,
      shortColor: cfg.isHuman ? 0xffffff : 0xddddff,
      role: cfg.role, number: cfg.number, position: cfg.pos
    });
    p.create(cfg.pos);
    players.push(p);
    if (cfg.isHuman) humanPlayer = p;
  });

  awayCfg.forEach(function(cfg) {
    var p = new Player(scene, world, {
      team:'away', isHuman:false,
      kitColor:0xcc1111, shortColor:0x111111,
      role:cfg.role, number:9, position:cfg.pos
    });
    p.create(cfg.pos);
    players.push(p);
  });
}

function _flash(msg) {
  var el = document.getElementById('message');
  el.textContent = msg;
  clearTimeout(_flash._t);
  _flash._t = setTimeout(function() { el.textContent = ''; }, 1800);
}

function loop(timestamp) {
  requestAnimationFrame(loop);
  var dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (dt <= 0) return;

  world.step(1/60, dt, 3);
  controls.update();
  gm.update(dt, gameCamera);

  if (gm.state === 'playing') {
    var home = players.filter(function(p) { return p.team === 'home'; });
    var away = players.filter(function(p) { return p.team === 'away'; });
    players.forEach(function(p) {
      p.update(dt, controls, ball, home, away, gameCamera.angle);
    });
  }

  ball.update();
  gameCamera.update(humanPlayer, ball);
  gameCamera.applyShake(dt);
  renderer.render(scene, camera);
}

window.addEventListener('load', init);
