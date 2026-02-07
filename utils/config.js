// Cloth Simulation Configuration
export const config = {
    // Cloth mesh parameters
    cloth: {
        width: 10.0,           // Physical width
        height: 10.0,          // Physical height
        resolutionX: 32,       // Number of vertices in X direction
        resolutionY: 32,       // Number of vertices in Y direction
    },
    
    // Simulation parameters
    simulation: {
        dt: 0.016,             // Time step (approximately 60 FPS)
        gravity: 9.81,         // Gravity acceleration (m/s²)
        gravityEnabled: false, // Gravity toggle state
        damping: 0.99,         // Velocity damping factor
        constraintIterations: 5, // Number of constraint solver iterations
    },
    
    // Sine wave driver parameters
    wave: {
        amplitude: 1.5,        // Wave height
        frequency: 3.0,        // Wave speed factor
        phase: 0.0,           // Phase offset
    },
    
    // WebGPU compute parameters
    compute: {
        workgroupSize: 256,    // Workgroup size for compute shaders
    },
    
    // Camera parameters
    camera: {
        position: { x: 0, y: 8, z: 12 },
        target: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        fov: 45,               // Field of view in degrees
        near: 0.1,
        far: 100,
    },
    
    // Rendering parameters
    rendering: {
        wireframe: true,       // Wireframe render mode
        backgroundColor: { r: 0.1, g: 0.1, b: 0.12, a: 1.0 },
        wireframeColor: { r: 0.3, g: 0.8, b: 1.0, a: 1.0 },
    },
};

// Derived values
export function getDeriveConfig() {
    const resolutionX = config.cloth.resolutionX;
    const resolutionY = config.cloth.resolutionY;
    
    return {
        vertexCount: resolutionX * resolutionY,
        triangleCount: (resolutionX - 1) * (resolutionY - 1) * 2,
        spacingX: config.cloth.width / (resolutionX - 1),
        spacingY: config.cloth.height / (resolutionY - 1),
        centerIndex: Math.floor(resolutionX / 2) + Math.floor(resolutionY / 2) * resolutionX,
    };
}
