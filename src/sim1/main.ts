import { LBMSimulation } from "./LBMSimulation";
import { Renderer } from "./Renderer";
import { UIController } from "./ui";
import { Salmon } from "./Salmon";

const canvas = document.getElementById('theCanvas') as HTMLCanvasElement;
const context = canvas.getContext('2d') as CanvasRenderingContext2D;

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const sizeSelect = document.getElementById('sizeSelect') as HTMLSelectElement;
let pxPerSquare = Number(sizeSelect.options[sizeSelect.selectedIndex].value);
let xdim = Math.floor(canvas.width / pxPerSquare);
let ydim = Math.floor(canvas.height / pxPerSquare);

const sim = new LBMSimulation(xdim, ydim, pxPerSquare);
sim.initFluid(0.1);
sim.initTracers(false);

const renderer = new Renderer(context, canvas, sim);

// Create a salmon at (xdim/2, ydim/2), length=5 cells, maxSpeed=0.5 cells/step, initial energy=10
const salmon = new Salmon(xdim/2, ydim/2, 5, 0.5, 10);

// Set salmon in renderer and UI
renderer.salmon = salmon;

const ui = new UIController(sim, renderer, salmon);
ui.salmon = salmon; // Pass salmon reference to UI

ui.repaint();
