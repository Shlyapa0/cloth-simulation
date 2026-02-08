// Initialize cloth simulation data
@group(0) @binding(0) var<uniform> uniforms : vec4f;
@group(0) @binding(1) var<storage, read_write> positions : array<vec3f>;
@group(0) @binding(2) var<storage, read_write> velocities : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> inverseMasses : array<f32>;

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) globalID : vec3u) {
    let index = globalID.x;
    
    // Initialize positions to zero
    positions[index] = vec3f(0.0, 0.0, 0.0);
    
    // Initialize velocities to zero
    velocities[index] = vec4f(0.0, 0.0, 0.0, 0.0);
}