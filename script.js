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
    const spacing = parseFloat(spacingInput.value); 

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
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(uploadedSVG, "image/svg+xml");
        const svgRoot = svgDoc.documentElement;
        
        // SVG එකේ ප්‍රමාණය (viewBox) එක ගන්නවා
        let viewBox = svgRoot.getAttribute('viewBox');
        let svgWidth = parseFloat(svgRoot.getAttribute('width')) || 1000;
        let svgHeight = parseFloat(svgRoot.getAttribute('height')) || 1000;
        
        // අපි තහඩුවේ ප්‍රමාණයට සාපේක්ෂව SVG එක scale කරනවා
        let scaleX = sheetW / svgWidth;
        let scaleY = sheetH / svgHeight;
        
        let shapes = Array.from(svgDoc.querySelectorAll('path, rect, circle, polygon, text'));
        let binElement = svgDoc.querySelector('#bin') || svgDoc.querySelector('#sheet');
        
        if(binElement) {
            shapes = shapes.filter(s => s !== binElement);
        }

        if(shapes.length === 0) throw new Error("SVG එකේ කිසිම හැඩයක් (අකුරක්) හම්බුණේ නෑ.");

        const items = [];

        shapes.forEach(shape => {
            const clone = shape.cloneNode(true);
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            tempSvg.appendChild(clone);
            document.body.appendChild(tempSvg);
            
            // අකුරේ ප්‍රමාණය ගන්නවා
            const bbox = clone.getBBox(); 
            document.body.removeChild(tempSvg);

            if(bbox.width > 0 && bbox.height > 0) {
                // මෙතනදි අපි අකුරු වල ප්‍රමාණය තහඩුවට ගැලපෙන්න scale කරනවා
                let actualW = bbox.width * scaleX;
                let actualH = bbox.height * scaleY;

                items.push({
                    w: actualW + spacing, 
                    h: actualH + spacing,
                    origShape: shape,
                    origW: actualW,
                    origH: actualH,
                    origX: bbox.x * scaleX,
                    origY: bbox.y * scaleY,
                    scaleX: scaleX,
                    scaleY: scaleY
                });
            }
        });

        const result = potpack(items);

        const usedW = Math.ceil(result.w);
        const usedH = Math.ceil(result.h);
        
        const sheetsWise = Math.ceil(usedW / sheetW);
        const sheetsHigh = Math.ceil(usedH / sheetH);
        const totalSheets = sheetsWise * sheetsHigh;

        resultDiv.innerHTML = `
            <h2>📊 ප්‍රතිඵලය</h2>
            <p><strong>යන Sheet ගණන:</strong> ${totalSheets} sheets</p>
            <p><strong>මුළු භාවිතා වූ ප්‍රමාණය:</strong> ${usedW.toFixed(0)} x ${usedH.toFixed(0)} (mm)</p>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
                Sheet size: ${sheetWidthInput.value} × ${sheetHeightInput.value} (${unitText}) <br>
                අකුරු අතර පරතරය: ${spacing} mm
            </p>
        `;
        resultDiv.classList.add('active');

        previewDiv.innerHTML = '';
        const canvas = document.createElement('canvas');
        
        // පින්තූරය ලස්සනට පේන්න ප්‍රමාණය හදනවා
        const displayScale = Math.min(800 / usedW, 600 / usedH, 1);
        canvas.width = usedW * displayScale;
        canvas.height = usedH * displayScale;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        
        // තහඩු මායිම් අඳිනවා
        for(let i=0; i<totalSheets; i++) {
            ctx.strokeRect(0, (i * sheetH) * displayScale, sheetW * displayScale, sheetH * displayScale); 
        }

        // අකුරු අඳිනවා
        items.forEach(item => {
            const shape = item.origShape;
            ctx.save();
            
            // Scale කරනවා
            ctx.scale(displayScale * item.scaleX, displayScale * item.scaleY);
            
            // හරි තැනට තියනවා
            ctx.translate(item.x / item.scaleX - item.origX / item.scaleX, item.y / item.scaleY - item.origY / item.scaleY);
            
            if (shape.tagName === 'path') {
                const path2d = new Path2D(shape.getAttribute('d'));
                ctx.fillStyle = '#000000'; 
                ctx.fill(path2d);
            } else if (shape.tagName === 'rect') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, item.origW / item.scaleX, item.origH / item.scaleY);
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
