#!/usr/bin/env node
// Genera avatares SVG estilo caricatura extrema (Sebastian Krüger)
// Añadido Marc: 14 años, pelirrojo, rizoso, hincha del Man City.

const API_BASE = "https://porra.manriquegarcia.com";
const GROUP_ID = "birreros";

function svgToDataUrl(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

function buildAvatar(w, h, opts) {
  const { isF1, name, skinColor, skinShadow, faceShape, hairColor, eyeColor, 
          hasGlasses, glassesColor, beardType, beardColor, suitColor1, suitColor2, 
          number, isKid, noseType, smileType } = opts;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg-${name}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${isF1 ? '#1a1a2e' : '#0d3320'}"/>
        <stop offset="100%" stop-color="${isF1 ? '#16213e' : '#1a4a2e'}"/>
      </linearGradient>
      <radialGradient id="faceGrad-${name}" cx="50%" cy="40%" r="60%">
        <stop offset="60%" stop-color="${skinColor}"/>
        <stop offset="100%" stop-color="${skinShadow}"/>
      </radialGradient>
      <filter id="shadow">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.4"/>
      </filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg-${name})" rx="12"/>`;

  // Cuerpo minúsculo (caricatura)
  const bodyY = isKid ? h * 0.7 : h * 0.65;
  const bodyW = isKid ? w * 0.5 : w * 0.6;
  const neckY = bodyY - 10;
  
  // Cuello
  svg += `<rect x="${w/2 - 12}" y="${neckY}" width="24" height="20" fill="${skinShadow}"/>`;

  // Ropa
  if (isF1) {
    // Mono de piloto inflado
    svg += `<path d="M${w/2 - bodyW/2} ${h} Q${w/2 - bodyW/2 - 10} ${bodyY} ${w/2 - 15} ${bodyY} L${w/2 + 15} ${bodyY} Q${w/2 + bodyW/2 + 10} ${bodyY} ${w/2 + bodyW/2} ${h} Z" fill="${suitColor1}" filter="url(#shadow)"/>`;
    svg += `<path d="M${w/2 - 15} ${bodyY} L${w/2 + 15} ${bodyY} L${w/2 + 5} ${h} L${w/2 - 5} ${h} Z" fill="${suitColor2}"/>`;
    svg += `<text x="${w/2}" y="${bodyY + 30}" text-anchor="middle" font-size="18" font-weight="900" fill="white" font-style="italic" stroke="#000" stroke-width="1">${number}</text>`;
  } else {
    // Camiseta fútbol pequeña
    svg += `<path d="M${w/2 - bodyW/2} ${h} L${w/2 - bodyW/2 + 5} ${bodyY + 10} Q${w/2} ${bodyY - 5} ${w/2 + bodyW/2 - 5} ${bodyY + 10} L${w/2 + bodyW/2} ${h} Z" fill="${suitColor1}" filter="url(#shadow)"/>`;
    // Detalles camiseta
    svg += `<path d="M${w/2 - 15} ${bodyY + 5} Q${w/2} ${bodyY + 15} ${w/2 + 15} ${bodyY + 5} L${w/2 + 20} ${bodyY - 2} Q${w/2} ${bodyY + 5} ${w/2 - 20} ${bodyY - 2} Z" fill="${suitColor2}"/>`;
    svg += `<text x="${w/2}" y="${bodyY + 35}" text-anchor="middle" font-size="22" font-weight="900" fill="white" stroke="${suitColor2}" stroke-width="2">${number}</text>`;
  }

  // Cabeza gigante
  const headY = isKid ? h * 0.45 : h * 0.4;
  const headW = isKid ? 50 : 55;
  const headH = isKid ? 45 : 60;
  
  if (faceShape === 'square') {
    svg += `<rect x="${w/2 - headW}" y="${headY - headH}" width="${headW*2}" height="${headH*2}" rx="20" fill="url(#faceGrad-${name})" filter="url(#shadow)"/>`;
    // Mandíbula prominente
    svg += `<path d="M${w/2 - headW} ${headY + headH - 20} Q${w/2} ${headY + headH + 20} ${w/2 + headW} ${headY + headH - 20} Z" fill="${skinShadow}"/>`;
  } else if (faceShape === 'round') {
    svg += `<ellipse cx="${w/2}" cy="${headY}" rx="${headW}" ry="${headH}" fill="url(#faceGrad-${name})" filter="url(#shadow)"/>`;
    // Papada
    if (!isKid) svg += `<ellipse cx="${w/2}" cy="${headY + headH - 5}" rx="${headW*0.8}" ry="15" fill="${skinShadow}"/>`;
  } else if (faceShape === 'long') {
    svg += `<ellipse cx="${w/2}" cy="${headY}" rx="${headW*0.8}" ry="${headH*1.1}" fill="url(#faceGrad-${name})" filter="url(#shadow)"/>`;
  }

  // Orejas
  const earY = headY;
  svg += `<ellipse cx="${w/2 - headW - 5}" cy="${earY}" rx="8" ry="12" fill="${skinShadow}"/>`;
  svg += `<ellipse cx="${w/2 + headW + 5}" cy="${earY}" rx="8" ry="12" fill="${skinShadow}"/>`;

  // Pelo
  const hairY = headY - headH + 10;
  if (name === "Marc") { // Rizoso, pelirrojo
    svg += `<path d="M${w/2 - headW + 5} ${hairY+15} 
             Q${w/2 - headW - 10} ${hairY-10} ${w/2 - headW/2} ${hairY-15} 
             Q${w/2} ${hairY-25} ${w/2 + headW/2} ${hairY-15} 
             Q${w/2 + headW + 10} ${hairY-10} ${w/2 + headW - 5} ${hairY+15}
             Q${w/2} ${hairY-5} ${w/2 - headW + 5} ${hairY+15} Z" fill="${hairColor}"/>`;
    // Rizos extras
    for(let i=0; i<8; i++) {
       svg += `<circle cx="${w/2 - headW/2 + i*8}" cy="${hairY - 5 + (i%2)*5}" r="12" fill="${hairColor}"/>`;
    }
  } else if (name === "Antonio") { // Poco pelo, algo canoso
    svg += `<path d="M${w/2 - headW + 10} ${hairY+15} Q${w/2 - headW} ${hairY} ${w/2 - headW/2 + 5} ${hairY+5} Z" fill="${hairColor}"/>`;
    svg += `<path d="M${w/2 + headW - 10} ${hairY+15} Q${w/2 + headW} ${hairY} ${w/2 + headW/2 - 5} ${hairY+5} Z" fill="${hairColor}"/>`;
  } else if (name === "Carlos") { // Siempre afeitado, pelo normal
    svg += `<path d="M${w/2 - headW} ${hairY+10} Q${w/2} ${hairY-15} ${w/2 + headW} ${hairY+10} Q${w/2} ${hairY+5} ${w/2 - headW} ${hairY+10} Z" fill="${hairColor}"/>`;
  } else if (name === "Toni") { // Entradas
    svg += `<path d="M${w/2 - headW} ${hairY+20} Q${w/2 - headW+15} ${hairY-5} ${w/2 - 10} ${hairY+5} Q${w/2} ${hairY-10} ${w/2 + 10} ${hairY+5} Q${w/2 + headW-15} ${hairY-5} ${w/2 + headW} ${hairY+20} Q${w/2} ${hairY+10} ${w/2 - headW} ${hairY+20} Z" fill="${hairColor}"/>`;
  } else if (name === "Pere") { // Liso canoso
    svg += `<path d="M${w/2 - headW} ${hairY+25} Q${w/2 - headW} ${hairY-10} ${w/2} ${hairY-10} Q${w/2 + headW} ${hairY-10} ${w/2 + headW} ${hairY+25} Q${w/2} ${hairY+10} ${w/2 - headW} ${hairY+25} Z" fill="${hairColor}"/>`;
  } else if (name === "Manrique") { // Pelo corto oscuro
    svg += `<path d="M${w/2 - headW} ${hairY+15} Q${w/2} ${hairY-10} ${w/2 + headW} ${hairY+15} Q${w/2} ${hairY+5} ${w/2 - headW} ${hairY+15} Z" fill="${hairColor}"/>`;
  }

  // Ojos desorbitados
  const eyeY = headY - 10;
  const eyeOff = isKid ? 18 : 22;
  const eyeR = isKid ? 12 : 14;
  
  // Bolsas ojeras
  if (!isKid) {
    svg += `<path d="M${w/2 - eyeOff - eyeR} ${eyeY + eyeR} Q${w/2 - eyeOff} ${eyeY + eyeR + 8} ${w/2 - eyeOff + eyeR} ${eyeY + eyeR}" stroke="#c48a60" stroke-width="2" fill="none"/>`;
    svg += `<path d="M${w/2 + eyeOff - eyeR} ${eyeY + eyeR} Q${w/2 + eyeOff} ${eyeY + eyeR + 8} ${w/2 + eyeOff + eyeR} ${eyeY + eyeR}" stroke="#c48a60" stroke-width="2" fill="none"/>`;
  }

  svg += `<circle cx="${w/2 - eyeOff}" cy="${eyeY}" r="${eyeR}" fill="white" stroke="#c48a60" stroke-width="1"/>`;
  svg += `<circle cx="${w/2 + eyeOff}" cy="${eyeY}" r="${eyeR}" fill="white" stroke="#c48a60" stroke-width="1"/>`;
  
  // Iris minúsculos (caricatura)
  svg += `<circle cx="${w/2 - eyeOff}" cy="${eyeY}" r="${eyeR*0.3}" fill="${eyeColor}"/>`;
  svg += `<circle cx="${w/2 + eyeOff}" cy="${eyeY}" r="${eyeR*0.3}" fill="${eyeColor}"/>`;
  // Pupilas
  svg += `<circle cx="${w/2 - eyeOff}" cy="${eyeY}" r="${eyeR*0.15}" fill="#000"/>`;
  svg += `<circle cx="${w/2 + eyeOff}" cy="${eyeY}" r="${eyeR*0.15}" fill="#000"/>`;

  // Cejas
  const browY = eyeY - eyeR - 5;
  if (name === "Toni") {
    svg += `<path d="M${w/2 - eyeOff - 15} ${browY+5} L${w/2 - eyeOff + 10} ${browY}" stroke="${hairColor}" stroke-width="6" stroke-linecap="round"/>`;
    svg += `<path d="M${w/2 + eyeOff + 15} ${browY+5} L${w/2 + eyeOff - 10} ${browY}" stroke="${hairColor}" stroke-width="6" stroke-linecap="round"/>`;
  } else {
    svg += `<path d="M${w/2 - eyeOff - 12} ${browY} Q${w/2 - eyeOff} ${browY-5} ${w/2 - eyeOff + 12} ${browY}" stroke="${hairColor}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
    svg += `<path d="M${w/2 + eyeOff - 12} ${browY} Q${w/2 + eyeOff} ${browY-5} ${w/2 + eyeOff + 12} ${browY}" stroke="${hairColor}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  }

  // Gafas
  if (hasGlasses) {
    const gw = eyeR * 3;
    const gh = eyeR * 2.5;
    svg += `<rect x="${w/2 - eyeOff - gw/2}" y="${eyeY - gh/2}" width="${gw}" height="${gh}" rx="6" fill="rgba(255,255,255,0.1)" stroke="${glassesColor}" stroke-width="3"/>`;
    svg += `<rect x="${w/2 + eyeOff - gw/2}" y="${eyeY - gh/2}" width="${gw}" height="${gh}" rx="6" fill="rgba(255,255,255,0.1)" stroke="${glassesColor}" stroke-width="3"/>`;
    svg += `<line x1="${w/2 - eyeOff + gw/2}" y1="${eyeY}" x2="${w/2 + eyeOff - gw/2}" y2="${eyeY}" stroke="${glassesColor}" stroke-width="3"/>`;
  }

  // Nariz (gigante y detallada para Krüger style, excepto Marc que es niño)
  const noseY = eyeY + 15;
  if (noseType === "big") {
    svg += `<path d="M${w/2 - 5} ${noseY} Q${w/2 - 15} ${noseY+25} ${w/2 - 10} ${noseY+30} Q${w/2} ${noseY+35} ${w/2 + 10} ${noseY+30} Q${w/2 + 15} ${noseY+25} ${w/2 + 5} ${noseY}" fill="${skinShadow}" stroke="#c48a60" stroke-width="1.5"/>`;
    // Fosas nasales
    svg += `<circle cx="${w/2 - 8}" cy="${noseY+28}" r="3" fill="#8a5a40"/>`;
    svg += `<circle cx="${w/2 + 8}" cy="${noseY+28}" r="3" fill="#8a5a40"/>`;
  } else { // Pequeña/niño
    svg += `<path d="M${w/2 - 4} ${noseY} Q${w/2} ${noseY+15} ${w/2 + 4} ${noseY}" fill="none" stroke="#c48a60" stroke-width="2"/>`;
  }

  // Boca exagerada
  const mouthY = isKid ? headY + headH - 15 : headY + headH - 25;
  if (smileType === "big") {
    svg += `<path d="M${w/2 - 25} ${mouthY} Q${w/2} ${mouthY+30} ${w/2 + 25} ${mouthY} Z" fill="#4a1515"/>`;
    // Dientes
    svg += `<path d="M${w/2 - 20} ${mouthY} Q${w/2} ${mouthY+15} ${w/2 + 20} ${mouthY} Z" fill="white"/>`;
  } else if (smileType === "smirk") {
    svg += `<path d="M${w/2 - 15} ${mouthY} Q${w/2} ${mouthY+10} ${w/2 + 20} ${mouthY-5}" stroke="#4a1515" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    // Arruga comisura
    svg += `<path d="M${w/2 + 20} ${mouthY-10} Q${w/2 + 25} ${mouthY-5} ${w/2 + 20} ${mouthY}" stroke="#c48a60" stroke-width="1.5" fill="none"/>`;
  }

  // Barba exagerada
  if (beardType === "full") {
    svg += `<path d="M${w/2 - headW} ${eyeY + 20} Q${w/2 - headW - 10} ${mouthY + 20} ${w/2} ${headY + headH + 10} Q${w/2 + headW + 10} ${mouthY + 20} ${w/2 + headW} ${eyeY + 20} Q${w/2 + headW - 20} ${mouthY} ${w/2} ${mouthY + 15} Q${w/2 - headW + 20} ${mouthY} ${w/2 - headW} ${eyeY + 20} Z" fill="${beardColor}" opacity="0.8"/>`;
  } else if (beardType === "stubble") {
    svg += `<path d="M${w/2 - headW + 5} ${eyeY + 20} Q${w/2 - headW} ${mouthY + 15} ${w/2} ${headY + headH} Q${w/2 + headW} ${mouthY + 15} ${w/2 + headW - 5} ${eyeY + 20} Q${w/2 + headW - 15} ${mouthY - 5} ${w/2} ${mouthY + 5} Q${w/2 - headW + 15} ${mouthY - 5} ${w/2 - headW + 5} ${eyeY + 20} Z" fill="${beardColor}" opacity="0.3"/>`;
    // Puntos de barba
    for(let i=0; i<30; i++) {
       const rx = w/2 - 25 + Math.random()*50;
       const ry = mouthY + 5 + Math.random()*20;
       svg += `<circle cx="${rx}" cy="${ry}" r="0.8" fill="${beardColor}" opacity="0.5"/>`;
    }
  }

  svg += "</svg>";
  return svg;
}

const W = 150, H = 200;

// Descripciones:
// Antonio: 1.75, poco pelo, algo canoso, con gafas, taxista (Barcelona) -> Mono rojo F1, Kit rojo futbol
// Carlos: 1.70 siempre afeitado, sin gafas, deporte, Real Sociedad -> Mono F1 azul/blanco, Kit Real Sociedad (azul/blanco)
// Toni: 1.92, barba cortada al 7, con gafas, pelo oscuro entradas, vino Burgos -> Mono F1 granate, Kit granate
// Pere: 1.85, canoso liso, sin gafas bien afeitado, NBA -> Mono F1 naranja, Kit amarillo/morado (Lakers style)
// Manrique: 1.77, gafas azules, barba cortada al 5, pelo oscuro, Sporting Gijón -> Mono F1 Aston Martin, Kit Sporting (rojo/blanco)
// Marc: 14 años, pelirrojo, rizoso, hincha Manchester City -> Mono F1 celeste, Kit Manchester City (celeste)

const avatars = {
  Antonio: {
    f1: buildAvatar(W, H, {
      name: "Antonio", isF1: true, isKid: false,
      skinColor: "#f5c6a0", skinShadow: "#d49a70", faceShape: "square",
      hairColor: "#b0a898", eyeColor: "#5c4033",
      hasGlasses: true, glassesColor: "#222",
      noseType: "big", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#cc0000", suitColor2: "#ffffff", number: "14"
    }),
    futbol: buildAvatar(W, H, {
      name: "Antonio", isF1: false, isKid: false,
      skinColor: "#f5c6a0", skinShadow: "#d49a70", faceShape: "square",
      hairColor: "#b0a898", eyeColor: "#5c4033",
      hasGlasses: true, glassesColor: "#222",
      noseType: "big", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#cc0000", suitColor2: "#004f9e", number: "7"
    }),
  },
  Carlos: {
    f1: buildAvatar(W, H, {
      name: "Carlos", isF1: true, isKid: false,
      skinColor: "#e8b890", skinShadow: "#c68b60", faceShape: "round",
      hairColor: "#2a1a1a", eyeColor: "#2a1a1a",
      hasGlasses: false, glassesColor: "transparent",
      noseType: "big", smileType: "smirk",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#005baa", suitColor2: "#ffffff", number: "55"
    }),
    futbol: buildAvatar(W, H, {
      name: "Carlos", isF1: false, isKid: false,
      skinColor: "#e8b890", skinShadow: "#c68b60", faceShape: "round",
      hairColor: "#2a1a1a", eyeColor: "#2a1a1a",
      hasGlasses: false, glassesColor: "transparent",
      noseType: "big", smileType: "smirk",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#ffffff", suitColor2: "#005baa", number: "10"
    }),
  },
  Toni: {
    f1: buildAvatar(W, H, {
      name: "Toni", isF1: true, isKid: false,
      skinColor: "#f0c098", skinShadow: "#d0956b", faceShape: "long",
      hairColor: "#2c1d10", eyeColor: "#402010",
      hasGlasses: true, glassesColor: "#555",
      noseType: "big", smileType: "smirk",
      beardType: "full", beardColor: "#2c1d10",
      suitColor1: "#722f37", suitColor2: "#c9a84c", number: "1"
    }),
    futbol: buildAvatar(W, H, {
      name: "Toni", isF1: false, isKid: false,
      skinColor: "#f0c098", skinShadow: "#d0956b", faceShape: "long",
      hairColor: "#2c1d10", eyeColor: "#402010",
      hasGlasses: true, glassesColor: "#555",
      noseType: "big", smileType: "smirk",
      beardType: "full", beardColor: "#2c1d10",
      suitColor1: "#722f37", suitColor2: "#ffffff", number: "1"
    }),
  },
  Pere: {
    f1: buildAvatar(W, H, {
      name: "Pere", isF1: true, isKid: false,
      skinColor: "#f5cdab", skinShadow: "#d6a178", faceShape: "long",
      hairColor: "#c0bcba", eyeColor: "#3a5a80",
      hasGlasses: false, glassesColor: "transparent",
      noseType: "big", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#ff8c00", suitColor2: "#222222", number: "33"
    }),
    futbol: buildAvatar(W, H, {
      name: "Pere", isF1: false, isKid: false,
      skinColor: "#f5cdab", skinShadow: "#d6a178", faceShape: "long",
      hairColor: "#c0bcba", eyeColor: "#3a5a80",
      hasGlasses: false, glassesColor: "transparent",
      noseType: "big", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#552583", suitColor2: "#fdb927", number: "23"
    }),
  },
  Manrique: {
    f1: buildAvatar(W, H, {
      name: "Manrique", isF1: true, isKid: false,
      skinColor: "#eec2a0", skinShadow: "#cc9570", faceShape: "square",
      hairColor: "#3a2a1a", eyeColor: "#50301a",
      hasGlasses: true, glassesColor: "#1e3a8a", // Gafas azules
      noseType: "big", smileType: "smirk",
      beardType: "stubble", beardColor: "#3a2a1a",
      suitColor1: "#005baa", suitColor2: "#00c853", number: "14"
    }),
    futbol: buildAvatar(W, H, {
      name: "Manrique", isF1: false, isKid: false,
      skinColor: "#eec2a0", skinShadow: "#cc9570", faceShape: "square",
      hairColor: "#3a2a1a", eyeColor: "#50301a",
      hasGlasses: true, glassesColor: "#1e3a8a",
      noseType: "big", smileType: "smirk",
      beardType: "stubble", beardColor: "#3a2a1a",
      suitColor1: "#cc0000", suitColor2: "#ffffff", number: "6"
    }),
  },
  Marc: {
    f1: buildAvatar(W, H, {
      name: "Marc", isF1: true, isKid: true,
      skinColor: "#ffdfc4", skinShadow: "#e6b89c", faceShape: "round",
      hairColor: "#d94b18", eyeColor: "#2a6a8c", // Pelirrojo
      hasGlasses: false, glassesColor: "transparent",
      noseType: "small", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#6cabdd", suitColor2: "#ffffff", number: "9" // City celeste
    }),
    futbol: buildAvatar(W, H, {
      name: "Marc", isF1: false, isKid: true,
      skinColor: "#ffdfc4", skinShadow: "#e6b89c", faceShape: "round",
      hairColor: "#d94b18", eyeColor: "#2a6a8c",
      hasGlasses: false, glassesColor: "transparent",
      noseType: "small", smileType: "big",
      beardType: "none", beardColor: "transparent",
      suitColor1: "#6cabdd", suitColor2: "#ffffff", number: "9" // City celeste
    }),
  }
};

async function uploadAvatars() {
  const f1Avatars = {};
  const futbolAvatars = {};

  for (const [name, data] of Object.entries(avatars)) {
    f1Avatars[name] = svgToDataUrl(data.f1);
    futbolAvatars[name] = svgToDataUrl(data.futbol);
    console.log(`  ${name}: F1 ${data.f1.length}B, Futbol ${data.futbol.length}B`);
  }

  console.log("\nSubiendo a DynamoDB (META|CONFIG)...");
  const { execSync } = await import("child_process");

  const avatarsM = {};
  for (const [name, url] of Object.entries(f1Avatars)) {
    avatarsM[name] = { S: url };
  }
  const avatarsFutbolM = {};
  for (const [name, url] of Object.entries(futbolAvatars)) {
    avatarsFutbolM[name] = { S: url };
  }

  const updateExpr = "SET avatars = :av, avatarsFutbol = :avf";
  const exprValues = JSON.stringify({
    ":av": { M: avatarsM },
    ":avf": { M: avatarsFutbolM },
  });

  const cmd = `aws dynamodb update-item --table-name porra-f1 --region us-east-1 --key '${JSON.stringify({
    pk: { S: "G#birreros" },
    sk: { S: "META|CONFIG" },
  })}' --update-expression '${updateExpr}' --expression-attribute-values '${exprValues}'`;

  try {
    execSync(cmd, { stdio: "pipe" });
    console.log("Avatares estilo Krüger subidos a DynamoDB correctamente!");
  } catch (err) {
    console.error("Error:", err.stderr?.toString() || err.message);
  }
}

console.log("Generando avatares SVG estilo Krüger...");
uploadAvatars().catch(console.error);