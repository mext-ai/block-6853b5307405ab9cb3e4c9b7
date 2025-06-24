import React, { useEffect, useRef, useState, useCallback } from 'react';

interface BlockProps {
  title?: string;
  description?: string;
}

interface FluidProperties {
  density: number;
  viscosity: number;
  pressure: number;
  temperature: number;
  gravity: number;
  particleCount: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  density: number;
  pressure: number;
  temperature: number;
  id: number;
}

const Block: React.FC<BlockProps> = ({ title = "2D Fluid Simulation", description = "Interactive fluid physics simulation" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, isPressed: false });
  
  const [fluidProps, setFluidProps] = useState<FluidProperties>({
    density: 1.0,
    viscosity: 0.01,
    pressure: 1.0,
    temperature: 20,
    gravity: 0.1,
    particleCount: 300
  });

  const [isRunning, setIsRunning] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // Constants for simulation
  const SMOOTHING_RADIUS = 30;
  const DAMPING = 0.99;
  const INTERACTION_RADIUS = 50;

  // Resize canvas to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size to match container
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale canvas back down using CSS
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Scale the drawing context so everything draws at the higher resolution
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Initialize particles
  const initializeParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const particles: Particle[] = [];
    const cols = Math.ceil(Math.sqrt(fluidProps.particleCount));
    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
    const spacing = Math.min(canvasWidth / cols, canvasHeight / cols) * 0.8;
    
    for (let i = 0; i < fluidProps.particleCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      particles.push({
        x: canvasWidth * 0.3 + col * spacing + Math.random() * 10,
        y: canvasHeight * 0.3 + row * spacing + Math.random() * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        density: fluidProps.density,
        pressure: 0,
        temperature: fluidProps.temperature,
        id: i
      });
    }
    
    particlesRef.current = particles;
  }, [fluidProps.particleCount, fluidProps.density, fluidProps.temperature]);

  // Calculate density and pressure for each particle
  const updateDensityAndPressure = useCallback(() => {
    const particles = particlesRef.current;
    
    particles.forEach(particle => {
      let density = 0;
      
      particles.forEach(neighbor => {
        const dx = particle.x - neighbor.x;
        const dy = particle.y - neighbor.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < SMOOTHING_RADIUS) {
          const influence = 1 - (distance / SMOOTHING_RADIUS);
          density += influence * influence;
        }
      });
      
      particle.density = Math.max(density, 0.1);
      particle.pressure = fluidProps.pressure * (particle.density - fluidProps.density);
    });
  }, [fluidProps.pressure, fluidProps.density]);

  // Apply forces to particles
  const applyForces = useCallback(() => {
    const particles = particlesRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    particles.forEach(particle => {
      let fx = 0, fy = 0;
      
      // Pressure and viscosity forces
      particles.forEach(neighbor => {
        if (particle.id === neighbor.id) return;
        
        const dx = particle.x - neighbor.x;
        const dy = particle.y - neighbor.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < SMOOTHING_RADIUS && distance > 0) {
          const influence = 1 - (distance / SMOOTHING_RADIUS);
          
          // Pressure force
          const pressureForce = (particle.pressure + neighbor.pressure) / (2 * neighbor.density);
          fx += dx / distance * pressureForce * influence;
          fy += dy / distance * pressureForce * influence;
          
          // Viscosity force
          const viscosityForce = fluidProps.viscosity * influence;
          fx += (neighbor.vx - particle.vx) * viscosityForce;
          fy += (neighbor.vy - particle.vy) * viscosityForce;
        }
      });
      
      // Gravity
      fy += fluidProps.gravity;
      
      // Mouse interaction
      if (mouseRef.current.isPressed) {
        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < INTERACTION_RADIUS) {
          const force = (INTERACTION_RADIUS - distance) / INTERACTION_RADIUS;
          fx += dx / distance * force * 0.5;
          fy += dy / distance * force * 0.5;
        }
      }
      
      // Apply forces
      particle.vx += fx;
      particle.vy += fy;
      
      // Damping
      particle.vx *= DAMPING;
      particle.vy *= DAMPING;
    });
  }, [fluidProps.gravity, fluidProps.viscosity]);

  // Update particle positions
  const updatePositions = useCallback(() => {
    const particles = particlesRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

    particles.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Boundary collisions
      if (particle.x < 5) {
        particle.x = 5;
        particle.vx *= -0.5;
      } else if (particle.x > canvasWidth - 5) {
        particle.x = canvasWidth - 5;
        particle.vx *= -0.5;
      }
      
      if (particle.y < 5) {
        particle.y = 5;
        particle.vy *= -0.5;
      } else if (particle.y > canvasHeight - 5) {
        particle.y = canvasHeight - 5;
        particle.vy *= -0.5;
      }
    });
  }, []);

  // Render the simulation
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const particles = particlesRef.current;
    
    // Draw particles
    particles.forEach(particle => {
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      const normalizedDensity = Math.min(particle.density / 2, 1);
      
      // Color based on density and speed
      const r = Math.floor(100 + normalizedDensity * 155);
      const g = Math.floor(50 + speed * 50);
      const b = Math.floor(200 + particle.temperature);
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3 + normalizedDensity * 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw mouse interaction area
    if (mouseRef.current.isPressed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouseRef.current.x, mouseRef.current.y, INTERACTION_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    if (!isRunning) return;
    
    updateDensityAndPressure();
    applyForces();
    updatePositions();
    render();
    
    animationRef.current = requestAnimationFrame(animate);
  }, [isRunning, updateDensityAndPressure, applyForces, updatePositions, render]);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    mouseRef.current = {
      x: pos.x,
      y: pos.y,
      isPressed: true
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    mouseRef.current.x = pos.x;
    mouseRef.current.y = pos.y;
  };

  const handleMouseUp = () => {
    mouseRef.current.isPressed = false;
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
      // Reinitialize particles with new canvas size
      setTimeout(() => {
        initializeParticles();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas, initializeParticles]);

  // Initialize canvas size and particles
  useEffect(() => {
    resizeCanvas();
    initializeParticles();
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [resizeCanvas, initializeParticles, animate]);

  // Restart simulation when properties change
  useEffect(() => {
    initializeParticles();
  }, [fluidProps, initializeParticles]);

  // Send completion event
  useEffect(() => {
    const timer = setTimeout(() => {
      window.postMessage({ type: 'BLOCK_COMPLETION', blockId: 'fluid-simulation', completed: true }, '*');
      window.parent.postMessage({ type: 'BLOCK_COMPLETION', blockId: 'fluid-simulation', completed: true }, '*');
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      display: 'flex',
      fontFamily: 'Arial, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Controls Panel */}
      {showControls && (
        <div style={{
          width: '280px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          overflowY: 'auto',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          flexShrink: 0
        }}>
          <h3 style={{ margin: '0 0 20px 0' }}>Fluid Properties</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Density: {fluidProps.density.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={fluidProps.density}
              onChange={(e) => setFluidProps(prev => ({ ...prev, density: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Viscosity: {fluidProps.viscosity.toFixed(3)}
            </label>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={fluidProps.viscosity}
              onChange={(e) => setFluidProps(prev => ({ ...prev, viscosity: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Pressure: {fluidProps.pressure.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={fluidProps.pressure}
              onChange={(e) => setFluidProps(prev => ({ ...prev, pressure: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Gravity: {fluidProps.gravity.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1.0"
              step="0.01"
              value={fluidProps.gravity}
              onChange={(e) => setFluidProps(prev => ({ ...prev, gravity: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Temperature: {fluidProps.temperature}°C
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={fluidProps.temperature}
              onChange={(e) => setFluidProps(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Particles: {fluidProps.particleCount}
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={fluidProps.particleCount}
              onChange={(e) => setFluidProps(prev => ({ ...prev, particleCount: parseInt(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: isRunning ? '#ff4444' : '#44ff44',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            {isRunning ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => setShowControls(false)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#4444ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Hide Controls
          </button>

          <button
            onClick={initializeParticles}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Reset Simulation
          </button>

          <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '20px' }}>
            <p><strong>Instructions:</strong></p>
            <p>• Click and drag to attract particles</p>
            <p>• Adjust properties to see different behaviors</p>
            <p>• Colors represent density and velocity</p>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          position: 'relative',
          minWidth: 0,
          minHeight: 0
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            background: '#000',
            display: 'block'
          }}
        />
        
        {/* Show Controls Button when controls are hidden */}
        {!showControls && (
          <button
            onClick={() => setShowControls(true)}
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              padding: '10px 16px',
              backgroundColor: 'rgba(68, 68, 255, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backdropFilter: 'blur(5px)'
            }}
          >
            Show Controls
          </button>
        )}
        
        {/* Pause/Play Button when controls are hidden */}
        {!showControls && (
          <button
            onClick={() => setIsRunning(!isRunning)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '10px 16px',
              backgroundColor: isRunning ? 'rgba(255, 68, 68, 0.8)' : 'rgba(68, 255, 68, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backdropFilter: 'blur(5px)'
            }}
          >
            {isRunning ? 'Pause' : 'Play'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Block;