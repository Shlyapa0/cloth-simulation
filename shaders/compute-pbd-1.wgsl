// PBD Stage 1: Apply external forces & prediction
@group(0) @binding(0) var<uniform> uniforms : vec4f;
@group(0) @binding(1) var<storage, read_write> positions : array<vec3f>;
@group(0) @binding(2) var<storage, read_write> velocities : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> inverseMasses : array<f32>;

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalID : vec3u) {
    let index = globalID.x;
    
    let dt = uniforms.x;
    let gravity = uniforms.y;
    let damping = uniforms.z;
    
    // Skip if vertex is pinned
    if (inverseMasses[index] == 0.0) {
        return;
    }
    
    // Apply gravity
    velocities[index].y -= gravity * dt;
    
    // Predict position
    let predictedPos = positions[index] + velocities[index].xyz * dt;
    positions[index] = predictedPos;
}