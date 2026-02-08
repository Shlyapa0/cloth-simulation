struct Uniforms {
    viewProjection: mat4x4<f32>,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) worldPos: vec3<f32>,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Transform position to clip space
    output.clipPosition = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
    output.worldPos = input.position;
    
    // Simple color assignment (we could add lighting later if needed)
    output.color = vec4<f32>(uniforms.color.rgb, uniforms.color.a);
    
    return output;
}