struct FragmentInput {
    @location(0) normal : vec3f,
};

@fragment
fn fragment_main(input : FragmentInput) -> @location(0) vec4f {
    let normal = normalize(input.normal);
    let lightDirection = normalize(vec3f(0.5, 1.0, 0.7));
    let diffuse = max(dot(normal, lightDirection), 0.0);
    
    let baseColor = vec3f(0.2, 0.6, 1.0);
    let shadedColor = baseColor * (0.3 + diffuse * 0.7);
    
    return vec4f(shadedColor, 1.0);
}