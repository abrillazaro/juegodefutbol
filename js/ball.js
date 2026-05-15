'use strict';

class Ball {
  constructor(scene, world) {
    this.scene  = scene;
    this.world  = world;
    this.radius = 0.22;
    this.mesh   = null;
    this.body   = null;
  }

  create() {
    // Procedural football texture
    var cvs = document.createElement('canvas');
    cvs.width = cvs.height = 256;
    var ctx = cvs.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111111';
    var patches = [[128,128],[128,58],[190,100],[190,158],[128,198],[66,158],[66,100]];
    patches.forEach(function(patch) {
      var px = patch[0], py = patch[1];
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var a = (i * Math.PI * 2 / 5) - Math.PI / 2;
        var x = px + 22 * Math.cos(a);
        var y = py + 22 * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    });

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 20, 20),
      new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(cvs), shininess: 60 })
    );
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);

    // Ground shadow blob
    this._shadow = new THREE.Mesh(
      new THREE.CircleGeometry(this.radius * 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    this._shadow.rotation.x = -Math.PI / 2;
    this._shadow.position.y = 0.005;
    this.scene.add(this._shadow);

    // Physics body
    this.body = new CANNON.Body({ mass: 0.43, linearDamping: 0.25, angularDamping: 0.35 });
    this.body.addShape(new CANNON.Sphere(this.radius));
    this.world.addBody(this.body);
  }

  reset(x, z) {
    x = x || 0; z = z || 0;
    this.body.position.set(x, this.radius + 0.05, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.wakeUp();
  }

  shoot(dir, power) {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.applyImpulse(
      new CANNON.Vec3(dir.x * power, power * 0.38, dir.z * power),
      new CANNON.Vec3(0, 0, 0)
    );
    this.body.wakeUp();
  }

  getPosition() { return this.body.position; }
  getVelocity() { return this.body.velocity; }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    var h  = this.body.position.y - this.radius;
    var sc = Math.max(0.2, 1 - h * 0.15);
    this._shadow.position.set(this.body.position.x, 0.005, this.body.position.z);
    this._shadow.scale.setScalar(sc);
    this._shadow.material.opacity = Math.max(0.05, 0.35 * sc);

    // Bounce off sidelines
    if (Math.abs(this.body.position.x) > 34) {
      this.body.velocity.x *= -0.6;
      this.body.position.x  = Math.sign(this.body.position.x) * 34;
    }
    if (this.body.position.y < -5) this.reset(0, 0);
  }
}
