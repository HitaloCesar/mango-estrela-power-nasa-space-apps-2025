document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  // Tabela de densidades (kg/m^3)
  const DENSITY_TABLE = {
    'ferro': 7800,
    'gelo': 900,
    'rocha_densa': 3200,
    'rocha_porosa': 2200
  };
  // Inverte a tabela para buscar material pelo density
  const DENSITY_TO_MATERIAL = Object.fromEntries(Object.entries(DENSITY_TABLE).map(([k,v])=>[v,k]));

  // Carregar dados do meteoro atual do localStorage (ou valores padrão)
  const defaultMeteor = {
    diameter: 10000, // metros (10 km)
    velocity: 17,
    angle: 45,
    density: 7800,
    material: 'ferro'
  };
  let meteorConfig = { ...defaultMeteor };
  try {
    const saved = JSON.parse(localStorage.getItem('meteorConfig'));
    if (saved && typeof saved === 'object') meteorConfig = { ...defaultMeteor, ...saved };
  } catch {}

  const sizeRange   = $('sizeRange');
  const sizeValue   = $('sizeValue');
  const speedRange  = $('speedRange');
  const speedValue  = $('speedValue');
  const angleRange  = $('angleRange');
  const angleValue  = $('angleValue');
  const materialSel = $('material');
  const meteorImg   = document.querySelector('.meteor-img');

  // Seleciona o material (prioriza o salvo; senão infere pela densidade)
  let initialMaterial = (meteorConfig.material && DENSITY_TABLE[meteorConfig.material])
    ? meteorConfig.material
    : (DENSITY_TO_MATERIAL[meteorConfig.density] || 'ferro');

  // Inicializa UI com valores atuais (convertendo metros para km)
  if (sizeRange)   sizeRange.value   = (meteorConfig.diameter / 1000);
  if (sizeValue)   sizeValue.textContent = (meteorConfig.diameter / 1000).toFixed(2);
  if (speedRange)  speedRange.value  = meteorConfig.velocity;
  if (speedValue)  speedValue.textContent = meteorConfig.velocity;
  if (angleRange)  angleRange.value  = meteorConfig.angle;
  if (angleValue)  angleValue.textContent = angleValue + '°';
  if (materialSel) materialSel.value = initialMaterial;

  // Atualiza textos dos outros sliders
  const updateTexts = () => {
    if (speedRange && speedValue) speedValue.textContent = speedRange.value;
    if (angleRange && angleValue) angleValue.textContent = angleRange.value + '°';
  };

  // Escala proporcional simples: largura em px = km * (larguraBase / kmBaseInicial)
  let pxPerKm = 40; // fallback
  function calibrate() {
    if (!meteorImg || !sizeRange) return;
    const baseKm = parseFloat(sizeRange.defaultValue || sizeRange.getAttribute('value') || '10');
    const natural = meteorImg.naturalWidth || meteorImg.getBoundingClientRect().width || 400;
    pxPerKm = natural / baseKm;
    updateMeteorSize(); // aplica tamanho inicial
  }

  function updateMeteorSize() {
    if (!meteorImg || !sizeRange) return;
    const km = parseFloat(sizeRange.value);
    if (sizeValue) sizeValue.textContent = km.toFixed(2);
    // tamanho baseado na proporção calibrada
    let w = km * pxPerKm / 7;

    // Evita “sumir” em valores muito pequenos (ex.: 0.1 km)
    const MIN_VISIBLE_PX = 40;        // ajuste se quiser maior/menor
    if (w < MIN_VISIBLE_PX) w = MIN_VISIBLE_PX;
    meteorImg.style.width = w.toFixed(2) + 'px';
  }

  if (meteorImg) {
    if (meteorImg.complete) calibrate();
    else meteorImg.addEventListener('load', calibrate);
  }

  if (sizeRange) {
    sizeRange.addEventListener('input', () => {
      updateMeteorSize();
    });
  }

  if (speedRange) speedRange.addEventListener('input', updateTexts);
  if (angleRange) angleRange.addEventListener('input', updateTexts);
  if (materialSel) materialSel.addEventListener('change', updateTexts);

  updateTexts();

  // Salvar configurações ao clicar em 'Done'
  const simulateBtn = $('simulateBtn');
  if (simulateBtn) simulateBtn.onclick = () => {
    const diameter = parseFloat(sizeRange.value) * 1000;
    const velocity = parseFloat(speedRange.value);
    const angle = parseFloat(angleRange.value);
    const selectedMaterial = materialSel.value;
    const density = Number(DENSITY_TABLE[selectedMaterial]) || DENSITY_TABLE['ferro'];
    if (isNaN(diameter) || isNaN(velocity) || isNaN(angle) || isNaN(density)) {
      alert('Erro: Parâmetros inválidos.');
      return;
    }
    const config = { diameter, velocity, angle, density, material: selectedMaterial };
    localStorage.setItem('meteorConfig', JSON.stringify(config));
    window.location.href = 'index.html';
  };

  // Voltar sem salvar
  const backBtn = $('backBtn');
  if (backBtn) backBtn.onclick = () => location.href = 'index.html';

  // === SCALE BAR (ajuste dinâmico ao zoom) ===
  // MODO:
  //  'proportional'  -> cresce mais conforme o zoom (fica evidente que mudou)
  //  'constant'      -> mantém tamanho visual constante (corrige o efeito do zoom)
  //  'inverse'       -> encolhe quando dá zoom (raro, mas disponível)
  const SCALEBAR_MODE = 'proportional';

  (function initScaleBarZoom(){
    const bar = document.querySelector('.scale-bar-vertical');
    if(!bar) return;

    const BASE_DPR = window.devicePixelRatio || 1;

    function factorFor(dpr){
      switch (SCALEBAR_MODE){
        case 'constant':     return BASE_DPR / dpr;          // anula zoom
        case 'inverse':      return (BASE_DPR / dpr) * 0.75; // encolhe um pouco
        case 'proportional':
        default:             return dpr / BASE_DPR;          // amplia além do zoom
      }
    }

    function apply(){
      const dpr = window.devicePixelRatio || 1;
      const f = factorFor(dpr);
      bar.style.transformOrigin = 'top right';
      bar.style.transform = `scale(${f})`;
    }

    // Reaplica em resize / mudança de zoom (resize normalmente dispara)
    window.addEventListener('resize', apply);
    // Alguns navegadores disparam este media query em mudança de escala
    if (window.matchMedia){
      try {
        window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', apply);
      } catch(_) {}
    }
    apply();
  })();

  // === UI: Seta de impacto do meteoro ===
  function createImpactAngleArrowUI() {
    let angleInput = document.getElementById('angleInput') || document.getElementById('angleRange');
    if (!angleInput) return;
    let container = document.createElement('div');
    container.id = 'impact-angle-arrow-ui';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.gap = '4px';
    container.style.marginTop = '8px';
    // SVG: solo maior + linha azul maior
    container.innerHTML = `
      <svg id="impact-angle-arrow-svg" width="120" height="80" viewBox="0 0 120 80" style="overflow:visible;">
        <!-- Solo maior -->
        <rect x="15" y="65" width="90" height="12" rx="4" fill="#bbb" />
        <!-- Linha do ângulo maior -->
        <g id="impact-angle-group">
          <line id="impact-angle-line" x1="60" y1="65" x2="110" y2="65" stroke="#8b5cf6" stroke-width="8" />
        </g>
      </svg>
    `;
    angleInput.parentNode.insertBefore(container, angleInput.nextSibling);
  }

  function updateImpactAngleArrowUI(angle) {
    // 0° = linha paralela ao solo, 90° = linha vertical para baixo
    // Calcula ponto final da linha com trigonometria
    const svg = document.getElementById('impact-angle-arrow-svg');
    const line = svg?.querySelector('#impact-angle-line');
    if (line) {
      const length = 50; // comprimento maior da linha
      const rad = (Math.PI / 180) * angle;
      // Origem: (60,65) - solo
      // x2 = x1 + length * cos(PI + rad)
      // y2 = y1 + length * sin(PI + rad)
      const x1 = 60, y1 = 65;
      const x2 = x1 + length * Math.cos(Math.PI + rad);
      const y2 = y1 + length * Math.sin(Math.PI + rad);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
    }
  }
  // Inicializa UI ao carregar
  createImpactAngleArrowUI();
  let angleInput = document.getElementById('angleInput') || document.getElementById('angleRange');
  if (angleInput) {
    updateImpactAngleArrowUI(Number(angleInput.value)); // inicializa rotação
    angleInput.addEventListener('input', function(e) {
      updateImpactAngleArrowUI(Number(e.target.value));
    });
  }
});