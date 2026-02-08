// Apply sine wave to center vertex
@group(0) @binding(0) var<uniform> uniforms : vec4f;
@group(0) @binding(1) var<storage, read_write> positions : array<vec3f>;
@group(0) @binding(2) var<storage, read_write> velocities : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> inverseMasses : array<f32>;

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) globalID : vec3u) {
    // For simplicity, we'll hardcode the center vertex index
    // In a real implementation, this would be passed through uniforms
    let centerVertexIndex = 512; // Example center vertex index
    
    // Skip if center vertex is pinned
    if (inverseMasses[centerVertexIndex] == 0.0) {
        return;
    }
    
    // Apply sine wave motion
    let time = uniforms.w; // Use time from uniforms
    let amplitude = 0.5;
    let frequency = 5.0;
    
    let yOffset = amplitude * sin(frequency * time);
    
    // Update position
    positions[centerVertexIndex].y = yOffset;
    
    // Reset velocity
    velocities[centerVertexIndex] = vec4f(0.0, 0.0, 0.0, 0.0);
}