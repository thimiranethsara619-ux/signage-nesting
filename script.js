let uploadedSVG = null;

const fileInput = document.getElementById('svgFile');
const calculateBtn = document.getElementById('calculateBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const previewDiv = document.getElementById('preview');
const sheetWidthInput = document.getElementById('sheetWidth');
const sheetHeightInput = document.getElementById('sheetHeight');
const spacingInput = document.getElementById('spacing');
const rotationsSelect = document.getElementById('rotations');
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
    const rotations = parseInt(rotationsSelect.value);

    if (!sheetW || !sheetH) {
        alert("Sheet size එක හරියට දාන්න!");
        return;
    }

    calculateBtn.disabled = true;
    statusDiv.textContent = "⏳ ගණනය කරමින්... (ටිකක් වෙලා ගන්නවා)";
    statusDiv.classList.add('active');
    resultDiv.classList.remove('active');
    previewDiv.classList.remove('active');

    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(uploadedSVG, "image/svg+xml");
        const svgRoot = svgDoc.documentElement;

        let binElement = svgDoc.querySelector('#bin') || 
                         svgDoc.querySelector('#sheet') || 
                         svgDoc.querySelector('rect');

        if (!binElement) {
            binElement = svgDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
            binElement.setAttribute("width", sheetW);
            binElement.setAttribute("height", sheetH);
            binElement.setAttribute("fill", "none");
            binElement.setAttribute("stroke", "black");
            binElement.setAttribute("id", "bin");
            svgRoot.appendChild(binElement);
        }

        binElement.setAttribute("width", sheetW);
        binElement.setAttribute("height", sheetH);

        const svgString = new XMLSerializer().serializeToString(svgDoc);
        
        // SVGNest ලයිබ්‍රරි එකේ මූලික කොටස
        const nest = new SvgNest();
        const root = nest.parseSvg(svgString);
        const bin = root.querySelector('#bin');
        
        if (!bin) throw new Error("Sheet එක හම්බුණේ නෑ. ඔයාගේ SVG එකේ rectangle එකට id='bin' දාලා තියෙනවද බලන්න.");
        nest.setBin(bin);

        nest.config({
            spacing: spacing,
            rotations: rotations,
            populationSize: 10,
            mutationRate: 10
        });

        nest.start(
            (progress) => {
                statusDiv.textContent = `⏳ ගණනය කරමින්... ${Math.round(progress * 100)}%`;
            },
            (svgList, efficiency, placedCount, totalCount) => {
                if (!svgList || svgList.length === 0) {
                    statusDiv.textContent = "❌ Nesting එක fail වුණා. Sheet size එක මදි වෙන්න පුළුවන්.";
                    calculateBtn.disabled = false;
                    return;
                }

                const sheetsUsed = svgList.length;
                const wastePercent = ((1 - efficiency) * 100).toFixed(1);

                resultDiv.innerHTML = `
                    <h2>📊 ප්‍රතිඵලය</h2>
                    <p><strong>යන Sheet ගණන:</strong> ${sheetsUsed} sheets</p>
                    <p><strong>භාවිතය:</strong> ${(efficiency * 100).toFixed(1)}%</p>
                    <p><strong>නාස්තිය:</strong> ${wastePercent}%</p>
                    <p style="color: #666; font-size: 14px; margin-top: 15px;">
                        Sheet size: ${sheetWidthInput.value} × ${sheetHeightInput.value} (${unitText}) <br>
                        අකුරු අතර පරතරය: ${spacingInput.value} (${unitText}) <br>
                        භ්‍රමණ: ${rotations} කෝණ
                    </p>
                `;
                resultDiv.classList.add('active');

                previewDiv.innerHTML = '';
                svgList.forEach((svgEl, index) => {
                    const wrapper = document.createElement('div');
                    wrapper.style.marginBottom = '20px';
                    wrapper.style.borderBottom = '2px solid #ddd';
                    wrapper.style.paddingBottom = '10px';
                    
                    const title = document.createElement('h3');
                    title.textContent = `Sheet ${index + 1}`;
                    title.style.margin = '10px';
                    
                    wrapper.appendChild(title);
                    wrapper.appendChild(svgEl);
                    previewDiv.appendChild(wrapper);
                });
                previewDiv.classList.add('active');

                statusDiv.textContent = `✅ අවසන්! Sheet ${sheetsUsed}ක් යනවා.`;
                calculateBtn.disabled = false;
            }
        );

    } catch (error) {
        console.error(error);
        statusDiv.textContent = `❌ Error: ${error.message}`;
        calculateBtn.disabled = false;
    }
});
