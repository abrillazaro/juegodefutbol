'use strict';

class Player {
  constructor(scene, world, opts) {
    opts = opts || {};
    this.scene      = scene;
    this.world      = world;
    this.isHuman    = opts.isHuman  || false;
    this.team       = opts.team     || 'home';
    this.kitColor   = opts.kitColor || (this.team === 'home' ? 0x0044cc : 0xcc1111);
    this.shortColor = opts.shortColor || 0xffffff;
    this.number     = opts.number   || 10;
    this.mesh  = null; this.body  = null; this.parts = {};
    this.speed = 8.5;  this.sprintSpeed = 14.0;
    this.hasBall = false; this.state = 'idle';
    this.animTime  = Math.random() * 10;
    this.shootCD   = 0; this.passCD = 0; this.trickCD = 0; this.celebTimer = 0;
    this.startPos  = opts.position ? opts.position.clone() : new THREE.Vector3();
    this.attackZ   = this.team === 'home' ? -52.5 : 52.5;
    this._aiRole   = opts.role || 'field';
  }

  create(pos) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(pos || this.startPos);

    var skin   = new THREE.MeshPhongMaterial({ color: 0xffcc99 });
    var kit    = new THREE.MeshPhongMaterial({ color: this.kitColor });
    var shorts = new THREE.MeshPhongMaterial({ color: this.shortColor });
    var shoe   = new THREE.MeshPhongMaterial({ color: 0x111111 });
    var hair   = new THREE.MeshPhongMaterial({ color: 0x2a1500 });
    var self   = this;

