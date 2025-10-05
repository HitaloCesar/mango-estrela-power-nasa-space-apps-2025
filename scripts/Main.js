// ===================================================================================
// API KEYS (use environment variables in production)
// Use static config for static site
// Load config.js
// Make sure to include <script src="scripts/config.js"></script> before this file in index.html
const MAPBOX_TOKEN = KEYS.MAPBOX_KEY;
const GEMINI_API_KEY = KEYS.GEMINI_KEY;
// ===================================================================================

mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    // Start with a distant, global view centered on Brazil
    center: [-53, -14], // roughly central Brazil
    zoom: 0,            // farthest zoomed-out view supported by Mapbox
    pitch: 0,
    bearing: 0,
    projection: 'globe'
});

document.getElementById('editMeteorBtn').onclick = () => window.location.href = 'config.html';

document.getElementById('sandwichMenuBtn').onclick = () => {
    document.getElementById('impactMenu').classList.toggle('open');
};

const aiSummaryDiv = document.getElementById('aiSummary');

// ===================== IMPACT AREA CONFIGURATION =====================
const IMPACT_METEOR_DIAMETER_M = 1000;
const IMPACT_METEOR_VELOCITY_KMS = 20;
const IMPACT_ANGLE_DEG = 45;
const IMPACT_METEOR_DENSITY = 3000; // Meteor density (kg/m^3)
// =====================================================================

// ===================== PHYSICAL CONSTANTS ============================
const GRAVITY = 9.81;
const TARGET_DENSITY = 2750;
// =====================================================================

function calculateImpact(diameter, velocity, angle, meteorDensity = 3000) {
    const r = diameter / 2;
    const massKg = (4 / 3) * Math.PI * Math.pow(r, 3) * meteorDensity;
    const velocityMps = velocity * 1000;
    const angleRad = angle * Math.PI / 180;
    const craterDiameter = 1.161 * Math.pow(meteorDensity / TARGET_DENSITY, 1/3) * Math.pow(diameter, 0.78) * Math.pow(velocityMps, 0.44) * Math.pow(GRAVITY, -0.22) * Math.pow(Math.sin(angleRad), 1/3);
    const devastationRadius = craterDiameter / 2;
    const energyMegatons = (0.5 * massKg * velocityMps ** 2) / 4.184e15;
    return {
        energyMegatons,
        devastationRadiusMeters: devastationRadius,
        devastationRadiusKm: devastationRadius / 1000,
        massTonnes: massKg / 1000
    };
}

let impactRadius = 0;
let impactEnergy = 0;
let impactCounter = 0;

function getAxesRatio(angle) { return 0.4 + 0.6 * (angle / 90); }
function getImpactCenterOffset(angle) { return -Math.cos(angle * Math.PI / 180); }

function updateImpactMenu() {
    const radiusElem = document.getElementById('impactRadius');
    const energyElem = document.getElementById('impactEnergy');
    if (impactRadius > 0 && impactEnergy > 0) {
        radiusElem.textContent = impactRadius.toFixed(2) + ' km';
        energyElem.textContent = impactEnergy.toFixed(2) + ' megatons';
        radiusElem.className = 'impact-value-large';
        energyElem.className = 'impact-value-large';
    } else {
        radiusElem.textContent = 'Will appear after an impact is generated';
        energyElem.textContent = 'Will appear after an impact is generated';
        radiusElem.className = 'impact-value-small';
        energyElem.className = 'impact-value-small';
    }
}

updateImpactMenu();

