// three.js renderer, scene, camera and sun.
import './worker-link.js';          // load order: runs after sim/worker-link
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { PhysicalCamera } from 'three-gpu-pathtracer';
import { $ } from '../core/dom.js';

// ------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
const IS_PHONE = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_PHONE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
RectAreaLightUniformsLib.init();
const scene = new THREE.Scene();
const camera = new PhysicalCamera(38, 16 / 10, 0.05, 50);
camera.bokehSize = 0;                     // depth of field off until asked for
camera.apertureBlades = 6;

// Raster key light: gives the live preview its shadows. The path tracer uses
// the area lights and the HDRI instead, so this one is switched off there.
const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 14 });
sun.shadow.bias = -0.0004;
 sun.shadow.normalBias = 0.02;
 sun.shadow.radius = 4;
scene.add(sun);

export { IS_PHONE, camera, canvas, renderer, scene, sun };
