export function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();

  const colors = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
  const particles: Array<{
    x: number;
    y: number;
    size: number;
    color: string;
    speedX: number;
    speedY: number;
    rotation: number;
    rotationSpeed: number;
  }> = [];

  // Create particles
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height - 20, // start above screen
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: Math.random() * 3 - 1.5,
      speedY: Math.random() * 4 + 4,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 4 - 2,
    });
  }

  let animationFrameId: number;
  const start = Date.now();

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let active = false;
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height) {
        active = true;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (active && Date.now() - start < 4500) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      cleanup();
    }
  };

  const cleanup = () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', resize);
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  };

  animate();
}
