// Вершинный шейдер - теперь переворачиваем текстурные координаты
const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0, 1);
    // Переворачиваем Y координату текстуры
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  }
`;

// Фрагментный шейдер - выполняет CMYK преобразование
const fragmentShaderSource = `
  precision mediump float;
  uniform sampler2D u_image;
  varying vec2 v_texCoord;
  uniform int u_channel; // 0=C, 1=M, 2=Y, 3=K

  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    float r = color.r;
    float g = color.g;
    float b = color.b;

    float k = min(1.0 - r, min(1.0 - g, 1.0 - b));
    float c = k == 1.0 ? 0.0 : (1.0 - r - k) / (1.0 - k);
    float m = k == 1.0 ? 0.0 : (1.0 - g - k) / (1.0 - k);
    float y = k == 1.0 ? 0.0 : (1.0 - b - k) / (1.0 - k);

    float value = 0.0;
    if (u_channel == 0) value = c;
    else if (u_channel == 1) value = m;
    else if (u_channel == 2) value = y;
    else value = k;

    // Инвертируем значение для отображения
    gl_FragColor = vec4(1.0 - value, 1.0 - value, 1.0 - value, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Failed to compile shader: ' + error);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Failed to link program: ' + error);
  }

  return program;
}

export function setupWebGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL not supported');

  // Создаем шейдеры
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vertexShader, fragmentShader);

  // Получаем местоположение атрибутов
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

  // Создаем буферы
  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();

  // Устанавливаем геометрию
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,
    1.0, -1.0,
    -1.0, 1.0,
    1.0, 1.0,
  ]), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0,
  ]), gl.STATIC_DRAW);

  return {
    gl,
    program,
    locations: {
      position: positionLocation,
      texCoord: texCoordLocation,
      channel: gl.getUniformLocation(program, 'u_channel'),
    },
    buffers: {
      position: positionBuffer,
      texCoord: texCoordBuffer,
    }
  };
}

interface WebGLLocations {
  position: number;
  texCoord: number;
  channel: WebGLUniformLocation | null;
}

interface WebGLBuffers {
  position: WebGLBuffer | null;
  texCoord: WebGLBuffer | null;
}

export function processImageWithWebGL(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  locations: WebGLLocations,
  buffers: WebGLBuffers,
  sourceCanvas: HTMLCanvasElement,
  channel: number
) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  // Устанавливаем геометрию
  gl.enableVertexAttribArray(locations.position);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(locations.texCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoord);
  gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);

  // Создаем и настраиваем текстуру
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);

  // Устанавливаем канал
  gl.uniform1i(locations.channel, channel);

  // Отрисовываем
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
