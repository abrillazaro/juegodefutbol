'use strict';

class Stadium {
  constructor(scene) {
    this.scene = scene;
    this.FW = 68;
    this.FL = 105;
    this.GOAL_W = 7.32;
    this.GOAL_H = 2.44;
    this.GOAL_D = 2.0;
  }

  create() {
    this._createField();
    this._createGoals();
    this._createStands();
    this._createLights();
    this._createSky();
  }

  _createField() {
    const mat  = new THREE.MeshLambertMaterial({ color: 0x2d7a27 });
    const geo  = new THREE.PlaneGeometry(this.FW, this.FL);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const smat = new THREE.MeshLambertMaterial({ color: 0x246e1f, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 10; i += 2) {
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(this.FW, this.FL / 10), smat);
      sm.rotation.x = -Math.PI / 2;
      sm.position.set(0, 0.01, -this.FL / 2 + (i + 0.5) * (this.FL / 10));
      this.scene.add(sm);
    }
    this._drawLines();
  }

  _drawLines() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const W = this.FW / 2, L = this.FL / 2;
    const Y = 0.02;

    const line = (x1, z1, x2, z2, w = 0.13) => {
      const len = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -Math.atan2(z2-z1, x2-x1);
      m.position.set((x1+x2)/2, Y, (z1+z2)/2);
      this.scene.add(m);
    };

    line(-W,-L, W,-L); line(-W,L, W,L);
    line(-W,-L,-W, L); line( W,-L, W, L);
    line(-W, 0, W, 0);
    this._circle(0, 0, 9.15);
    this._spot(0, 0);

    const pa = (zSign) => {
      const z0 = zSign * L, z1 = zSign * (L - 16.5);
      line(-16.5, z0, -16.5, z1); line(16.5, z0, 16.5, z1); line(-16.5, z1, 16.5, z1);
      const g0 = zSign * L, g1 = zSign * (L - 5.5);
      line(-9.16, g0, -9.16, g1); line(9.16, g0, 9.16, g1); line(-9.16, g1, 9.16, g1);
      this._spot(0, zSign * (L - 11));
    };
    pa(-1); pa(1);
  }

  _circle(cx, cz, r, segs = 64) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0.02, cz + Math.sin(a) * r));
    }
    this.scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    ));
  }

  _spot(x, z) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    this.scene.add(m);
  }

  _createGoals() {
    this._makeGoal(-this.FL / 2,  1);
    this._makeGoal( this.FL / 2, -1);
  }

  _makeGoal(z, facing) {
    const W = this.GOAL_W, H = this.GOAL_H, D = this.GOAL_D;
    const r = 0.06;
    const pMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 80 });
    const g = new THREE.Group();

    const cyl = (radius, height, x, y, gz, rotZ = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 10), pMat);
      m.rotation.z = rotZ;
      m.position.set(x, y, gz);
      g.add(m);
    };

    cyl(r, H, -W/2, H/2, 0);
    cyl(r, H,  W/2, H/2, 0);
    cyl(r, W, 0, H, 0, Math.PI/2);
    cyl(r*0.7, H, -W/2, H/2, facing*D);
    cyl(r*0.7, H,  W/2, H/2, facing*D);
    cyl(r*0.7, W, 0, H, facing*D, Math.PI/2);

    const nMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, wireframe: true });
    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 12, 8), nMat);
    backNet.position.set(0, H/2, facing*D); g.add(backNet);

    const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(D, H, 4, 8), nMat);
    sideNet.rotation.y = Math.PI/2;
    [-W/2, W/2].forEach(sx => { const s = sideNet.clone(); s.position.set(sx, H/2, facing*D/2); g.add(s); });

    const topNet = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 12, 4), nMat);
    topNet.rotation.x = Math.PI/2;
    topNet.position.set(0, H, facing*D/2); g.add(topNet);

    g.position.set(0, 0, z);
    this.scene.add(g);
  }

  _createStands() {
    const W = this.FW, L = this.FL;
    [
      { pos: [-(W/2+16), 5, 0], size: [22, 14, L+20] },
      { pos: [ (W/2+16), 5, 0], size: [22, 14, L+20] },
      { pos: [0, 5, -(L/2+16)], size: [W+20, 14, 22] },
      { pos: [0, 5,  (L/2+16)], size: [W+20, 14, 22] },
    ].forEach(cfg => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(...cfg.size),
        new THREE.MeshLambertMaterial({ color: 0x6a6a7a })
      );
      m.position.set(...cfg.pos);
      this.scene.add(m);
      this._addCrowd(cfg.pos, cfg.size);
    });

    const trackMat = new THREE.MeshLambertMaterial({ color: 0xcc4400 });
    const track = new THREE.Mesh(new THREE.PlaneGeometry(W + 14, L + 14), trackMat);
    track.rotation.x = -Math.PI/2;
    track.position.y = 0.005;
    this.scene.add(track);

    const towerMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    [[-W/2-28, -(L/2+28)], [W/2+28, -(L/2+28)], [-W/2-28, (L/2+28)], [W/2+28, (L/2+28)]].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 28, 8), towerMat);
      tower.position.set(tx, 14, tz);
      this.scene.add(tower);
      const head = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 2), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
      head.position.set(tx, 28.4, tz);
      this.scene.add(head);
    });
  }

  _addCrowd(pos, size) {
    const palette = [0xff2222, 0x2244ff, 0xffff00, 0xffffff, 0x22cc44, 0xff8800, 0xcc00cc];
    for (let i = 0; i < 120; i++) {
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 5, 4),
        new THREE.MeshBasicMaterial({ color: palette[Math.floor(Math.random() * palette.length)] })
      );
      head.position.set(
        pos[0] + (Math.random()-0.5) * size[0] * 0.85,
        pos[1] + (Math.random()-0.5) * size[1] * 0.6 + 1,
        pos[2] + (Math.random()-0.5) * (size[2] || size[1]) * 0.85
      );
      this.scene.add(head);
    }
  }

  _createLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    [[-45,25,-60],[45,25,-60],[-45,25,60],[45,25,60]].forEach(([x,y,z]) => {
      const dl = new THREE.DirectionalLight(0xfff5e0, 0.75);
      dl.position.set(x, y, z);
      dl.castShadow = true;
      dl.shadow.mapSize.set(512, 512);
      dl.shadow.camera.left = -90; dl.shadow.camera.right = 90;
      dl.shadow.camera.top  =  90; dl.shadow.camera.bottom = -90;
      dl.shadow.camera.far  = 200;
      this.scene.add(dl);
    });
  }

  _createSky() {
    this.scene.background = new THREE.Color(0x06061a);
    this.scene.fog = new THREE.FogExp2(0x06061a, 0.006);
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 800; i++) {
      starPos.push((Math.random()-0.5)*600, Math.random()*200+30, (Math.random()-0.5)*600);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 })));
  }
}
