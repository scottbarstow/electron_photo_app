"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const client_1 = require("react-dom/client");
const App_1 = require("./App");
require("./index.css");
// Get the root element
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found. Make sure there is an element with id="root" in your HTML.');
}
// Create React root and render the app
const root = (0, client_1.createRoot)(rootElement);
root.render((0, jsx_runtime_1.jsx)(App_1.App, {}));
console.log('React app initialized successfully');
//# sourceMappingURL=index.js.map