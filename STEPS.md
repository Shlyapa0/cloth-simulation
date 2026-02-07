# Cloth Simulation with Position Based Dynamics and WebGPU

## Project Overview

This project implements a cloth simulation using Position Based Dynamics (PBD) method with WebGPU for GPU-accelerated computation and rendering. The cloth is represented as a square mesh divided into triangular elements with fixed corner vertices and an oscillating internal vertex creating wave propagation.

---

## 1. Project Structure

### Directory Layout

```
cloth-simulation/
├── index.html                 # Main HTML file
├── css/
│   └── style.css             # CSS styles for UI
├── js/
│   ├── main.js               # Main application entry point
│   ├── webgpu-init.js        # WebGPU initialization and setup
│   ├── cloth-simulation.js   # PBD simulation logic
│   ├── renderer.js           # WebGPU rendering pipeline
│   └── ui.js                 # User interface handling
├── shaders/
│   ├── vertex.wgsl           # Vertex shader for rendering
│   ├── fragment.wgsl         # Fragment shader for coloring
│   ├── compute-init.wgsl     # Initial positions setup
│   ├── compute-pbd-1.wgsl    # PBD: Apply external forces &预测
│   ├── compute-pbd-2.wgsl    # PBD: Solve distance constraints
│   ├── compute-pbd-3.wgsl    # PBD: Update velocities & positions
│   └── compute-sine.wgsl     # Apply sine wave movement to center vertex
└── utils/
    ├── math-utils.js         # Helper functions (if needed on CPU)
    └── config.js             # Configuration constants
```

### File Organization Principles

- Keep each file focused on a single responsibility
- Maximum one shader per `.wgsl` file
- Separate compute shaders for different PBD stages
- Clear separation between simulation, rendering, and UI logic

---

## 2. Graphics Implementation Steps

### 2.1 WebGPU Setup (webgpu-init.js)

#### Step 1: Initialize WebGPU Adapter and Device
- Request WebGPU adapter using `navigator.gpu.requestAdapter()`
- Request device from adapter with configuration options
- Handle fallback/error cases for unsupported browsers

#### Step 2: Configure Canvas and Context
- Create or obtain canvas element
- Get WebGPU context from canvas (`canvas.getContext('webgpu')`)
- Configure context with device and presentation format (`bgra8unorm` preferred)

#### Step 3: Create Bind Group Layouts
- Design bind group layouts for:
  - Uniform buffers (simulation parameters, view/projection matrices)
  - Storage buffers (vertex positions, velocities, constraint data)
  - Textures (if needed)
- Ensure layouts match between compute and render pipelines

### 2.2 Buffer Management

#### Step 4: Design Data Structures
Create buffers for:
- **Vertex position buffer** (current and predicted positions)
- **Vertex velocity buffer**
- **Vertex inverse mass buffer** (0 for pinned vertices)
- **Index buffer** for triangles (3 indices per triangle)
- **Constraint indices buffer** for distance constraints
- **Constraint rest lengths buffer**
- **Uniform buffer** (gravity state, time, simulation parameters)

#### Step 5: Create WebGPU Buffers
- Create vertex buffers with `GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`
- Create index buffers with `GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST`
- Create storage buffers for compute shaders with `GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`
- Create uniform buffers with `GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST`
- Allocate appropriate sizes based on mesh resolution

### 2.3 Compute Pipeline Setup (Cloth Simulation)

#### Step 6: Create Compute Shader Pipelines
Create separate compute pipelines for each PBD stage:

**Pipeline 1: External Forces & Prediction**
- Shader: `compute-pbd-1.wgsl`
- Workgroups: Grid aligned with vertex count
- Dispatch: `(vertexCount + workgroupSize - 1) / workgroupSize`

**Pipeline 2: Distance Constraints**
- Shader: `compute-pbd-2.wgsl`
- Workgroups: Grid aligned with constraint count
- Dispatch: `(constraintCount + workgroupSize - 1) / workgroupSize`
- May require multiple iterations per frame for stability

**Pipeline 3: Update & Integration**
- Shader: `compute-pbd-3.wgsl`
- Workgroups: Grid aligned with vertex count
- Dispatch: Same as Pipeline 1

**Pipeline 4: Sine Wave Driver**
- Shader: `compute-sine.wgsl`
- Single workgroup (operates on one vertex)

#### Step 7: Create Compute Pass Encoder
For each frame:
- Begin compute pass
- Set bind groups (0: uniforms, 1: position buffers, etc.)
- Dispatch each pipeline in correct order
- End compute pass

### 2.4 Render Pipeline Setup

#### Step 8: Define Vertex Shader (vertex.wgsl)
- Input: Position buffer, optional normal buffer
- Output: Clip-space position, interpolated data for fragment shader
- Transform: Model-view-projection matrix application
- Pass vertex color or material data to fragment shader

#### Step 9: Define Fragment Shader (fragment.wgsl)
- Input: Interpolated data from vertex shader
- Output: Color for each fragment
- Implement simple coloring based on:
  - Wireframe mode (edges only)
  - Solid mode with lighting (if calculating normals)
  - Wave height visualization (color gradient based on Y position)