function removeAllImpactRings() {
    for (let i = 1; i <= impactCounter; i++) {
        for (let j = 0; j < 5; j++) {
            const fillId = `impact-ellipse-fill-${i}-${j}`;
            const borderId = `impact-ellipse-border-${i}-${j}`;
            if (map.getLayer(fillId)) map.removeLayer(fillId);
            if (map.getLayer(borderId)) map.removeLayer(borderId);
            const sourceId = `impact-source-${i}-ellipse-${j}`;
            if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
    }
}

function createEllipticalImpactArea(center, radius, diameter, angle, offset, axesRatio) {
    impactCounter++;
    const steps = 5;
    const radii = [0.2, 0.4, 0.6, 0.8, 1.0];
    const colors = ['rgba(255,255,255,0.35)', 'rgba(255,87,34,0.25)', 'rgba(255,152,0,0.18)', 'rgba(255,193,7,0.13)', 'rgba(255,255,255,0.10)'];
    const borderColors = ['rgba(255,255,255,0.7)', 'rgba(255,87,34,0.7)', 'rgba(255,152,0,0.7)', 'rgba(255,193,7,0.7)', 'rgba(255,255,255,0.3)'];
    const angleRad = angle * Math.PI / 180;
    for (let i = 0; i < steps; i++) {
        const a = radius * radii[i];
        const b = radius * axesRatio * radii[i];
        const points = 90;
        const coords = [];
        for (let j = 0; j < points; j++) {
            const theta = (j / points) * 2 * Math.PI;
            let x = a * Math.cos(theta) + offset * a;
            let y = b * Math.sin(theta);
            const xr = x * Math.cos(angleRad) - y * Math.sin(angleRad);
            const yr = x * Math.sin(angleRad) + y * Math.cos(angleRad);
            const dLng = xr / (111320 * Math.cos(center[1] * Math.PI / 180));
            const dLat = yr / 110540;
            coords.push([center[0] + dLng, center[1] + dLat]);
        }
        coords.push(coords[0]);
        const sourceId = `impact-source-${impactCounter}-ellipse-${i}`;
        map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } } });
        map.addLayer({ id: `impact-ellipse-fill-${impactCounter}-${i}`, type: 'fill', source: sourceId, paint: { 'fill-color': colors[i], 'fill-opacity': 1 } });
        map.addLayer({ id: `impact-ellipse-border-${impactCounter}-${i}`, type: 'line', source: sourceId, paint: { 'line-color': borderColors[i], 'line-width': 3 } });
    }
}

async function reverseGeocode(coords) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?access_token=${MAPBOX_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) return data.features[0].place_name;
        return 'a remote area of the ocean';
    } catch (e) {
        console.error('Reverse Geocoding Error:', e);
        return null;
    }
}

async function callGenerativeAI(meteor, location) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const materialMap = {
        'ferro': 'iron',
        'gelo': 'ice',
        'rocha_densa': 'dense rock',
        'rocha_porosa': 'porous rock'
    };
    const materialLabel = materialMap[meteor.material] || meteor.material || 'rock';
    const prompt = `You are an elite disaster analyst and strategist, combining physics with real-world geographical, demographic, and economic data for the Global Impact Response Directorate. Your task is to generate a priority-one flash report.\n        A meteor with the following characteristics has just struck the planet:\n        - Impact Location: ${location}\n        - Composition: ${materialLabel} (density ${Number(meteor.density).toLocaleString()} kg/m^3)\n        - Diameter: ${meteor.diameter.toLocaleString()} meters\n        - Mass: ${meteor.mass.toLocaleString()} tons\n        - Entry Velocity: ${meteor.velocity.toLocaleString()} km/s\n        - Impact Angle: ${meteor.angle} degrees\n\n        Write a single, flowing paragraph. The total length must be under 180 words.\n        Maintain an extremely serious and data-driven tone. This report is for immediate strategic decision-making.\n\n        Your analysis must follow this strict sequence:\n        1.  State the impact location and characterize the event: Start with "'${location}' has been struck..." and briefly mention the impactor's nature (e.g., a high-velocity, dense iron body).\n        2.  Quantify the immediate human cost: Leveraging your knowledge of '${location}'s population density (e.g., dense metropolis, rural area, shipping lane), provide a specific numerical estimate for immediate fatalities within the primary devastation zone.\n        3.  Detail the localized economic collapse: Identify one or two primary economic pillars '${location}' is known for (e.g., a specific industry like technology or agriculture, a major port, a financial hub, a critical university center). Describe their instantaneous and catastrophic obliteration.\n        4.  Describe the physical transformation of the local geography: Detail the immediate environmental ruin. Mention the scale of the resulting crater and how it has irrevocably altered a specific local feature (e.g., vaporized a river, flattened a downtown district, created a new bay).\n        5.  Conclude with a brief, forward-looking global consequence: In a single, concise phrase, mention the most probable large-scale secondary threat, such as atmospheric ejecta causing short-term cooling, or a specific disruption to global trade originating from the loss of this location.\n\n        Do not use bolding or lists. Respond ONLY with the text of the report itself.`;
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) return data.candidates[0].content.parts[0].text;
        return 'The AI could not generate a report for this impact.';
    } catch (e) {
        console.error('Error calling Gemini API:', e);
        return 'The AI analysis could not be completed due to a communication error.';
    }
}

