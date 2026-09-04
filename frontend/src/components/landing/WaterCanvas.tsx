import { useEffect, useRef } from "react";

/**
 * Masked water-flow shader. Renders ONLY inside white regions of water-mask.png
 * (transparent everywhere else via discard), composited over the existing hero
 * <img> with normal alpha blending — so anything outside the mask is provably
 * untouched, not just visually similar.
 */

const VERTEX_SRC = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAGMENT_SRC = `
  precision mediump float;
  uniform vec2 uResolution;
  uniform vec2 uImageRes;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform sampler2D uHero;
  uniform sampler2D uMask;

  // object-fit: cover, object-position: 68% 40%
  vec2 coverUV(vec2 fragCoord) {
    float scale = max(uResolution.x / uImageRes.x, uResolution.y / uImageRes.y);
    vec2 displaySize = uImageRes * scale;
    vec2 offset = (displaySize - uResolution) * vec2(0.68, 0.40);
    vec2 imgPixel = fragCoord + offset;
    return imgPixel / displaySize;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 fragCoord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    vec2 uv = coverUV(fragCoord);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

    float maskVal = texture2D(uMask, uv).r;
    if (maskVal < 0.06) discard;

    // Region flow hierarchy along the reservoir -> dam/spillway -> river axis.
    float band1 = smoothstep(0.30, 0.42, uv.y);
    float band2 = smoothstep(0.42, 0.58, uv.y);
    float speed = mix(0.15, 0.45, band1);
    speed = mix(speed, 0.30, band2);

    vec2 flowDir = vec2(0.12, 1.0);
    vec2 noiseCoord = uv * vec2(8.0, 14.0) - flowDir * uTime * speed * 1.4;
    float n = fbm(noiseCoord);
    float n2 = fbm(noiseCoord * 1.9 + 3.7);
    vec2 displacement = (vec2(n2, n) - 0.5) * 0.018;
    displacement += uMouse * 0.004;

    vec2 sampleUV = clamp(uv + displacement, 0.0, 1.0);
    vec3 warped = texture2D(uHero, sampleUV).rgb;

    float shimmer = fbm(noiseCoord * 3.0 + uTime * 0.3 * speed);
    shimmer = smoothstep(0.6, 0.95, shimmer);

    vec3 color = warped + shimmer * 0.14;
    float strength = mix(0.10, 0.25, clamp(speed / 0.45, 0.0, 1.0)) * maskVal;

    gl_FragColor = vec4(color, strength);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

export default function WaterCanvas({ mouse }: { mouse: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef(mouse);

  useEffect(() => {
    mouseRef.current = mouse;
  }, [mouse]);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    const program = createProgram(gl);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uImageRes = gl.getUniformLocation(program, "uImageRes");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uHero = gl.getUniformLocation(program, "uHero");
    const uMask = gl.getUniformLocation(program, "uMask");

    function makeTexture(img: HTMLImageElement) {
      const tex = gl!.createTexture();
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      return tex;
    }

    let heroTex: WebGLTexture | null = null;
    let maskTex: WebGLTexture | null = null;
    let loaded = 0;
    let destroyed = false;
    let raf = 0;
    let paused = document.hidden;
    const startTime = performance.now();

    const heroImg = new Image();
    const maskImg = new Image();
    heroImg.src = "/images/hero-flood-dam.png";
    maskImg.src = "/images/water-mask.png";

    const onLoaded = () => {
      loaded++;
      if (loaded === 2 && !destroyed) start();
    };
    heroImg.onload = onLoaded;
    maskImg.onload = onLoaded;

    function resize() {
      const isMobile = window.innerWidth < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 2);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }

    function onVisibility() {
      paused = document.hidden;
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    function start() {
      heroTex = makeTexture(heroImg);
      maskTex = makeTexture(maskImg);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.useProgram(program);
      gl!.uniform1i(uHero, 0);
      gl!.uniform1i(uMask, 1);
      resize();
      loop();
    }

    function loop() {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (paused) return;
      resize();

      const t = (performance.now() - startTime) / 1000;
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform2f(uResolution, canvas!.width, canvas!.height);
      gl!.uniform2f(uImageRes, heroImg.naturalWidth, heroImg.naturalHeight);
      gl!.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl!.uniform1f(uTime, t);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, heroTex);
      gl!.activeTexture(gl!.TEXTURE1);
      gl!.bindTexture(gl!.TEXTURE_2D, maskTex);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
