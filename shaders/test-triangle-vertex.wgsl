struct Uniforms {
    rotation: mat4x4<f32>,
    aspect: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    let rotatedPosition = uniforms.rotation * vec4<f32>(input.position, 1.0);
    
    let fov = 3.14159 / 4.0;
    let aspect = uniforms.aspect;
    let near = 0.1;
    let far = 100.0;
    
    let f = 1.0 / tan(fov / 2.0);
    
    var projection = mat4x4<f32>(
        vec4<f32>(f / aspect, 0.0, 0.0, 0.0),
        vec4<f32>(0.0, f, 0.0, 0.0),
        vec4<f32>(0.0, 0.0, (far + near) / (near - far), -1.0),
        vec4<f32>(0.0, 0.0, (2.0 * far * near) / (near - far), 0.0)
    );
    
    let viewPosition = vec4<f32>(rotatedPosition.x, rotatedPosition.y, rotatedPosition.z + 3.0, 1.0);
    output.clipPosition = projection * viewPosition;
    output.color = input.color;
    
    return output;
}
