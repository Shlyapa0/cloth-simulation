struct SimulationParams {
    dt: f32,
    damping: f32,
    padding1: f32,
    padding2: f32,
};

@group(0) @binding(0) var<uniform> params: SimulationParams;
@group(0) @binding(1) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read> predictedPositions: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read_write> velocities: array<vec3<f32>>;
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
        return;
    }
    
    let oldPos = positions[index];
    let newPos = predictedPositions[index];
    
    // Update velocity: v = (p_new - p_old) / dt
    var velocity = (newPos - oldPos) / params.dt;
    
    // Apply damping
    velocity = velocity * params.damping;
    
    // Update velocity buffer
    velocities[index] = velocity;
    
    // Update position
    positions[index] = newPos;
}
