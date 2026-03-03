"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
exports.log = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};
