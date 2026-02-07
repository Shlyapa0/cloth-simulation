# Cloth Simulation with PBD and WebGPU

A real-time cloth physics simulation using **Position Based Dynamics (PBD)** with **WebGPU** for GPU-accelerated computation and rendering.

## Features

- 🧵 **32x32 vertex cloth mesh** representing a square fabric
- 📌 **Pinned corners** - The four corner vertices are fixed in place
- 🌊 **Sine wave driver** - Center vertex oscillates to create wave propagation
- 🌍 **Gravity toggle** - Enable/disable gravitational force
- 🎨 **Wireframe/Solid rendering modes**
- 📊 **Real-time FPS counter**
- 🖱️ **Camera controls** - Drag to rotate the view
- ⚡ **GPU-accelerated** - All physics computed on the GPU using WebGPU

## Technology Stack

- **WebGPU** - Modern GPU API for parallel computation and rendering
- **WGSL** - WebGPU Shading Language for compute and graphics shaders
- **Position Based Dynamics (PBD)** - Physics simulation method for cloth constraints
- **JavaScript (ES6 Modules)** - Modern JavaScript with module imports

## Project Structure

```
cloth-simulation/
├── index.html                 # Main HTML file
├── css/
│   └── style.css             # UI styling
├── js/
│   ├── main.js               # Application entry point
│   ├── webgpu-init.js        # WebGPU initialization utilities
│   ├── cloth-simulation.js   # PBD physics simulation
│   ├── renderer.js           # WebGPU rendering pipeline
│   └── ui.js                 # User interface handling
├── shaders/
│   ├── vertex.wgsl           # Vertex shader
│   ├── fragment.wgsl         # Fragment shader
│   ├── compute-init.wgsl     # Initialize cloth positions
│   ├── compute-pbd-1.wgsl    # External forces & prediction
│   ├── compute-pbd-2.wgsl    # Distance constraint solving
│   ├── compute-pbd-3.wgsl    # Velocity & position update
│   └── compute-sine.wgsl     # Sine wave driver
├── utils/
│   ├── config.js             # Simulation configuration
│   └── math-utils.js         # Matrix and vector math utilities
└── README.md                 # This file
```

## Browser Requirements

This project uses **WebGPU**, which requires a modern browser:

- ✅ **Chrome 113+** (Desktop)
- ✅ **Edge 113+** (Desktop)
- ✅ **Firefox Nightly** (with `dom.webgpu.enabled` flag enabled)
- ❌ Safari (WebGPU support coming in future versions)

## Getting Started

### Option 1: Using Python (Recommended)

1. Open a terminal in the project directory
2. Run:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to: `http://localhost:8000`

### Option 2: Using Node.js

1. Install http-server (if not already installed):
   ```bash
   npm install -g http-server
   ```
2. Run:
   ```bash
   http-server -p 8000
   ```
3. Open your browser and navigate to: `http://localhost:8000`

### Option 3: Using VS Code Live Server

1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Controls

- **Gravity Toggle**: Enable/disable gravitational pull on the cloth
- **Render Mode**: Switch between wireframe and solid rendering
- **Mouse Drag**: Rotate the camera view
- **Touch Drag**: Rotate camera on mobile devices

## How It Works

### Position Based Dynamics (PBD)

The simulation uses a three-stage PBD algorithm:

1. **External Forces & Prediction**: Apply gravity and predict vertex positions
   ```
   v_new = v_old + F * dt
   p* = p_old + v_new * dt
   ```

2. **Constraint Solving**: Iteratively satisfy distance constraints
   ```
   λ = (|p* - p'| - rest_length) / (inv_mass_a + inv_mass_b)
   p_new = p* ± λ * direction * inv_mass
   ```

3. **Update & Integration**: Update velocities and finalize positions
   ```
   v = (p_new - p_old) / dt
   v = v * damping
   ```

### Sine Wave Driver

The center vertex is explicitly animated using a sine wave:
```
y = amplitude * sin(frequency * time)
```
This creates waves that propagate outward through the cloth mesh.

## Configuration

You can adjust simulation parameters in `utils/config.js`:

```javascript
{
    cloth: {
        width: 10.0,           // Physical width
        height: 10.0,          // Physical height
        resolutionX: 32,       // Vertices in X direction
        resolutionY: 32,       // Vertices in Y direction
    },
    simulation: {
        dt: 0.016,            // Time step
        gravity: 9.81,         // Gravity acceleration
        damping: 0.99,         // Velocity damping
        constraintIterations: 5, // Solver iterations
    },
    wave: {
        amplitude: 1.5,        // Wave height
        frequency: 3.0,        // Wave speed
    },
}
```

## Performance

- Target FPS: 60
- Vertex count: 1,024 (32×32)
- Triangle count: 1,918
- Constraint count: 1,984
- Physics iterations: 5 per frame

On modern hardware, the simulation should run smoothly at 60 FPS.

## Troubleshooting

### "WebGPU Not Supported" Error

If you see this error:
1. Update your browser to the latest version
2. For Firefox Nightly, enable WebGPU in `about:config`
3. Ensure your GPU drivers are up to date
4. Try Chrome or Edge if using another browser

### Performance Issues

If the simulation runs slowly:
1. Reduce `resolutionX` and `resolutionY` in `config.js`
2. Reduce `constraintIterations` (makes cloth softer)
3. Close other browser tabs/windows

## Future Improvements

- [ ] Add bending constraints for more realistic cloth
- [ ] Implement collision detection with objects
- [ ] Add self-collision detection
- [ ] Support for wind forces
- [ ] Cloth tearing functionality
- [ ] Adjustable cloth parameters in UI

## License

This project is provided as-is for educational purposes.

## References

- [Position Based Dynamics - Müller et al.](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Language Specification](https://www.w3.org/TR/WGSL/)


