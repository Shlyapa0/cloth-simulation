struct SimulationParams {
    dt: f32,
    gravity: f32,
    gravityEnabled: f32,
    padding: f32,
};

@group(0) @binding(0) var<uniform> params: SimulationParams;
@group(0) @binding(1) var<storage, read> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> predictedPositions: array<vec3<f32>>;
@group(0) @binding(4) var<storage, read> inverseMasses: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let arraySize = arrayLength(&positions);
    
    if (index >= arraySize) {
        return;
    }
    
    let invMass = inverseMasses[index];
    
    // Skip pinned vertices
    if (invMass == 0.0) {
        predictedPositions[index] = positions[index];
        return;
    }
    
    var velocity = velocities[index];
    
    // Apply gravity if enabled
    if (params.gravityEnabled > 0.5) {
        velocity.y -= params.gravity * params.dt;
    }
    
    // Store updated velocity
    velocities[index] = velocity;
    
    // Predict position: p* = p + v * dt
    let predictedPos = positions[index] + velocity * params.dt;
    predictedPositions[index] = predictedPos;
}
