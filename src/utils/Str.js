"use strict";
/**
 * String Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomString = randomString;
exports.randomUuid = randomUuid;
exports.slug = slug;
function randomString(length = 16) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
function randomUuid() {
    return crypto.randomUUID();
}
function slug(str) {
    return str
        .toLowerCase()
        .replace(/[^\w ]+/g, '')
        .replace(/ +/g, '-');
}
