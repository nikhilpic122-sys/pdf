<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minimal PDF Viewer</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Custom styles for the PDF viewer */
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }

        /* Hide scrollbars for a cleaner look, but allow scrolling */
        .pdf-viewer-container::-webkit-scrollbar {
            display: none; /* For Chrome, Safari, Opera */
        }
        .pdf-viewer-container {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
    </style>
</head>
<body>
    <div id="pdfViewer" class="relative w-full max-w-4xl bg-white shadow-lg rounded-xl overflow-hidden flex flex-col items-center p-4 md:p-8">
        <!-- Loading indicator -->
        <div id="loadingMessage" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-20 text-gray-700 text-lg font-semibold rounded-xl">
            Loading PDF...
        </div>

        <!-- PDF Canvas Container -->
        <div id="canvasContainer" class="relative w-full h-full flex justify-center items-center overflow-auto pdf-viewer-container">
            <canvas id="pdfCanvas" class="max-w-full h-auto rounded-lg"></canvas>
        </div>

        <!-- Navigation Arrows (Hidden by default, visible on hover) -->
        <button id="prevPage" class="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 text-gray-600 p-2.5 rounded-full shadow-md opacity-0 transition-opacity duration-300 hover:opacity-100 focus:opacity-100 hover:bg-white/50 hover:scale-105 transition-transform duration-300 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <button id="nextPage" class="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 text-gray-600 p-2.5 rounded-full shadow-md opacity-0 transition-opacity duration-300 hover:opacity-100 focus:opacity-100 hover:bg-white/50 hover:scale-105 transition-transform duration-300 z-10">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </button>

        <!-- Page Number Indicator (Hidden by default, visible on hover) -->
        <div id="pageInfo" class="absolute bottom-4 bg-white/50 text-gray-800 px-3 py-1.5 rounded-full opacity-0 transition-opacity duration-300 pointer-events-none text-sm z-10">
            Page <span id="currentPageNum">1</span> of <span id="totalPagesNum">1</span>
        </div>

        <!-- Zoom Buttons (Hidden by default, visible on hover) -->
        <div id="zoomControls" class="absolute bottom-4 right-4 flex space-x-2 opacity-0 transition-opacity duration-300 z-10">
            <button id="zoomIn" class="bg-white/50 text-gray-800 p-2.5 rounded-full shadow-md hover:bg-white/70 hover:scale-105 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </button>
            <button id="zoomOut" class="bg-white/50 text-gray-800 p-2.5 rounded-full shadow-md hover:bg-white/70 hover:scale-105 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
                </svg>
            </button>
        </div>
    </div>

    <!-- PDF.js library -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
    <script>
        // Set the worker source for PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        let pdfDoc = null; // Stores the PDF document object
        let pageNum = 1; // Current page number
        let pageRendering = false; // Flag to prevent multiple page renders
        let pageNumPending = null; // Stores page number if a render is pending
        let currentScale = 1.0; // Current zoom scale

        // Get DOM elements
        const pdfViewer = document.getElementById('pdfViewer');
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const currentPageNumSpan = document.getElementById('currentPageNum');
        const totalPagesNumSpan = document.getElementById('totalPagesNum');
        const loadingMessage = document.getElementById('loadingMessage');
        const pageInfo = document.getElementById('pageInfo');
        const zoomControls = document.getElementById('zoomControls');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');

        // --- UI Visibility on Hover ---
        let timeoutId;
        const showUI = () => {
            clearTimeout(timeoutId);
            prevPageBtn.classList.remove('opacity-0');
            nextPageBtn.classList.remove('opacity-0');
            pageInfo.classList.remove('opacity-0');
            zoomControls.classList.remove('opacity-0'); // Show zoom controls
        };

        const hideUI = () => {
            timeoutId = setTimeout(() => {
                prevPageBtn.classList.add('opacity-0');
                nextPageBtn.classList.add('opacity-0');
                pageInfo.classList.add('opacity-0');
                zoomControls.classList.add('opacity-0'); // Hide zoom controls
            }, 1000); // Hide after 1 second of inactivity
        };

        pdfViewer.addEventListener('mouseenter', showUI);
        pdfViewer.addEventListener('mousemove', showUI);
        pdfViewer.addEventListener('mouseleave', hideUI);
        // Also hide UI if mouse leaves the buttons or page info
        prevPageBtn.addEventListener('mouseleave', hideUI);
        nextPageBtn.addEventListener('mouseleave', hideUI);
        pageInfo.addEventListener('mouseleave', hideUI);
        zoomControls.addEventListener('mouseleave', hideUI); // Hide if mouse leaves zoom controls


        /**
         * Renders a specific page of the PDF.
         * @param {number} num The page number to render.
         */
        async function renderPage(num) {
            pageRendering = true;
            loadingMessage.classList.remove('hidden'); // Show loading message

            try {
                // Get the page from the PDF document
                const page = await pdfDoc.getPage(num);

                // Determine the desired scale based on current zoom and container width
                const containerWidth = canvas.parentElement.clientWidth;
                const viewport = page.getViewport({ scale: 1 });
                // Calculate base scale to fit width, then apply current zoom
                const baseScale = containerWidth / viewport.width;
                const scaledViewport = page.getViewport({ scale: baseScale * currentScale });

                // Set canvas dimensions
                canvas.height = scaledViewport.height;
                canvas.width = scaledViewport.width;

                // Render the page on the canvas
                const renderContext = {
                    canvasContext: ctx,
                    viewport: scaledViewport,
                };
                await page.render(renderContext).promise;

                pageRendering = false;
                if (pageNumPending !== null) {
                    // New page rendering is pending
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            } catch (error) {
                console.error('Error during page rendering:', error);
                loadingMessage.textContent = 'Error loading page.';
            } finally {
                loadingMessage.classList.add('hidden'); // Hide loading message
                currentPageNumSpan.textContent = num; // Update current page number display
            }
        }

        /**
         * Queues a page rendering if another page is already being rendered.
         * @param {number} num The page number to render.
         */
        function queueRenderPage(num) {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                renderPage(num);
            }
        }

        /**
         * Displays the previous page.
         */
        function onPrevPage() {
            if (pageNum <= 1) {
                return; // Already on the first page
            }
            pageNum--;
            queueRenderPage(pageNum);
        }

        /**
         * Displays the next page.
         */
        function onNextPage() {
            if (pageNum >= pdfDoc.numPages) {
                return; // Already on the last page
            }
            pageNum++;
            queueRenderPage(pageNum);
        }

        /**
         * Increases the zoom level.
         */
        function onZoomIn() {
            currentScale += 0.2; // Increase scale by 20%
            if (currentScale > 3.0) currentScale = 3.0; // Max zoom
            queueRenderPage(pageNum);
        }

        /**
         * Decreases the zoom level.
         */
        function onZoomOut() {
            currentScale -= 0.2; // Decrease scale by 20%
            if (currentScale < 0.5) currentScale = 0.5; // Min zoom
            queueRenderPage(pageNum);
        }

        // Add event listeners for navigation and zoom buttons
        prevPageBtn.addEventListener('click', onPrevPage);
        nextPageBtn.addEventListener('click', onNextPage);
        zoomInBtn.addEventListener('click', onZoomIn);
        zoomOutBtn.addEventListener('click', onZoomOut);

        /**
         * Attempts to convert a Google Drive "view" link to a direct PDF export link.
         * This function is kept for dynamic URL input, but the default URL is now direct.
         * @param {string} url The original Google Drive URL.
         * @returns {string} The converted URL, or the original URL if no conversion is needed/possible.
         */
        function getDirectPdfUrl(url) {
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname === 'drive.google.com') {
                    // Handle /file/d/{id}/view and similar
                    const match = urlObj.pathname.match(/\/d\/([^/]+)/);
                    if (match && match[1]) {
                        return `https://drive.google.com/uc?id=${match[1]}&export=download`;
                    }
                    // Handle /open?id={id}
                    if (urlObj.pathname === '/open' && urlObj.searchParams.has('id')) {
                        return `https://drive.google.com/uc?id=${urlObj.searchParams.get('id')}&export=download`;
                    }
                }
            } catch (e) {
                console.warn("Could not parse URL or convert Google Drive link:", e);
            }
            return url; // Return original URL if conversion fails or not a Google Drive link
        }


        /**
         * Loads the PDF document.
         * @param {string} url The URL of the PDF document.
         */
        async function loadPdf(url) {
            loadingMessage.classList.remove('hidden'); // Show loading message
            try {
                // Attempt to convert Google Drive links to direct download links
                // This will only run if a URL parameter is provided.
                // The default URL is already a direct link.
                const pdfUrl = url.includes('drive.google.com') ? getDirectPdfUrl(url) : url;

                // Load the PDF document
                const loadingTask = pdfjsLib.getDocument(pdfUrl);
                pdfDoc = await loadingTask.promise;

                totalPagesNumSpan.textContent = pdfDoc.numPages; // Update total pages display
                loadingMessage.classList.add('hidden'); // Hide loading message
                renderPage(pageNum); // Render the first page
            } catch (error) {
                console.error('Error loading PDF:', error);
                loadingMessage.textContent = 'Error loading PDF. Please check the URL or ensure it\'s a publicly accessible PDF. (Details in console)';
            }
        }

        // Initial load: Check for 'url' parameter in the browser's URL
        window.onload = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const pdfLink = urlParams.get('url');

            // Using the direct download URL for the provided Google Drive link as default
            const defaultPdfUrl = 'https://drive.google.com/uc?id=1ZjuiSLk-BxzivD0HNaG1yvxyAx0PH7mS&export=download';

            if (pdfLink) {
                loadPdf(pdfLink);
            } else {
                loadPdf(defaultPdfUrl); // Load the default Google Drive link
            }

            // Handle window resize to re-render the current page with correct scaling
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (pdfDoc) {
                        // Reset zoom to fit width on resize for better responsiveness
                        currentScale = 1.0;
                        renderPage(pageNum); // Re-render current page on resize
                    }
                }, 250); // Debounce resize event
            });
        };
    </script>
</body>
</html>