#### Step 10: Create Render Pipeline
- Define vertex state (buffers, shader module)
- Define fragment state (shader module, targets)
- Set primitive topology to `line-list` for wireframe or `triangle-list` for solid
- Configure depth-stencil state if using depth testing
- Create render pipeline with configured states

### 2.5 Rendering Loop

#### Step 11: Frame Rendering Sequence
- Acquire next texture from swap chain
- Create command encoder
- **Compute Pass:**
  - Pass 1: Apply forces (gravity) if enabled
  - Pass 2: Predict positions
  - Pass N: Solve constraints (multiple iterations)
  - Pass N+1: Update velocities and positions
  - Pass N+2: Apply sine wave to central vertex
- **Render Pass:**
  - Set render pass descriptor
  - Set pipeline and bind groups
  - Set vertex and index buffers
  - Draw indexed triangles or lines
- Submit command encoder
- Present texture

#### Step 12: Camera and View Setup
- Define camera position, target, and up vector
- Create view matrix (look-at)
- Create projection matrix (perspective)
- Combine to view-projection matrix
- Upload to uniform buffer each frame (or only when camera changes)

---

## 3. User Interface Implementation Steps

### 3.1 HTML Structure

#### Step 13: Create HTML Layout
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <canvas id="canvas"></canvas>
    <div id="ui-container">
        <h1>Cloth Simulation (PBD + WebGPU)</h1>
        <div class="control-group">
            <input type="checkbox" id="gravity-toggle">
            <label for="gravity-toggle">Enable Gravity</label>
        </div>
        <div class="info">
            <p>Corner vertices are pinned.</p>
            <p>Center vertex oscillates creating waves.</p>
        </div>
    </div>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

### 3.2 CSS Styling

#### Step 14: Style the UI Overlay
- Position UI container as overlay on canvas (absolute positioning)
- Use semi-transparent background for better visibility
- Style checkbox and label for good usability
- Add hover effects for interactive elements
- Ensure responsive design for different screen sizes

### 3.3 JavaScript UI Handling (ui.js)

#### Step 15: UI Event Listeners
- Get DOM elements (checkbox, canvas)
- Add 'change' event listener to gravity checkbox
- Create callback function to update simulation state

#### Step 16: State Management
- Maintain gravity enabled flag in JavaScript
- Upload flag to GPU uniform buffer when changed
- Pass state to simulation module

---

## 4. Cloth Simulation Implementation Steps

### 4.1 Mesh Generation and Initialization

#### Step 17: Define Cloth Parameters
- Choose mesh resolution (e.g., 32x32 vertices = 962 vertices)
- Set cloth physical dimensions (width, height)
- Set spacing between vertices
- Define time step (dt)
- Set gravity magnitude
- Set constraint iterations (3-10 for good balance)

#### Step 18: Generate Grid Mesh
- Create 2D grid of vertices on X-Z plane
- Assign initial Y = 0 for all vertices
- Store positions in array for GPU upload
- Identify vertex indices for:
  - Four corners (for pinning - set inverse mass to 0)
  - Center vertex (for sine wave driver)

#### Step 19: Generate Triangle Indices
- For each grid cell (i, j), create two triangles:
  - Triangle 1: (i,j), (i+1,j), (i,j+1)
  - Triangle 2: (i+1,j), (i+1,j+1), (i,j+1)
- Build index array with 6 indices per cell
- Upload to GPU index buffer

#### Step 20: Generate Distance Constraints
- Create structural constraints (horizontal and vertical edges)
- For each vertex, connect to:
  - Right neighbor (horizontal constraint)
  - Below neighbor (vertical constraint)
  - Optional: diagonal constraints for shear resistance
- Store constraint index pairs (vertex index A, vertex index B)
- Calculate rest length for each constraint from initial positions
- Upload constraint data to GPU

#### Step 21: Upload Initial Data to GPU
- Write initial positions to position buffer
- Write zero velocities to velocity buffer
- Write inverse masses (1.0 for free, 0.0 for pinned) to mass buffer
- Write constraint indices and rest lengths to constraint buffers
- Write initial uniform parameters (dt=0, gravity=0, iterations)

### 4.2 Position Based Dynamics Algorithm

#### Step 22: PBD Integration Method Selection
**Recommended: XPBD (Extended Position Based Dynamics)** or **standard PBD with Verlet-like integration**

Key advantages:
- Better energy conservation
- More accurate constraint enforcement
- Good stability for cloth simulation

#### Step 23: Implement PBD Stages in Compute Shaders

**Stage 1: Apply External Forces & Predict Position** (compute-pbd-1.wgsl)
- For each vertex:
  - If gravity enabled: `velocity.y -= gravity * dt`
  - Predict position: `predictedPos = currentPos + velocity * dt`
  - Store both current and predicted positions

**Stage 2: Solve Distance Constraints** (compute-pbd-2.wgsl)
- For each distance constraint:
  - Calculate current vector between constrained vertices
  - Calculate current distance
  - Compute correction scalar: `alpha * (currentDistance - restLength) / denominator`
  - Where `denominator = invMassA + invMassB`
  - Apply position correction along constraint direction
  - Distribute correction based on inverse masses
