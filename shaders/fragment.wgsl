struct FragmentInput {
    @location(0) color: vec4<f32>,
    @location(1) worldPos: vec3<f32>,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Simple lighting enhancement - just apply a basic ambient/diffuse effect
    let lightDirection = normalize(vec3<f32>(0.5, 1.0, 0.5));

    // Create a simple lighting effect based on position
    // This gives a nice visual effect without needing complex normals
    let lightIntensity = 0.3 + 0.7 * max(dot(normalize(vec3<f32>(0.0, 1.0, 0.0)), lightDirection), 0.0);

    // Apply lighting to base color
    let litColor = input.color.rgb * lightIntensity;
    return vec4<f32>(litColor, input.color.a);
}

