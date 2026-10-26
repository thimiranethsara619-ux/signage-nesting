let uploadedSVG = null;

const fileInput = document.getElementById('svgFile');
const calculateBtn = document.getElementById('calculateBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const previewDiv = document.getElementById('preview');
const sheetWidthInput = document.getElementById('sheetWidth');
const sheetHeightInput = document.getElementById('sheetHeight');
const spacingInput = document.getElementById('spacing');
const unitSelect = document.getElementById('unitSelect');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        uploadedSVG = event.target.result;
        statusDiv.textContent = `✅ File එක load වුණා: ${file.name}`;
        statusDiv.classList.add('active');
    };
    reader.readAsText(file);
});

calculateBtn.addEventListener('click', async () => {
    if (!uploadedSVG) {
        alert("මුලින්ම SVG file එකක් උඩුගත කරන්න!");
        return;
    }

    const multiplier = parseFloat(unitSelect.value);
    const unitText = unitSelect.options[unitSelect.selectedIndex].text;

    const sheetW = parseFloat(sheetWidthInput.value) * multiplier;
    const sheetH = parseFloat(sheetHeightInput.value) * multiplier;
    const spacing = parseFloat(spacingInput.value) * multiplier;

    if (!sheetW || !sheetH) {
        alert("Sheet size එක හරියට දාන්න!");
        return;
    }

    calculateBtn.disabled = true;
    statusDiv.textContent = "⏳ ගණනය කරමින්...";
    statusDiv.classList.add('active');
    resultDiv.classList.remove('active');
    previewDiv.classList.remove('active');

    try {
        // SVG එක Browser එකේ ලෝඩ් කරලා ඒකේ shapes ටික ගන්නවා
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(uploadedSVG, "image/svg+xml");
        
        // අකුරු / හැඩතල ටික ගන්නවා
        let shapes = Array.from(svgDoc.querySelectorAll('path, rect, circle, polygon, text'));
        
        // අපේ Sheet එක (bin) එක වෙනම හොයාගන්නවා
        let binElement = svgDoc.querySelector('#bin') || svgDoc.querySelector('#sheet');
        if(binElement) {
            shapes = shapes.filter(s => s !== binElement);
        }

        if(shapes.length === 0) throw new Error("SVG එකේ කිසිම හැඩයක් (අකුරක්) හම්බුණේ නෑ.");

        // හැඩතල වල ප්‍රමාණ ගණනය කරනවා (Bounding box)
        const items = [];
        const shapeElements = [];

        shapes.forEach(shape => {
            // හැඩයේ ප්‍රමාණය ගන්න අපි ඒක තාවකාලිකව DOM එකට දානවා
            const clone = shape.cloneNode(true);
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            tempSvg.appendChild(clone);
            document.body.appendChild(tempSvg);
            
            const bbox = clone.getBoundingClientRect(); // හැඩයේ ප්‍රමාණය
            document.body.removeChild(tempSvg);

            if(bbox.width > 0 && bbox.height > 0) {
                items.push({
                    w: bbox.width + spacing, // පරතරය එකතු කරනවා
                    h: bbox.height + spacing,
                    origShape: shape,
                    origW: bbox.width,
                    origH: bbox.height
                });
                shapeElements.push(shape);
            }
        });

        // Potpack ලයිබ්‍රරි එකෙන් හොඳම තැබීම හොයනවා (මේක ඉතාම වේගවත්)
        const result = potpack(items);

        // කීයක් Sheet යනවද ගණනය කරනවා
        const usedW = Math.ceil(result.w);
        const usedH = Math.ceil(result.h);
        
        const sheetsWise = Math.ceil(usedW / sheetW);
        const sheetsHigh = Math.ceil(usedH / sheetH);
        const totalSheets = sheetsWise * sheetsHigh;

        // ප්‍රතිඵලය පෙන්නනවා
        resultDiv.innerHTML = `
            <h2>📊 ප්‍රතිඵලය</h2>
            <p><strong>යන Sheet ගණන:</strong> ${totalSheets} sheets</p>
            <p><strong>මුළු භාවිතා වූ ප්‍රමාණය:</strong> ${usedW} x ${usedH} (${unitText})</p>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
                Sheet size: ${sheetWidthInput.value} × ${sheetHeightInput.value} (${unitText}) <br>
                අකුරු අතර පරතරය: ${spacingInput.value} (${unitText})
            </p>
        `;
        resultDiv.classList.add('active');

        // Canvas එකේ පින්තූරය අඳිනවා
        previewDiv.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = sheetW;
        canvas.height = sheetH * totalSheets;
        
        // පසුබිම සුදු කරනවා
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Sheet එකේ මායිම අඳිනවා
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        for(let i=0; i<totalSheets; i++){
             ctx.strokeRect(0, i * sheetH, sheetW, sheetH);
        }

        // හැඩතල Canvas එකට ඇදලා දානවා
        items.forEach(item => {
            const shape = item.origShape;
            // අකුරු වල පිහිටීම (x, y)
            const x = item.x;
            const y = item.y;
            
            // SVG Path එක Canvas එකට ඇදලා දාන විදිහ
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            if (shape.tagName === 'path') {
                const d = shape.getAttribute('d');
                const path2d = new Path2D(d);
                ctx.fillStyle = '#000000'; // අකුරු කළු පාටින්
                ctx.fill(path2d);
            } else if (shape.tagName === 'rect') {
                const w = parseFloat(shape.getAttribute('width'));
                const h = parseFloat(shape.getAttribute('height'));
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, w, h);
            }
            ctx.restore();
        });

        previewDiv.appendChild(canvas);
        previewDiv.classList.add('active');
        
        statusDiv.textContent = `✅ අවසන්! Sheet ${totalSheets}ක් යනවා.`;
        calculateBtn.disabled = false;

    } catch (error) {
        console.error(error);
        statusDiv.textContent = `❌ Error: ${error.message}`;
        calculateBtn.disabled = false;
    }
});