- Repeat this stage N times per frame for solver iterations

**Stage 3: Update Velocities and Positions** (compute-pbd-3.wgsl)
- For each vertex:
  - Calculate velocity from position change: `velocity = (newPos - oldPos) / dt`
  - Apply damping: `velocity *= dampingFactor`
  - Update current position: `currentPos = newPos`
  - Optionally handle collision with ground plane

**Stage 4: Apply Sine Wave to Center** (compute-sine.wgsl)
- For the center vertex:
  - Calculate Y offset: `y = amplitude * sin(frequency * time)`
  - Override position: `position.y = y`
  - Set velocity to zero (we're explicitly moving the vertex)
  - Update time uniform for next frame

#### Step 24: Handle Pinned Vertices
- Set inverse mass = 0 for corner vertices
- In constraint solver: skip position correction if invMass = 0
- In velocity update: skip pinned vertices
- Corner vertices remain in their initial positions

#### Step 25: Handle Sine Wave Driver Vertex
- Mark center vertex as "driven" (may use separate flag)
- After constraint solving, override its position with sine wave
- Reset its velocity to maintain explicit control
- Parameters to tune:
  - Amplitude (wave height)
  - Frequency (wave speed)
  - Phase (starting point)

### 4.3 Simulation Loop Integration

#### Step 26: Main Animation Loop
- Use `requestAnimationFrame` for smooth animation
- Measure frame delta time for consistent simulation
- Fixed time step for physics (separate from frame rate if needed)
- Update time uniform each frame

#### Step 27: Synchronize Simulation and Rendering
- Use proper synchronization barriers between compute and render passes
- WebGPU handles this automatically with command encoder ordering
- Ensure position buffer is updated before rendering
- Consider double buffering if needed for read-back to CPU (not required for this project)

#### Step 28: Parameter Tuning
- Adjust constraint iterations (more = stiffer cloth, less = stretchier)
- Adjust damping factor (prevent infinite oscillation)
- Adjust gravity magnitude (realistic cloth behavior)
- Adjust sine wave parameters (visible wave propagation)
- Adjust time step (smaller = more stable, larger = faster)

### 4.4 Advanced Improvements (Optional)

#### Step 29: Bend Constraints
- Add constraints between vertices separated by one vertex
- Improves cloth resistance to bending
- Use weaker rest length enforcement

#### Step 30: Collision Detection
- Add sphere/box collision if desired
- Modify constraint solver to include collision constraints
- Push vertices outside collision objects

#### Step 31: Self-Collision
- Detect and resolve vertex-triangle intersections
- Use spatial partitioning for efficiency
- More complex, may not be needed for basic demo

---

## 5. Implementation Workflow Summary

### Development Sequence

1. **Week 1: Basic Setup**
   - Initialize project structure
   - Set up WebGPU device and context
   - Create basic HTML/CSS UI
   - Implement camera and view matrix

2. **Week 2: Graphics Pipeline**
   - Implement vertex shader
   - Implement fragment shader
   - Create render pipeline
   - Render a simple grid mesh

3. **Week 3: PBD Core**
   - Implement Stage 1 compute shader (forces + prediction)
   - Implement Stage 2 compute shader (constraints)
   - Implement Stage 3 compute shader (update)
   - Test basic constraint enforcement

4. **Week 4: Complete Simulation**
   - Implement sine wave driver
   - Add gravity toggle functionality
   - Tune simulation parameters
   - Verify wave propagation behavior

5. **Week 5: Polish and Optimize**
   - Optimize compute shader workgroup sizes
   - Add error handling and WebGPU fallback
   - Improve UI styling
   - Add informative labels and instructions

---

## 6. Key Technical Considerations

### WebGPU-Specific Notes

- **Workgroup Sizing:** Choose powers of 2 (32, 64, 128, 256, 512, 1024)
- **Memory Alignment:** Ensure proper alignment in storage buffers
- **Buffer Limits:** Check device limits for max storage buffer size
- **Timestamp Queries:** Useful for profiling if supported by device

### PBD-Specific Notes

- **Constraint Ordering:** Random or color-based ordering can improve convergence
- **Solver Iterations:** More iterations = stiffer material
- **Sub-stepping:** Multiple physics steps per render frame for stability
- **Warm Starting:** Use previous frame's corrections (advanced)

### Performance Optimization

- **Dispatch Optimization:** Minimize redundant dispatches
- **Memory Reuse:** Reuse buffers where possible
- **Async Operations:** Use async loading where applicable
- **Resolution Control:** Allow user to adjust mesh resolution

---

## 7. Expected Outcome

When complete, the simulation will show:

1. A square cloth mesh visible on canvas
2. Wireframe or solid rendering of the cloth
3. Four corner vertices pinned in place
4. Center vertex moving up and down in a sine wave pattern
5. Waves propagating outward from the center
6. Gravity toggle to enable/disable downward force
7. Smooth 60 FPS animation with real-time physics

The cloth will demonstrate:
- Elastic deformation under wave propagation
- Gravity sagging when enabled
- Wave reflection from pinned corners
- Damped oscillation over time
