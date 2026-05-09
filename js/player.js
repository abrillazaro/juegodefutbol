'use strict';

class Player {
  constructor(scene, world, opts = {}) {
    this.scene    = scene;
    this.world    = world;
    this.isHuman  = opts.isHuman || false;
    this.team     = opts.team || 'home';
    this.kitColor = opts.kitColor || (this.team === 'home' ? 0x0044cc : 0xcc1111);
    this.shortColor = opts.shortColor || 0xffffff;
    this.number   = opts.number || 10;
    this.mesh = null; this.body = null; this.parts = {};
    this.speed = 8.5; this.sprintSpeed = 14.0;
    this.hasBall = false; this.state = 'idle';
    this.animTime = Math.random() * 10;
    this.shootCD = 0; this.passCD = 0; this.trickCD = 0; this.celebTimer = 0;
    this.startPos = opts.position ? opts.position.clone() : new THREE.Vector3();
    this.attackZ  = this.team === 'home' ? -52.5 : 52.5;
    this._aiRole  = opts.role || 'field';
  }

  create(pos) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(pos || this.startPos);
    const skin  = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
    const kit   = new THREE.MeshPhongMaterial({ color: this.kitColor });
    const shorts = new THREE.MeshPhongMaterial({ color: this.shortColor });
    const shoe  = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const hair  = new THREE.MeshPhongMaterial({ color: 0x2a1500 });

