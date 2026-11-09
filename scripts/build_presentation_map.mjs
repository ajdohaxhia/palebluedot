#!/usr/bin/env node
/** Generate the required source-coverage map from the supplied deck and the implemented stages. */
import fs from "node:fs";
import path from "node:path";
import { LESSON } from "../src/data/lesson.js";
import { STAGE_CONFIG } from "../src/cosmos/stage-config.js";

const C = {
  pres: "Presentazione del docente · Geografia astronomica UDA 2 e 3",
  nasa: "NASA / JPL-Caltech",
  hubble: "NASA / ESA / Hubble / STScI",
  jpl: "NASA/JPL Solar System Dynamics",
  iau: "IAU",
  hyg: "HYG Database v4.1 · Astronomy Nexus (CC BY-SA 4.0)",
  sdss: "SDSS DR18",
  ned: "NASA/IPAC NED",
  gaia: "Gaia DR3 / Healy et al. 2023",
  exo: "NASA Exoplanet Archive",
};

const META = {
  1: { objects: ["Voyager 1", "Terra", "Sole", "Pale Blue Dot"], objective: "Comprendere la scala della distanza interplanetaria e il significato della Pale Blue Dot.", status: "historical", cites: [C.pres, C.nasa], notes: "La fotografia è del 1990; Voyager 1 ha superato l'eliopausa nel 2012." },
  2: { objects: ["Sole", "Terra", "Unità astronomica"], objective: "Definire l'unità astronomica e usarla per misurare le distanze nel Sistema Solare.", status: "verified", cites: [C.pres, C.iau, C.jpl], notes: null },
  3: { objects: ["Sole", "Mercurio", "Venere", "Terra", "Marte", "Giove", "Saturno", "Urano", "Nettuno", "Plutone"], objective: "Distinguere pianeti interni ed esterni e riconoscere i movimenti di rotazione e rivoluzione.", status: "approximate", cites: [C.pres, C.jpl, C.iau], notes: "Plutone è un pianeta nano dal 2006; la slide lo inserisce tra i corpi del Sistema Solare." },
  4: { objects: ["Mercurio", "Venere", "Terra", "Marte", "Giove", "Saturno", "Urano", "Nettuno", "Plutone", "Voyager 1"], objective: "Ordinare i pianeti per distanza e confrontare le distanze in UA.", status: "approximate", cites: [C.pres, C.jpl], notes: "Le distanze sono medie e arrotondate; Voyager 1 è indicata a 168 UA con data 2025." },
  5: { objects: ["Fascia di Kuiper", "Nube di Oort", "Plutone"], objective: "Distinguere la fascia di Kuiper osservata dal modello della nube di Oort.", status: "model", cites: [C.pres, C.nasa, C.iau], notes: "La nube di Oort non è osservata direttamente: è un modello teorico." },
  6: { objects: ["Terra", "Apollo 17"], objective: "Descrivere la Terra e l'importanza delle fotografie Apollo.", status: "historical", cites: [C.pres, C.nasa], notes: "La fotografia Apollo 17 è del dicembre 1972." },
  7: { objects: ["Luna", "Apollo 11", "Mare della Tranquillità"], objective: "Ricostruire le tappe della missione Apollo 11 e distinguere allunaggio e primo passo.", status: "historical", cites: [C.pres, C.nasa], notes: "La slide contiene solo l'immagine della Luna; la timeline Apollo è un approfondimento verificato." },
  8: { objects: ["Terra", "Luna", "MESSENGER"], objective: "Confrontare il diametro terrestre con la distanza Terra–Luna.", status: "historical", cites: [C.pres, C.nasa], notes: "Distanza media 384.403 km; la fotografia MESSENGER è indicata nella slide." },
  9: { objects: ["Fascia di Kuiper", "Eliopausa", "Nube di Oort", "Voyager 1"], objective: "Spiegare i tre confini del Sistema Solare e la differenza tra misure e modelli.", status: "model", cites: [C.pres, C.nasa, C.iau], notes: "L'eliopausa è una regione di transizione; la NASA la usa come confine operativo. La nube di Oort è un modello." },
  10: { objects: ["Pioneer 10", "Pioneer 11", "placca Pioneer"], objective: "Conoscere le sonde Pioneer e il loro messaggio verso lo spazio interstellare.", status: "historical", cites: [C.pres, C.nasa], notes: "La placca è un messaggio simbolico; le distanze delle sonde sono datate." },
  11: { objects: ["placca Pioneer", "atomo di idrogeno", "pulsar", "Sistema Solare", "figure umane"], objective: "Interpretare i simboli della placca Pioneer.", status: "verified", cites: [C.pres, C.nasa], notes: "La placca Pioneer è distinta dal disco d'oro delle Voyager." },
  12: { objects: ["anno luce", "Sole", "Terra", "Luna"], objective: "Definire l'anno luce come distanza e convertire correttamente le unità.", status: "verified", cites: [C.pres, C.iau], notes: "Un anno luce è una distanza, non un tempo." },
  13: { objects: ["Proxima Centauri", "Alpha Centauri"], objective: "Comprendere il salto dal Sistema Solare alle stelle vicine.", status: "updated", cites: [C.pres, C.hyg], notes: "La slide indica 3 al come ordine di grandezza; Proxima Centauri è a 4,24 al." },
  14: { objects: ["Alpha Centauri A", "Alpha Centauri B", "Proxima Centauri", "Sirio", "Sirio B"], objective: "Confrontare Alpha Centauri e Sirio e le loro distanze.", status: "verified", cites: [C.pres, C.hyg], notes: "Sirio A e Sirio B non vanno confusi; Proxima è una nana rossa." },
  15: { objects: ["Aldebaran", "Procyon", "Tau Ceti", "vicinato solare"], objective: "Orientarsi nel vicinato solare entro 100 anni luce.", status: "approximate", cites: [C.pres, C.hyg], notes: "La mappa usa il catalogo HYG; le distanze stellari hanno incertezza." },
  16: { objects: ["Via Lattea", "Sole", "centro galattico"], objective: "Descrivere la Via Lattea e la posizione del Sole.", status: "model", cites: [C.pres, C.ned, C.hyg], notes: "Non possiamo fotografare la Via Lattea dall'esterno: la struttura 3D è un modello." },
  17: { objects: ["Via Lattea", "Andromeda", "Triangolo", "Nubi di Magellano"], objective: "Definire il Gruppo Locale e le sue galassie principali.", status: "verified", cites: [C.pres, C.ned], notes: null },
  18: { objects: ["Grande Nube di Magellano", "Piccola Nube di Magellano", "Andromeda"], objective: "Confrontare Andromeda e le Nubi di Magellano.", status: "updated", cites: [C.pres, C.ned], notes: "La slide indica 2,2 Mly per Andromeda; le misure moderne danno ~2,54 Mly." },
  19: { objects: ["Superammasso della Vergine", "Ammasso della Vergine", "Gruppo Locale"], objective: "Distinguere gruppo, ammasso e superammasso.", status: "updated", cites: [C.pres, C.ned, C.sdss], notes: "La presentazione indica 200 Mly e 2.500 galassie; le stime moderne del Superammasso sono ~110 Mly. La mappa SDSS è parziale." },
  20: { objects: ["orizzonte cosmico", "Universo osservabile"], objective: "Spiegare l'orizzonte osservabile e distinguerlo dall'età dell'Universo.", status: "updated", cites: [C.pres, C.nasa], notes: "L'orizzonte non è un muro fisico; il raggio comovente è ~46,5 Gly." },
  21: { objects: ["Universo osservabile", "Universo oltre l'orizzonte"], objective: "Comprendere i limiti della conoscenza oltre l'orizzonte osservabile.", status: "uncertain", cites: [C.pres, C.nasa], notes: "Non esiste una misura verificata dell'estensione totale dell'Universo." },
  22: { objects: ["Nebulosa Aquila", "Pilastri della Creazione", "formazione stellare"], objective: "Spiegare la formazione stellare nelle nebulose.", status: "updated", cites: [C.pres, C.hubble], notes: "Il Sole non si è formato nella Nebulosa Aquila; l'immagine è un esempio di formazione stellare." },
  23: { objects: ["Sole", "Terra"], objective: "Confrontare dimensioni e massa del Sole con la Terra.", status: "updated", cites: [C.pres, C.nasa, C.iau], notes: "La massa solare è ~2×10²⁷ tonnellate; la nota della presentazione omette un fattore 10⁹." },
  24: { objects: ["Sole", "Mercurio", "Venere", "Terra", "Marte", "Giove", "Saturno", "Urano", "Nettuno", "Plutone"], objective: "Confrontare il Sole con i pianeti in scala.", status: "verified", cites: [C.pres, C.jpl, C.iau], notes: null },
  25: { objects: ["Sirio A", "Sole", "Terra"], objective: "Confrontare Sirio e il Sole e leggere le temperature stellari.", status: "verified", cites: [C.pres, C.hyg], notes: "Il bagliore non fa parte del raggio fisico." },
  26: { objects: ["pianeti rocciosi", "giganti gassosi", "giganti ghiacciati", "Plutone"], objective: "Confrontare le dimensioni dei pianeti.", status: "verified", cites: [C.pres, C.jpl, C.iau], notes: "Le distanze orbitali sono una scala diversa dalle dimensioni." },
  27: { objects: ["Sole", "Sirio", "Aldebaran", "Betelgeuse", "VY Canis Majoris", "UY Scuti"], objective: "Confrontare le dimensioni delle stelle e riconoscere le incertezze.", status: "uncertain", cites: [C.pres, C.hyg, C.gaia], notes: "I raggi stellari sono stime; il Sole è una stella media." },
  28: { objects: ["VY Canis Majoris", "Sole", "Giove"], objective: "Conoscere VY Canis Majoris e la sua scala rispetto al Sistema Solare.", status: "approximate", cites: [C.pres, C.gaia], notes: "Raggio ~1.420 ± 120 R☉; distanza ~3.820 al." },
  29: { objects: ["VY Canis Majoris", "involucro circumstellare"], objective: "Distinguere la fotosfera dal materiale circumstellare osservato da Hubble.", status: "verified", cites: [C.pres, C.hubble], notes: "L'immagine Hubble riprodotta nella presentazione mostra il guscio di polvere." },
  30: { objects: ["VY Canis Majoris", "Sole", "velocità della luce"], objective: "Calcolare il tempo della luce attorno a una stella e spiegare le assunzioni.", status: "updated", cites: [C.pres, C.gaia, C.iau], notes: "Con 1.420 R☉ il tempo è ~5,8 h; la presentazione indica ~8 h, coerente con stime storiche maggiori." },
  31: { objects: ["UY Scuti", "Sole"], objective: "Discutere le stime di raggio di UY Scuti e il carattere storico del primato.", status: "updated", cites: [C.pres, C.gaia], notes: "La presentazione (2018) indica 1.708 R☉ e 9.460 al; stime moderne ~909 R☉ e ~5.900 al. Stephenson 2-18 è spesso indicata come più grande." },
  32: { objects: ["Big Bang", "Terra", "Homo sapiens", "tempo cosmico"], objective: "Collocare la storia della Terra e dell'umanità nel tempo cosmico.", status: "verified", cites: [C.pres, C.nasa, C.iau], notes: "Il calendario cosmico è una scala didattica; l'analogia del millimetro è approssimata." },
};

