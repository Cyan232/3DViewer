import { setupRenderer, getRendererParams, addObservationToRenderer } from "./renderer";

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let params;

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        addObservationToRenderer(data);
    };

    reader.readAsText(file);
}

function main() {
    setupRenderer();
    params = getRendererParams();

    const gui = new GUI();
    gui.add(params, 'rotate');
    gui.add(params, 'heatMap');
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none'; // Hide the input element

    input.addEventListener('change', handleFileUpload);

    // Add upload button to GUI
    gui.add({ upload: () => input.click() }, 'upload').name('Upload observations');

    gui.open();
}

function addObservations() {
    // Add your observations here
}

main();