    const add = (geo, mat, x, y, z, name) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.mesh.add(m);
      if (name) this.parts[name] = m;
      return m;
    };

    add(new THREE.SphereGeometry(0.19,10,8), skin, 0, 1.58, 0, 'head');
    add(new THREE.SphereGeometry(0.20,10,6), hair, 0, 1.67, 0);
    add(new THREE.BoxGeometry(0.48,0.56,0.24), kit, 0, 1.03, 0, 'torso');
    const armGeo = new THREE.CylinderGeometry(0.075,0.065,0.48,7);
    add(armGeo, kit, -0.31, 1.03, 0, 'lArm');
    add(armGeo, kit,  0.31, 1.03, 0, 'rArm');
    const ulGeo = new THREE.CylinderGeometry(0.10,0.09,0.42,7);
    add(ulGeo, shorts, -0.14, 0.57, 0, 'lUL');
    add(ulGeo, shorts,  0.14, 0.57, 0, 'rUL');
    const llGeo = new THREE.CylinderGeometry(0.08,0.065,0.38,7);
    add(llGeo, kit, -0.14, 0.19, 0, 'lLL');
    add(llGeo, kit,  0.14, 0.19, 0, 'rLL');
    add(new THREE.BoxGeometry(0.14,0.08,0.26), shoe, -0.14, 0.02, 0.06, 'lShoe');
    add(new THREE.BoxGeometry(0.14,0.08,0.26), shoe,  0.14, 0.02, 0.06, 'rShoe');

    if (this.isHuman) {
      const nc = document.createElement('canvas');
      nc.width = nc.height = 64;
      const nctx = nc.getContext('2d');
      nctx.fillStyle = '#ffffff';
      nctx.font = 'bold 44px Arial';
      nctx.textAlign = 'center';
      nctx.fillText(String(this.number), 32, 50);
      const nm = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28,0.28),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true })
      );
      nm.position.set(0, 1.04, -0.13);
      nm.rotation.y = Math.PI;
      this.mesh.add(nm);
    }

    this.scene.add(this.mesh);

    this.body = new CANNON.Body({ mass: 70, fixedRotation: true, linearDamping: 0.92, angularDamping: 1.0 });
    this.body.addShape(new CANNON.Cylinder(0.28, 0.28, 1.8, 8));
    this.body.position.set((pos||this.startPos).x, 0.9, (pos||this.startPos).z);
    this.world.addBody(this.body);
  }

  update(dt, controls, ball, teammates, opponents, camAngle) {
    this.animTime += dt;
    this.shootCD = Math.max(0, this.shootCD - dt);
    this.passCD  = Math.max(0, this.passCD  - dt);
    this.trickCD = Math.max(0, this.trickCD - dt);

    if (this.celebTimer > 0) {
      this.celebTimer -= dt;
      this.state = 'celebrating';
    } else if (this.isHuman) {
      this._updateHuman(dt, controls, ball, camAngle);
    } else {
      this._updateAI(dt, ball, teammates, opponents);
    }

    this.mesh.position.x = this.body.position.x;
    this.mesh.position.z = this.body.position.z;
    this.mesh.position.y = 0;
    this._animate(dt);
  }

  _updateHuman(dt, controls, ball, camAngle) {
    const spd = controls.buttons.sprint ? this.sprintSpeed : this.speed;
    const jx = controls.joystick.x, jy = controls.joystick.y;
    const moving = controls.joystick.active && (Math.abs(jx) > 0.08 || Math.abs(jy) > 0.08);

    if (moving) {
      const ca = camAngle;
      const mx = jx * Math.cos(ca) + jy * Math.sin(ca);
      const mz = jy * Math.cos(ca) - jx * Math.sin(ca);
      this.body.velocity.x = mx * spd;
      this.body.velocity.z = mz * spd;
      this.mesh.rotation.y = Math.atan2(mx, mz);
      this.state = 'running';
    } else {
      this.body.velocity.x *= 0.8;
      this.body.velocity.z *= 0.8;
      this.state = 'idle';
    }

    const bp = ball.getPosition();
    const dist = this._distTo(bp.x, bp.z);
    this.hasBall = dist < 1.3;

    if (this.hasBall && moving) {
      this.state = 'dribbling';
      const ca = camAngle;
      const mx = jx * Math.cos(ca) + jy * Math.sin(ca);
      const mz = jy * Math.cos(ca) - jx * Math.sin(ca);
      ball.body.velocity.x = mx * spd * 0.55;
      ball.body.velocity.z = mz * spd * 0.55;
    }
  }

  _updateAI(dt, ball, teammates, opponents) {
    const bp  = ball.getPosition();
    const myP = this.body.position;
    const distToBall = this._distTo(bp.x, bp.z);
    this.hasBall = distToBall < 1.3;

    if (this._aiRole === 'goalkeeper') {
      const goalZ = this.team === 'home' ? 52.5 : -52.5;
      this._moveToward(Math.max(-3.5, Math.min(3.5, bp.x)), goalZ * 0.92, this.speed * 0.9);
      return;
    }

    if (this.hasBall) {
      const dz = this.attackZ - myP.z;
      ball.body.velocity.x = (0 - bp.x) * 1.5;
      ball.body.velocity.z = Math.sign(dz) * 4.5;
      this._moveToward(myP.x, myP.z + Math.sign(dz)*3, this.speed);
      if (Math.abs(myP.z - this.attackZ) < 28 && this.shootCD <= 0) {
        const goalX = (Math.random()-0.5)*5;
        const goalZ = this.attackZ;
        const dx = goalX - bp.x, dz2 = goalZ - bp.z;
        const len = Math.sqrt(dx*dx+dz2*dz2);
        ball.shoot({ x: dx/len, z: dz2/len }, 18);
        this.shootCD = 2.5;
      }
    } else {
      const isNearest = teammates.filter(t => !t.isHuman && t !== this)
        .every(t => distToBall <= t._distTo(bp.x, bp.z));
      if (isNearest) {
        this._moveToward(bp.x, bp.z, this.speed * 0.85);
      } else {
        this._moveToward(bp.x + (myP.x < 0 ? -8 : 8), bp.z + (this.team==='home'?-5:5), this.speed * 0.7);
      }
    }
  }

  _moveToward(tx, tz, spd) {
    const dx = tx - this.body.position.x;
    const dz = tz - this.body.position.z;
    const len = Math.sqrt(dx*dx+dz*dz);
    if (len > 0.4) {
      this.body.velocity.x = (dx/len)*spd;
      this.body.velocity.z = (dz/len)*spd;
      this.mesh.rotation.y = Math.atan2(dx, dz);
      this.state = 'running';
    } else {
      this.body.velocity.x *= 0.85;
      this.body.velocity.z *= 0.85;
      this.state = 'idle';
    }
  }

  shoot(ball) {
    if (this.shootCD > 0) return false;
    const bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 2.2) return false;
    const goalX = (Math.random()-0.5)*4;
    const dx = goalX - bp.x, dz = this.attackZ - bp.z;
    const len = Math.sqrt(dx*dx+dz*dz);
    ball.shoot({ x: dx/len, z: dz/len }, 22);
    this.shootCD = 1.2;
    return true;
  }

  pass(ball, target) {
    if (this.passCD > 0) return false;
    const bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 2.2) return false;
    const tp = target.body.position;
    const dx = tp.x - bp.x, dz = tp.z - bp.z;
    const len = Math.sqrt(dx*dx+dz*dz);
    ball.shoot({ x: dx/len, z: dz/len }, Math.min(len*1.1, 16));
    this.passCD = 0.7;
    return true;
  }

  doTrick(ball) {
    if (this.trickCD > 0) return null;
    const bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 1.8) return null;
    const tricks = ['rainbow','elastico','heel','rabona'];
    const trick = tricks[Math.floor(Math.random()*tricks.length)];
    switch(trick) {
      case 'rainbow':
        ball.body.velocity.set(this.body.velocity.x*0.3, 10, this.body.velocity.z*0.3); break;
      case 'elastico': {
        const s = Math.random()<0.5?1:-1, a = this.mesh.rotation.y + s*Math.PI/3;
        ball.body.velocity.set(Math.sin(a)*7, 1.5, Math.cos(a)*7); break;
      }
      case 'heel':
        ball.body.velocity.set(-this.body.velocity.x*1.8, 3, -this.body.velocity.z*1.8); break;
      case 'rabona': {
        const a = this.mesh.rotation.y + Math.PI/4;
        ball.body.velocity.set(Math.sin(a)*9, 2, Math.cos(a)*9); break;
      }
    }
    this.trickCD = 1.0;
    return trick;
  }

  celebrate() {
    this.celebTimer = 3;
    this.body.velocity.set((Math.random()-0.5)*4, 6, (Math.random()-0.5)*4);
  }

  reset(pos) {
    const p = pos || this.startPos;
    this.body.position.set(p.x, 0.9, p.z);
    this.body.velocity.setZero();
    this.hasBall = false; this.celebTimer = 0; this.state = 'idle';
  }

  _animate(dt) {
    const t = this.animTime;
    const mov = this.state==='running'||this.state==='dribbling';
    const cel = this.state==='celebrating';
    const freq = mov ? (this.state==='dribbling'?10:7) : 2;
    const amp  = mov ? 0.45 : (cel ? 0.8 : 0.04);
    if (this.parts.lUL) {
      this.parts.lUL.rotation.x =  Math.sin(t*freq)*amp;
      this.parts.rUL.rotation.x = -Math.sin(t*freq)*amp;
      this.parts.lLL.rotation.x =  Math.max(0, Math.sin(t*freq+0.5)*amp*0.7);
      this.parts.rLL.rotation.x =  Math.max(0,-Math.sin(t*freq+0.5)*amp*0.7);
      this.parts.lArm.rotation.x = -Math.sin(t*freq)*amp*0.5;
      this.parts.rArm.rotation.x =  Math.sin(t*freq)*amp*0.5;
    }
    if (cel && this.parts.head) this.parts.head.rotation.y = Math.sin(t*5)*0.4;
  }

  _distTo(x, z) {
    const dx = x-this.body.position.x, dz = z-this.body.position.z;
    return Math.sqrt(dx*dx+dz*dz);
  }
}