function getMeteorConfig() {
    const defaultConfig = {
        diameter: 10000,
        velocity: 20,
        angle: 45,
        density: 3000,
        material: 'rocha_densa'
    };
    try {
        const saved = JSON.parse(localStorage.getItem('meteorConfig'));
        if (saved && typeof saved === 'object') {
            const diameter = Number(saved.diameter);
            const velocity = Number(saved.velocity);
            const angle = Number(saved.angle);
            const density = Number(saved.density);
            const material = typeof saved.material === 'string' ? saved.material : undefined;
            if ([diameter, velocity, angle, density].every(v => typeof v === 'number' && !isNaN(v) && v > 0)) {
                const inferredMaterial = material || (density >= 7000 ? 'ferro' : density <= 1000 ? 'gelo' : density >= 3000 ? 'rocha_densa' : 'rocha_porosa');
                return { diameter, velocity, angle, density, material: inferredMaterial };
            }
        }
    } catch {}
    return defaultConfig;
}

map.on('click', async (e) => {
    removeAllImpactRings();
    const METEOR_CONFIG = getMeteorConfig();
    const currentImpact = calculateImpact(
        METEOR_CONFIG.diameter,
        METEOR_CONFIG.velocity,
        METEOR_CONFIG.angle,
        METEOR_CONFIG.density
    );
    impactRadius = currentImpact.devastationRadiusKm;
    impactEnergy = currentImpact.energyMegatons;
    updateImpactMenu();
    createEllipticalImpactArea(
        [e.lngLat.lng, e.lngLat.lat],
        currentImpact.devastationRadiusMeters,
        METEOR_CONFIG.diameter,
        METEOR_CONFIG.angle,
        getImpactCenterOffset(METEOR_CONFIG.angle),
        getAxesRatio(METEOR_CONFIG.angle)
    );
    aiSummaryDiv.innerHTML = '<span class="ai-status-small">Analyzing impact location...</span> <span class="ai-watermark">AI generated</span>';
    const locationName = await reverseGeocode(e.lngLat);
    if (!locationName) {
        aiSummaryDiv.innerHTML = '<span class="ai-status-small">Could not identify the location.</span> <span class="ai-watermark">AI generated</span>';
        return;
    }
    aiSummaryDiv.innerHTML = `<span class=\"ai-status-small\">Generating impact report for <strong>${locationName}</strong>...</span> <span class=\"ai-watermark\">AI generated</span>`;
    const narrative = await callGenerativeAI({
        diameter: METEOR_CONFIG.diameter,
        mass: currentImpact.massTonnes,
        velocity: METEOR_CONFIG.velocity,
        angle: METEOR_CONFIG.angle,
        density: METEOR_CONFIG.density,
        material: METEOR_CONFIG.material
    }, locationName);
    aiSummaryDiv.innerHTML = `<span class=\"ai-status-large\">${narrative}</span> <span class=\"ai-watermark-large\">AI generated</span>`;
});
