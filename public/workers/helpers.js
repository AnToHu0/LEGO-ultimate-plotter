defaultControls = [
  { label: 'Inverted', type: 'checkbox' },
  { label: 'Brightness', value: 0, min: -100, max: 100 },
  { label: 'Contrast', value: 0, min: -100, max: 100 },
  { label: 'Min brightness', value: 0, min: 0, max: 255 },
  { label: 'Max brightness', value: 255, min: 0, max: 255 },
]


// Apply brightness / contrast and flatten to monochrome
// taken from squigglecam

function pixelProcessor(config, imagePixels) {
  console.log(config, imagePixels)
  const width = parseInt(config.width) || 0;
  const contrast = parseInt(config.Contrast) || 0;
  const brightness = parseInt(config.Brightness) || 0;
  const minBrightness = parseInt(config['Min brightness']) || 0;
  const maxBrightness = parseInt(config['Max brightness']) || 255;
  const black = config.Inverted;

  // Защита от деления на ноль
  let contrastFactor = 1;
  if (contrast !== 259) {
    contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    // Проверка на валидность contrastFactor
    if (isNaN(contrastFactor) || !isFinite(contrastFactor)) {
      contrastFactor = 1;
    }
  }

  return function (x, y) {
    try {
      let b;
      let pixIndex = Math.floor(x) + Math.floor(y) * width;

      // Проверка на валидность индекса
      if (pixIndex < 0 || pixIndex >= imagePixels.data.length / 4) {
        return 0;
      }

      if (contrast !== 0) {
        b = (0.2125 * ((contrastFactor * (imagePixels.data[4 * pixIndex] - 128) + 128) + brightness))
          + (0.7154 * ((contrastFactor * (imagePixels.data[4 * pixIndex + 1] - 128) + 128) + brightness))
          + (0.0721 * ((contrastFactor * (imagePixels.data[4 * pixIndex + 2] - 128) + 128) + brightness));
      } else {
        b = (0.2125 * (imagePixels.data[4 * pixIndex] + brightness))
          + (0.7154 * (imagePixels.data[4 * pixIndex + 1] + brightness))
          + (0.0721 * (imagePixels.data[4 * pixIndex + 2] + brightness));
      }

      // Проверка на NaN
      if (isNaN(b)) {
        return 0;
      }

      if (black) {
        b = Math.min(255 - minBrightness, 255 - b);
      } else {
        b = Math.max(minBrightness, b);
      }

      const result = Math.max(maxBrightness - b, 0);

      // Финальная проверка на NaN
      return isNaN(result) ? 0 : result;
    } catch (error) {
      console.error('Error in pixel processing:', error);
      return 0;
    }
  }
}



// autocontrast, my implementation
function autocontrast(pixData, cutoff) {

  function luma(x, y) {
    let i = 4 * (x + width * y)
    return pixData.data[i] * 0.299 + pixData.data[i + 1] * 0.587 + pixData.data[i + 2] * 0.114 // ITU-R 601-2
    //    return pixData.data[i]*0.2125 + pixData.data[i+1]*0.7154 + pixData.data[i+2]*0.0721 // ITU-R 709
  }

  let hist = []
  for (let i = 0; i < 256; i++) hist[i] = 0;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let b = Math.round(luma(x, y))
      hist[b]++
    }
  }
  let total = 0, low = 0, high = 255
  for (let i = 0; i < 256; i++) {
    total += hist[i];
  }
  cutoff *= total;

  for (let i = 0; i < 255; i++) {
    low += hist[i]
    if (low > cutoff) { low = i; break }
  }
  for (let i = 255; i > 1; i--) {
    high += hist[i]
    if (high >= cutoff) { high = i; break }
  }

  let scale = (255 / (high - low)) || 1

  const pixelCache = []
  for (let x = 0; x < width; x++) {
    pixelCache[x] = []
    for (let y = 0; y < height; y++) {
      pixelCache[x][y] = Math.min(255, Math.max(0, (luma(x, y) - low) * scale))
    }
  }
  return (x, y) => {
    return (x >= 0 && y >= 0 && x < width && y < height)
      ? pixelCache[x][y]
      : 0
  }
}




// perlin noise
// ported from lingdong's linedraw.py

