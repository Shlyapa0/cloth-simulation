struct VertexOutput {
    @builtin(position) position : vec4f,
};

@vertex
fn vertex_main(@location(0) position : vec3f) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4f(position, 1.0);
    return output;
}