    function add(geo, mat, x, y, z, name) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      self.mesh.add(m);
      if (name) self.parts[name] = m;
      return m;
    }

    add(new THREE.SphereGeometry(0.19,10,8), skin, 0, 1.58, 0, 'head');
    add(new THREE.SphereGeometry(0.20,10,6), hair, 0, 1.67, 0);
    add(new THREE.BoxGeometry(0.48,0.56,0.24), kit, 0, 1.03, 0, 'torso');
    var armGeo = new THREE.CylinderGeometry(0.075,0.065,0.48,7);
    add(armGeo, kit, -0.31, 1.03, 0, 'lArm');
    add(armGeo, kit,  0.31, 1.03, 0, 'rArm');
    var ulGeo = new THREE.CylinderGeometry(0.10,0.09,0.42,7);
    add(ulGeo, shorts, -0.14, 0.57, 0, 'lUL');
    add(ulGeo, shorts,  0.14, 0.57, 0, 'rUL');
    var llGeo = new THREE.CylinderGeometry(0.08,0.065,0.38,7);
    add(llGeo, kit, -0.14, 0.19, 0, 'lLL');
    add(llGeo, kit,  0.14, 0.19, 0, 'rLL');
    add(new THREE.BoxGeometry(0.14,0.08,0.26), shoe, -0.14, 0.02, 0.06, 'lShoe');
    add(new THREE.BoxGeometry(0.14,0.08,0.26), shoe,  0.14, 0.02, 0.06, 'rShoe');

    if (this.isHuman) {
      var nc   = document.createElement('canvas');
      nc.width = nc.height = 64;
      var nctx = nc.getContext('2d');
      nctx.fillStyle = '#ffffff';
      nctx.font = 'bold 44px Arial';
      nctx.textAlign = 'center';
      nctx.fillText(String(this.number), 32, 50);
      var nm = new THREE.Mesh(
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
      this._updateAI(dt, ball, teammates);
    }

    this.mesh.position.x = this.body.position.x;
    this.mesh.position.z = this.body.position.z;
    this.mesh.position.y = 0;
    this._animate();
  }

  _updateHuman(dt, controls, ball, camAngle) {
    var spd = controls.buttons.sprint ? this.sprintSpeed : this.speed;
    var jx  = controls.joystick.x;
    var jy  = controls.joystick.y;
    var moving = controls.joystick.active && (Math.abs(jx) > 0.08 || Math.abs(jy) > 0.08);

    if (moving) {
      var ca = camAngle;
      var mx =  jx * Math.cos(ca) + jy * Math.sin(ca);
      var mz =  jy * Math.cos(ca) - jx * Math.sin(ca);
      this.body.velocity.x = mx * spd;
      this.body.velocity.z = mz * spd;
      this.mesh.rotation.y = Math.atan2(mx, mz);
      this.state = 'running';
    } else {
      this.body.velocity.x *= 0.8;
      this.body.velocity.z *= 0.8;
      this.state = 'idle';
    }

    var bp   = ball.getPosition();
    var dist = this._distTo(bp.x, bp.z);
    this.hasBall = dist < 1.3;

    if (this.hasBall && moving) {
      this.state = 'dribbling';
      var ca2 = camAngle;
      var mx2 = jx * Math.cos(ca2) + jy * Math.sin(ca2);
      var mz2 = jy * Math.cos(ca2) - jx * Math.sin(ca2);
      ball.body.velocity.x = mx2 * spd * 0.55;
      ball.body.velocity.z = mz2 * spd * 0.55;
    }
  }

  _updateAI(dt, ball, teammates) {
    var bp  = ball.getPosition();
    var myP = this.body.position;
    var distToBall = this._distTo(bp.x, bp.z);
    this.hasBall = distToBall < 1.3;

    if (this._aiRole === 'goalkeeper') {
      var goalZ = this.team === 'home' ? 52.5 : -52.5;
      this._moveToward(Math.max(-3.5, Math.min(3.5, bp.x)), goalZ * 0.92, this.speed * 0.9);
      return;
    }

    if (this.hasBall) {
      var dz = this.attackZ - myP.z;
      ball.body.velocity.x = (0 - bp.x) * 1.5;
      ball.body.velocity.z = Math.sign(dz) * 4.5;
      this._moveToward(myP.x, myP.z + Math.sign(dz) * 3, this.speed);
      if (Math.abs(myP.z - this.attackZ) < 28 && this.shootCD <= 0) {
        var goalX = (Math.random() - 0.5) * 5;
        var ddx   = goalX - bp.x;
        var ddz   = this.attackZ - bp.z;
        var len   = Math.sqrt(ddx*ddx + ddz*ddz);
        ball.shoot({ x: ddx/len, z: ddz/len }, 18);
        this.shootCD = 2.5;
      }
    } else {
      var self    = this;
      var others  = teammates.filter(function(t) { return !t.isHuman && t !== self; });
      var nearest = others.every(function(t) { return distToBall <= t._distTo(bp.x, bp.z); });
      if (nearest || others.length === 0) {
        this._moveToward(bp.x, bp.z, this.speed * 0.85);
      } else {
        this._moveToward(bp.x + (myP.x < 0 ? -8 : 8), bp.z + (this.team==='home' ? -5 : 5), this.speed * 0.7);
      }
    }
  }

  _moveToward(tx, tz, spd) {
    var dx = tx - this.body.position.x;
    var dz = tz - this.body.position.z;
    var len = Math.sqrt(dx*dx + dz*dz);
    if (len > 0.4) {
      this.body.velocity.x = (dx/len) * spd;
      this.body.velocity.z = (dz/len) * spd;
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
    var bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 2.2) return false;
    var goalX = (Math.random() - 0.5) * 4;
    var dx = goalX - bp.x;
    var dz = this.attackZ - bp.z;
    var len = Math.sqrt(dx*dx + dz*dz);
    ball.shoot({ x: dx/len, z: dz/len }, 22);
    this.shootCD = 1.2;
    return true;
  }

  pass(ball, target) {
    if (this.passCD > 0) return false;
    var bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 2.2) return false;
    var tp  = target.body.position;
    var dx  = tp.x - bp.x;
    var dz  = tp.z - bp.z;
    var len = Math.sqrt(dx*dx + dz*dz);
    ball.shoot({ x: dx/len, z: dz/len }, Math.min(len * 1.1, 16));
    this.passCD = 0.7;
    return true;
  }

  doTrick(ball) {
    if (this.trickCD > 0) return null;
    var bp = ball.getPosition();
    if (this._distTo(bp.x, bp.z) > 1.8) return null;
    var tricks = ['rainbow', 'elastico', 'heel', 'rabona'];
    var trick  = tricks[Math.floor(Math.random() * tricks.length)];
    var a;
    switch (trick) {
      case 'rainbow':
        ball.body.velocity.set(this.body.velocity.x * 0.3, 10, this.body.velocity.z * 0.3);
        break;
      case 'elastico':
        a = this.mesh.rotation.y + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 3;
        ball.body.velocity.set(Math.sin(a) * 7, 1.5, Math.cos(a) * 7);
        break;
      case 'heel':
        ball.body.velocity.set(-this.body.velocity.x * 1.8, 3, -this.body.velocity.z * 1.8);
        break;
      case 'rabona':
        a = this.mesh.rotation.y + Math.PI / 4;
        ball.body.velocity.set(Math.sin(a) * 9, 2, Math.cos(a) * 9);
        break;
    }
    this.trickCD = 1.0;
    return trick;
  }

  celebrate() {
    this.celebTimer = 3;
    this.body.velocity.set((Math.random()-0.5)*4, 6, (Math.random()-0.5)*4);
  }

  reset(pos) {
    var p = pos || this.startPos;
    this.body.position.set(p.x, 0.9, p.z);
    this.body.velocity.set(0, 0, 0);
    this.hasBall = false; this.celebTimer = 0; this.state = 'idle';
  }

  _animate() {
    var t    = this.animTime;
    var mov  = (this.state === 'running' || this.state === 'dribbling');
    var cel  = (this.state === 'celebrating');
    var freq = mov ? (this.state === 'dribbling' ? 10 : 7) : 2;
    var amp  = mov ? 0.45 : (cel ? 0.8 : 0.04);
    if (this.parts.lUL) {
      this.parts.lUL.rotation.x =  Math.sin(t * freq) * amp;
      this.parts.rUL.rotation.x = -Math.sin(t * freq) * amp;
      this.parts.lLL.rotation.x =  Math.max(0,  Math.sin(t * freq + 0.5) * amp * 0.7);
      this.parts.rLL.rotation.x =  Math.max(0, -Math.sin(t * freq + 0.5) * amp * 0.7);
      this.parts.lArm.rotation.x = -Math.sin(t * freq) * amp * 0.5;
      this.parts.rArm.rotation.x =  Math.sin(t * freq) * amp * 0.5;
    }
    if (cel && this.parts.head) this.parts.head.rotation.y = Math.sin(t * 5) * 0.4;
  }

  _distTo(x, z) {
    var dx = x - this.body.position.x;
    var dz = z - this.body.position.z;
    return Math.sqrt(dx*dx + dz*dz);
  }
}