(function () {
  var PERLIN_YWRAPB = 4
  var PERLIN_YWRAP = 1 << PERLIN_YWRAPB
  var PERLIN_ZWRAPB = 8
  var PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB
  var PERLIN_SIZE = 4095

  var perlin_octaves = 4
  var perlin_amp_falloff = 0.5

  function scaled_cosine(i) {
    return 0.5 * (1.0 - Math.cos(i * Math.PI))
  }

  var perlin = null

  perlinNoise = function (x, y = 0, z = 0) {
    if (perlin == null) {
      perlin = []
      for (let i = 0; i < PERLIN_SIZE + 1; i++) {
        perlin.push(Math.random())
      }
    }
    if (x < 0) x = -x
    if (y < 0) y = -y
    if (z < 0) z = -z

    let [xi, yi, zi] = [~~x, ~~y, ~~z]
    let xf = x - xi
    let yf = y - yi
    let zf = z - zi
    let rxf, ryf

    let r = 0
    let ampl = 0.5

    let n1, n2, n3

    for (let o = 0; o < perlin_octaves; o++) {
      let of = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB)

      rxf = scaled_cosine(xf)
      ryf = scaled_cosine(yf)

      n1 = perlin[of & PERLIN_SIZE]
      n1 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n1)
      n2 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE]
      n2 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2)
      n1 += ryf * (n2 - n1)

      of += PERLIN_ZWRAP
      n2 = perlin[of & PERLIN_SIZE]
      n2 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n2)
      n3 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE]
      n3 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3)
      n2 += ryf * (n3 - n2)

      n1 += scaled_cosine(zf) * (n2 - n1)

      r += n1 * ampl
      ampl *= perlin_amp_falloff
      xi <<= 1
      xf *= 2
      yi <<= 1
      yf *= 2
      zi <<= 1
      zf *= 2

      if (xf >= 1.0) {
        xi += 1
        xf -= 1
      }
      if (yf >= 1.0) {
        yi += 1
        yf -= 1
      }
      if (zf >= 1.0) {
        zi += 1
        zf -= 1
      }
    }
    return r
  }
})();


// Nearest-neighbour TSP solution, good enough for simple plotting
function sortlines(clines) {
  // Проверка на пустые данные
  if (!clines || !clines.length) {
    return clines;
  }

  // Проверка, что массив содержит хотя бы один непустой подмассив
  let hasValidLines = false;
  for (let i = 0; i < clines.length; i++) {
    if (clines[i] && clines[i].length) {
      hasValidLines = true;
      break;
    }
  }

  if (!hasValidLines) {
    return clines;
  }

  // Копируем массив, чтобы не изменять оригинал
  let lines = [...clines];

  // Находим непустой массив для начала
  let startIdx = 0;
  while (startIdx < lines.length && (!lines[startIdx] || !lines[startIdx].length)) {
    startIdx++;
  }

  if (startIdx >= lines.length) {
    return clines; // Не нашли непустых массивов
  }

  let slines = [lines.splice(startIdx, 1)[0]];
  let last = slines[0][slines[0].length - 1];

  function distance(a, b) {
    return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]);
  }

  while (lines.length) {
    let closest, min = 1e9, backwards = false;
    for (let j in lines) {
      if (!lines[j] || !lines[j].length) continue; // Пропускаем пустые массивы

      let d1 = distance(lines[j][0], last);
      let d2 = distance(lines[j][lines[j].length - 1], last);
      if (d1 < min) {
        min = d1;
        closest = j;
        backwards = false;
      }
      if (d2 < min) {
        min = d2;
        closest = j;
        backwards = true;
      }
    }

    // Если не нашли ближайшую линию (все оставшиеся пустые)
    if (closest === undefined) {
      break;
    }

    let l = lines.splice(closest, 1)[0];
    if (backwards) {
      l.reverse();
    }
    slines = slines.concat([l]);
    last = l[l.length - 1];
  }

  // Добавляем оставшиеся пустые массивы, если такие есть
  slines = slines.concat(lines);

  return slines;
}


// slowly draw the points list - useful for debugging
function animatePointList(output, speed) {
  let out = [], i = 0, j = 0;
  speed = speed || 1;
  (function f() {
    for (let q = 0; q < speed; q++) {
      if (!out[i]) out[i] = []
      out[i][j] = output[i][j]
      if (++j >= output[i].length) j = 0, i++
    }
    postLines(out)
    if (i < output.length) setTimeout(f, 20)
  })();
}


function postLines(data) {
  // Проверка на пустые данные
  if (!data?.[0]?.[0]) {
    postMessage(['svg-path', { path: "", raw: [] }]);
    return;
  }

  let pathstring = "";
  // either a list of points, or a list of lists of points
  if (typeof data[0][0] !== "object") data = [data]

  // Дополнительная проверка после преобразования формата
  if (!data[0] || !data[0].length) {
    postMessage(['svg-path', { path: "", raw: [] }]);
    return;
  }

  if (data[0][0].x) {
    for (let p in data) {
      if (!data[p] || !data[p].length) continue;
      pathstring += ' M' + data[p][0].x.toFixed(2) + ',' + data[p][0].y.toFixed(2);
      for (let i = 1; i < data[p].length; i++) pathstring += 'L' + data[p][i].x.toFixed(2) + ',' + data[p][i].y.toFixed(2);
    }
  } else {
    for (let p in data) {
      if (!data[p] || !data[p].length) continue;
      pathstring += ' M' + data[p][0][0].toFixed(2) + ',' + data[p][0][1].toFixed(2);
      for (let i = 1; i < data[p].length; i++) pathstring += 'L' + data[p][i][0].toFixed(2) + ',' + data[p][i][1].toFixed(2);
    }
  }
  postMessage(['svg-path', { path: pathstring, raw: data }])
}

