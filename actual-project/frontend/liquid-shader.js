(() => {
  const canvas = document.querySelector("#liquid-canvas");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) {
    canvas.hidden = true;
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    varying vec2 v_uv;

    float ripple(vec2 point, vec2 centre, float radius, float softness) {
      float distanceFromCentre = distance(point, centre);
      return 1.0 - smoothstep(radius - softness, radius + softness, distanceFromCentre);
    }

    void main() {
      vec2 point = v_uv;
      float aspect = u_resolution.x / max(u_resolution.y, 1.0);
      point.x *= aspect;
      vec2 pointer = u_pointer;
      pointer.x *= aspect;
      float waveA = sin(point.x * 4.2 + u_time * 1.2 + sin(point.y * 3.0)) * 0.035;
      float waveB = cos(point.y * 5.1 - u_time * 0.9 + cos(point.x * 2.4)) * 0.035;
      point += vec2(waveA, waveB);

      float tide = ripple(point, vec2(aspect * 0.16, 0.20), 0.30, 0.20);
      tide += ripple(point, vec2(aspect * 0.82, 0.68), 0.34, 0.18) * 0.9;
      tide += ripple(point, pointer, 0.22, 0.18) * 0.35;

      vec3 deepSea = vec3(0.02, 0.20, 0.25);
      vec3 clearWater = vec3(0.18, 0.64, 0.62);
      vec3 warmLight = vec3(0.96, 0.63, 0.33);
      vec3 colour = mix(deepSea, clearWater, clamp(tide, 0.0, 1.0));
      colour = mix(colour, warmLight, clamp(tide * 0.18, 0.0, 0.14));
      float edgeFade = smoothstep(0.04, 0.30, point.y) * (1.0 - smoothstep(0.76, 1.0, point.y));
      gl_FragColor = vec4(colour, 0.18 * edgeFade);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    canvas.hidden = true;
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.hidden = true;
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "a_position");
  const time = gl.getUniformLocation(program, "u_time");
  const resolution = gl.getUniformLocation(program, "u_resolution");
  const pointer = gl.getUniformLocation(program, "u_pointer");
  const pointerPosition = { x: 0.58, y: 0.45 };
  let frame = 0;
  let paused = document.hidden;

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(window.innerWidth * pixelRatio));
    const height = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  };

  const draw = (now) => {
    if (paused) return;
    resize();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(time, reducedMotion.matches ? 0 : now * 0.00035);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform2f(pointer, pointerPosition.x * (canvas.width / canvas.height), 1 - pointerPosition.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
  };

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", (event) => {
    pointerPosition.x = event.clientX / Math.max(window.innerWidth, 1);
    pointerPosition.y = event.clientY / Math.max(window.innerHeight, 1);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (!paused && !reducedMotion.matches) {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(draw);
    }
  });
  reducedMotion.addEventListener?.("change", () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(draw);
  });
  resize();
  frame = window.requestAnimationFrame(draw);
})();
