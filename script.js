
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries)=>{
entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{ threshold:0.15 });
revealEls.forEach(el=>io.observe(el));

/* ---------- Copy letter ---------- */
document.getElementById('copyBtn').addEventListener('click', ()=>{
const text = document.getElementById('letterText').innerText.trim();
navigator.clipboard.writeText(text).then(()=>{
  const btn = document.getElementById('copyBtn');
  const original = btn.textContent;
  btn.textContent = 'Copié ✓';
  setTimeout(()=>btn.textContent = original, 1600);
});
});

/* ---------- WebGL hero shader: chandeliers boursiers / trajectoire ascendante ---------- */
(function(){
const canvas = document.getElementById('shader-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if(!gl || reduceMotion){
  canvas.style.display='none';
  document.getElementById('hero-fallback').style.display='block';
  return;
}

const vsSource = `
  attribute vec2 aPos;
  void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fsSource = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;

  float hash(float n){ return fract(sin(n)*43758.5453); }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes.xy;
    vec2 p = uv;
    p.x *= uRes.x / uRes.y;

    vec3 bgDeep = vec3(0.039, 0.051, 0.066);
    vec3 bg     = vec3(0.059, 0.078, 0.102);
    vec3 mint   = vec3(0.290, 0.871, 0.580);
    vec3 gold   = vec3(0.890, 0.663, 0.298);

    float g = uv.y + 0.06*sin(uv.x*3.0 + uTime*0.05);
    vec3 col = mix(bgDeep, bg, clamp(g,0.0,1.0));

    // faint ledger-paper grid
    vec2 grid = fract(p*vec2(16.0, 10.0) - vec2(uTime*0.015, 0.0));
    float gridLine = smoothstep(0.0,0.02,grid.x)*smoothstep(1.0,0.98,grid.x)
                    + smoothstep(0.0,0.02,grid.y)*smoothstep(1.0,0.98,grid.y);
    col += mint * (1.0-gridLine) * 0.035;

    // scrolling candlestick chart
    float period = 0.11;
    float worldX = p.x*8.0 - uTime*0.22;
    float idx = floor(worldX/period);
    float frac = fract(worldX/period);

    float openC  = hash(idx*1.13 + 4.0);
    float closeC = hash(idx*1.13 + 9.0);
    float wick   = max(hash(idx*1.13+2.0), max(openC,closeC));
    float wickLo = min(hash(idx*1.13+7.0), min(openC,closeC));

    float bullish = step(openC, closeC);
    vec3 candleColor = mix(gold, mint, bullish);

    float top = max(openC, closeC);
    float bot = min(openC, closeC);
    float baseline = 0.40;
    float amp = 0.30;
    float yTop = baseline + top*amp;
    float yBot = baseline + bot*amp;
    float yWickTop = baseline + wick*amp;
    float yWickBot = baseline + wickLo*amp;

    float bodyHalf = 0.16;
    float bodyMask = 1.0 - smoothstep(bodyHalf-0.01, bodyHalf+0.01, abs(frac-0.5));
    float inBody = step(yBot, uv.y) * step(uv.y, max(yTop, yBot+0.008)) * bodyMask;

    float wickHalf = 0.035;
    float wickMask = 1.0 - smoothstep(wickHalf-0.005, wickHalf+0.005, abs(frac-0.5));
    float inWick = step(yWickBot, uv.y) * step(uv.y, yWickTop) * wickMask;

    col += candleColor * inBody * 0.85;
    col += candleColor * inWick * 0.5;

    // traveling "quote" dot along the most recent candle
    float liveIdx = floor((8.0*1.0 - uTime*0.22)/period);
    float pulse = 0.55 + 0.45*sin(uTime*3.0);
    float dotX = 0.92;
    float dotY = baseline + hash(floor(-uTime*0.22/period)*1.13+9.0)*amp;
    float dDot = length(vec2(p.x-dotX, uv.y-dotY));
    col += mint * smoothstep(0.02,0.0,dDot) * pulse * 0.9;

    // vignette
    float vig = smoothstep(1.1, 0.25, length((uv-0.5)*vec2(1.3,1.0)));
    col *= mix(0.72, 1.05, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.warn(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const vs = compile(gl.VERTEX_SHADER, vsSource);
const fs = compile(gl.FRAGMENT_SHADER, fsSource);
if(!vs || !fs){
  canvas.style.display='none';
  document.getElementById('hero-fallback').style.display='block';
  return;
}

const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
gl.useProgram(prog);

const quad = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, 'uRes');
const uTime = gl.getUniformLocation(prog, 'uTime');

function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.floor(w*dpr);
  canvas.height = Math.floor(h*dpr);
  gl.viewport(0,0,canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

const start = performance.now();
function frame(now){
  const t = (now-start)/1000;
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform1f(uTime, t);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
