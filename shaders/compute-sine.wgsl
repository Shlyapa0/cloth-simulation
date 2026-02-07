struct SineWaveParams {
    time: f32,
    amplitude: f32,
    frequency: f32,
    centerVertexIndex: u32,
};

@group(0) @binding(0) var<uniform> params: SineWaveParams;
@group(0) @binding(1) var<storage, read_write> positions: array<vec3<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec3<f32>>;
@group(0) @binding(3) var<storage, read> inverseMasses: array<f32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = params.centerVertexIndex;
    
    // Calculate sine wave position
    let y = params.amplitude * sin(params.frequency * params.time);
    
    // Update position (keep X and Z, only change Y)
    positions[index].y = y;
    
    // Reset velocity for driven vertex
    velocities[index] = vec3<f32>(0.0, 0.0, 0.0);
}
