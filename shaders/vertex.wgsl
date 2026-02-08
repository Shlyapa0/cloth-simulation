struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) normal : vec3f,
};

@vertex
fn vertex_main(@location(0) position : vec3f, @location(1) normal : vec3f) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4f(position, 1.0);
    output.normal = normal;
    return output;
}