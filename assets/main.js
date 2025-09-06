/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

async function startApp() {
    // Dynamically load the @google/genai library from CDN and assign to window.
    const genaiModule = await import("https://aistudiocdn.com/@google/genai@^1.16.0");
    window.GoogleGenAI = genaiModule.GoogleGenAI;
    window.Modality = genaiModule.Modality;

    // Create a <script> tag to load Babel Standalone from CDN.
    const babelScript = document.createElement('script');
    babelScript.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
    document.body.appendChild(babelScript);

    // After Babel has loaded, create a second <script> tag for the app.
    babelScript.onload = () => {
        const appScript = document.createElement('script');
        appScript.type = 'text/babel';
        appScript.src = './assets/App.jsx';
        // data-presets is needed for JSX compilation
        appScript.setAttribute('data-presets', 'react');
        document.body.appendChild(appScript);

        // Onload of the app script, render the application.
        appScript.onload = () => {
            const container = document.getElementById('root');
            if (container) {
                const root = ReactDOM.createRoot(container);
                // The App.jsx file will expose ApiProvider and App on the window object.
                root.render(React.createElement(window.ApiProvider, null, React.createElement(window.App)));
            }
        };
    };
}

startApp();
