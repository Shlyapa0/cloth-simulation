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
    
    // Color based on height (Y position) for visual interest
    let height = input.position.y;
    let normalizedHeight = clamp((height + 2.0) / 4.0, 0.0, 1.0);
    
    // Gradient from blue (low) to cyan to green (high)
    let lowColor = vec3<f32>(0.1, 0.3, 0.8);
    let midColor = vec3<f32>(0.2, 0.8, 0.9);
    let highColor = vec3<f32>(0.4, 0.9, 0.5);
    
    var finalColor: vec3<f32>;
    if (normalizedHeight < 0.5) {
        let t = normalizedHeight * 2.0;
        finalColor = mix(lowColor, midColor, t);
    } else {
        let t = (normalizedHeight - 0.5) * 2.0;
        finalColor = mix(midColor, highColor, t);
    }
    
    output.color = vec4<f32>(finalColor * uniforms.color.rgb, uniforms.color.a);
    
    return output;
}