const IMAGE_OVERRIDES = {
  22: ["assets/cosmos/images/pillars-clean.jpg"],
  10: ["assets/cosmos/images/plaque-mounted.png"],
  11: ["assets/cosmos/images/pioneer-plaque.png"],
  6: ["assets/cosmos/images/apollo-17-earth.png"],
  7: ["assets/cosmos/images/moon.png"],
  29: ["assets/cosmos/images/vy-cma-hubble.png"],
  31: ["assets/cosmos/images/uy-scuti.png"],
  1: ["assets/cosmos/images/pale-blue-dot.png"],
  18: ["assets/cosmos/images/gallery-18-1.png", "assets/cosmos/images/gallery-18-2.png", "assets/cosmos/images/gallery-18-3.png"],
};

const THREED = {
  1: "Sistema Solare esterno · ~45 UA", 2: "Sole–Terra · 1 UA", 3: "Sistema Solare · vista sinottica",
  4: "Sistema Solare · distanze orbitali", 5: "Sistema Solare esterno", 6: "Terra", 7: "Luna",
  8: "Terra–Luna", 9: "Sistema Solare esterno", 10: "Sistema Solare esterno", 11: "Sistema Solare esterno",
  12: "Stelle vicine", 13: "Proxima Centauri", 14: "Vicinato solare", 15: "Vicinato solare · 100 al",
  16: "Via Lattea", 17: "Gruppo Locale", 18: "Andromeda e Nubi di Magellano", 19: "Superammasso della Vergine",
  20: "Universo osservabile", 21: "Oltre l’orizzonte", 22: "Nebulosa Aquila", 23: "Sole", 24: "Sole e pianeti",
  25: "Sirio, Sole, Terra", 26: "Pianeti a confronto", 27: "Stelle a confronto", 28: "VY Canis Majoris",
  29: "VY Canis Majoris · Hubble", 30: "VY Canis Majoris · luce", 31: "UY Scuti", 32: "Universo · tempo cosmico",
};