// function postCircles(data) {
//   let pathstring = ""
//   if (data[0].x) {
//     for (let p in data) {
//       let { x, y, r } = data[p];
//       if (r < 0.001) r = 0.001;
//       pathstring += 'M' + x.toFixed(2) + ',' + (y - r).toFixed(2) + ' a ' + r.toFixed(3) + ' ' + r.toFixed(3) + ' 0 1 0 0.001 0Z ';
//     }
//   } else {
//     for (let p in data) {
//       let [x, y, r] = data[p];
//       if (r < 0.001) r = 0.001;
//       pathstring += 'M' + x.toFixed(2) + ',' + (y - r).toFixed(2) + ' a ' + r.toFixed(3) + ' ' + r.toFixed(3) + ' 0 1 0 0.001 0Z ';
//     }
//   }
//   postMessage(['svg-path', pathstring])
// }

// Функция для проверки корректности данных в imageData
function validateImageData(imageData, expectedWidth, expectedHeight) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalPixels: 0,
      nanValues: 0,
      undefinedValues: 0,
      nullValues: 0,
      outOfRangeValues: 0,
      min: 255,
      max: 0,
      average: 0
    }
  };

  // Проверяем наличие объекта и его свойств
  if (!imageData) {
    result.isValid = false;
    result.errors.push('imageData отсутствует (null или undefined)');
    return result;
  }

  if (!imageData.data || !imageData.width || !imageData.height) {
    result.isValid = false;
    result.errors.push('imageData не содержит необходимых свойств (data, width, height)');
    return result;
  }

  // Проверяем соответствие размеров
  if (expectedWidth && imageData.width !== expectedWidth) {
    result.warnings.push(`Ширина (${imageData.width}) не соответствует ожидаемой (${expectedWidth})`);
  }

  if (expectedHeight && imageData.height !== expectedHeight) {
    result.warnings.push(`Высота (${imageData.height}) не соответствует ожидаемой (${expectedHeight})`);
  }

  // Проверяем длину массива данных
  const expectedLength = imageData.width * imageData.height * 4;
  if (imageData.data.length !== expectedLength) {
    result.isValid = false;
    result.errors.push(`Длина массива данных (${imageData.data.length}) не соответствует ожидаемой (${expectedLength})`);
  }

  // Проверяем корректность значений
  let sum = 0;

  for (let i = 0; i < imageData.data.length; i++) {
    const value = imageData.data[i];

    // Считаем только значения для яркости (R, G, B), пропускаем alpha
    if (i % 4 < 3) {
      result.stats.totalPixels++;

      if (value === undefined) {
        result.stats.undefinedValues++;
        result.isValid = false;
      } else if (value === null) {
        result.stats.nullValues++;
        result.isValid = false;
      } else if (isNaN(value)) {
        result.stats.nanValues++;
        result.isValid = false;
      } else if (value < 0 || value > 255) {
        result.stats.outOfRangeValues++;
        result.isValid = false;
      } else {
        // Обновляем статистику для валидных значений
        sum += value;
        if (value < result.stats.min) result.stats.min = value;
        if (value > result.stats.max) result.stats.max = value;
      }
    }
  }

  // Вычисляем среднее значение
  if (result.stats.totalPixels > 0) {
    result.stats.average = sum / result.stats.totalPixels;
  }

  // Добавляем ошибки, если нашли некорректные значения
  if (result.stats.nanValues > 0) {
    result.errors.push(`Найдено ${result.stats.nanValues} значений NaN`);
  }

  if (result.stats.undefinedValues > 0) {
    result.errors.push(`Найдено ${result.stats.undefinedValues} значений undefined`);
  }

  if (result.stats.nullValues > 0) {
    result.errors.push(`Найдено ${result.stats.nullValues} значений null`);
  }

  if (result.stats.outOfRangeValues > 0) {
    result.errors.push(`Найдено ${result.stats.outOfRangeValues} значений вне диапазона [0, 255]`);
  }

  return result;
}

// Применяем эту функцию к данным с камеры перед обработкой
function sanitizeImageData(imageData) {
  if (!imageData || !imageData.data) {
    console.error('Получены некорректные данные изображения');
    return null;
  }

  // Клонируем imageData, чтобы не изменять оригинал
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    console.error('Не удалось создать контекст холста');
    return null;
  }

  ctx.putImageData(imageData, 0, 0);
  const sanitizedData = ctx.getImageData(0, 0, imageData.width, imageData.height);

  // Заменяем некорректные значения
  for (let i = 0; i < sanitizedData.data.length; i++) {
    if (sanitizedData.data[i] === null ||
      sanitizedData.data[i] === undefined ||
      isNaN(sanitizedData.data[i]) ||
      sanitizedData.data[i] < 0 ||
      sanitizedData.data[i] > 255) {
      // Для R, G, B используем 0, для альфа-канала - 255
      sanitizedData.data[i] = (i % 4 === 3) ? 255 : 0;
    }
  }

  return sanitizedData;
}

