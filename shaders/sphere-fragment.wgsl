struct FragmentInput {
    @location(0) color: vec4<f32>,
    @location(1) worldPos: vec3<f32>,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Simple fragment shader - just return the vertex color
    return input.color;
}