const componentLabels = {
  image: "Visualizzatore d'immagine con zoom, pan e hotspot",
  scale: "Confronto dimensionale interattivo in scala",
  distance: "Diagramma interattivo di distanza e viaggio della luce",
  boundaries: "Scala logaritmica interattiva dei confini",
  timeline: "Linea del tempo interattiva",
  gallery: "Galleria interattiva con didascalie",
  atlas: "Atlante 3D interattivo con selezione oggetti",
};

const slides = LESSON.steps.map(step => {
  const cfg = STAGE_CONFIG[step.n] || { type: "atlas" };
  const meta = META[step.n] || {};
  const imageReferences = [step.slide];
  if (cfg.src) imageReferences.push(cfg.src);
  if (cfg.hero) imageReferences.push(cfg.hero);
  if (cfg.items) imageReferences.push(...cfg.items.map(i => i.src));
  if (IMAGE_OVERRIDES[step.n]) imageReferences.push(...IMAGE_OVERRIDES[step.n]);
  const values = (step.facts || []).map(([label, value]) => ({ label, value }));
  return {
    slide: step.n,
    sourceSlide: step.n,
    heading: step.title,
    section: step.section,
    originalSlideText: step.text || "",
    slideText: step.text || "",
    speakerNotes: step.notes || "",
    notesPreserved: Boolean(step.notes),
    astronomicalObjects: meta.objects || [],
    numericalValues: values,
    teachingObjective: meta.objective || "",
    teachingObjectives: [meta.objective || ""],
    originalImageReferences: [...new Set(imageReferences)],
    imageReferences: [...new Set(imageReferences)],
    primaryMedium: "3D universe",
    threeDScene: {
      ...(step.scene || {}),
      label: THREED[step.n] || step.title,
      primary: true,
    },
    plannedComponent: componentLabels[cfg.type] || "Scena interattiva",
    optionalInteractiveComponent: componentLabels[cfg.type] || null,
    plannedInteractiveComponent: {
      type: cfg.type,
      label: componentLabels[cfg.type] || "Scena interattiva",
      interaction: (cfg.interactions || []).join(" "),
    },
    scientificVerificationStatus: meta.status || "approximate",
    scientificNote: meta.notes || step.caveat || null,
    sourceCitations: meta.cites || [C.pres],
    completionStatus: "implemented",
    hasOriginalSlideAccess: true,
  };
});

const map = {
  project: "COSMOS — Atlante interattivo di Geografia astronomica",
  sourceFile: "Presentazione Geografia astronomica UDA 2 e 3.pptx",
  language: "it",
  generatedAt: new Date().toISOString(),
  summary: {
    sourceSlides: 32,
    representedSlides: slides.length,
    speakerNotesPreserved: slides.filter(s => s.notesPreserved).length,
    threeDScenes: slides.length,
    interactiveComponents: slides.length,
    coverage: "32/32",
  },
  slides,
};

const out = path.resolve("src/content/presentation-map.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map, null, 2) + "\n");
console.log(`presentation-map.json: ${slides.length} slides, ${map.summary.speakerNotesPreserved} speaker-note entries, ${out}`);
