"use strict";
/**
 * Local Filesystem Storage Driver
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDriver = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
class LocalDriver {
    root;
    urlPrefix;
    constructor(config) {
        this.root = config.root;
        this.urlPrefix = config.urlPrefix || '/storage';
        // Ensure root directory exists
        if (!(0, fs_1.existsSync)(this.root)) {
            (0, fs_1.mkdirSync)(this.root, { recursive: true });
        }
    }
    getFullPath(path) {
        return (0, path_1.join)(this.root, path);
    }
    async put(path, content) {
        const fullPath = this.getFullPath(path);
        const dir = (0, path_1.dirname)(fullPath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        }
        let data;
        if (content instanceof Blob) {
            data = Buffer.from(await content.arrayBuffer());
        }
        else {
            data = content;
        }
        await Bun.write(fullPath, data);
        return path;
    }
    async get(path) {
        const fullPath = this.getFullPath(path);
        const file = Bun.file(fullPath);
        if (!(await file.exists())) {
            throw new Error(`File not found: ${path}`);
        }
        return Buffer.from(await file.arrayBuffer());
    }
    async exists(path) {
        const fullPath = this.getFullPath(path);
        return Bun.file(fullPath).exists();
    }
    async delete(path) {
        const fullPath = this.getFullPath(path);
        try {
            (0, fs_1.unlinkSync)(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async copy(from, to) {
        try {
            const content = await this.get(from);
            await this.put(to, content);
            return true;
        }
        catch {
            return false;
        }
    }
    async move(from, to) {
        try {
            const success = await this.copy(from, to);
            if (success) {
                await this.delete(from);
            }
            return success;
        }
        catch {
            return false;
        }
    }
    url(path) {
        return `${this.urlPrefix}/${path}`;
    }
    async temporaryUrl(path, expiresIn) {
        // For local storage, generate a signed URL token
        const expires = Date.now() + (expiresIn * 1000);
        const token = Buffer.from(`${path}:${expires}`).toString('base64url');
        return `${this.urlPrefix}/${path}?token=${token}&expires=${expires}`;
    }
    async metadata(path) {
        const fullPath = this.getFullPath(path);
        const stat = (0, fs_1.statSync)(fullPath);
        const file = Bun.file(fullPath);
        return {
            path,
            size: stat.size,
            mimeType: file.type || 'application/octet-stream',
            lastModified: stat.mtime,
        };
    }
    async files(directory = '') {
        const fullPath = this.getFullPath(directory);
        if (!(0, fs_1.existsSync)(fullPath)) {
            return [];
        }
        const entries = (0, fs_1.readdirSync)(fullPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isFile())
            .map(entry => (0, path_1.join)(directory, entry.name));
    }
    async allFiles(directory = '') {
        const fullPath = this.getFullPath(directory);
        const results = [];
        if (!(0, fs_1.existsSync)(fullPath)) {
            return results;
        }
        const scan = (dir) => {
            const entries = (0, fs_1.readdirSync)(this.getFullPath(dir), { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = (0, path_1.join)(dir, entry.name);
                if (entry.isFile()) {
                    results.push(entryPath);
                }
                else if (entry.isDirectory()) {
                    scan(entryPath);
                }
            }
        };
        scan(directory);
        return results;
    }
    async makeDirectory(path) {
        const fullPath = this.getFullPath(path);
        try {
            (0, fs_1.mkdirSync)(fullPath, { recursive: true });
            return true;
        }
        catch {
            return false;
        }
    }
    async deleteDirectory(path) {
        const fullPath = this.getFullPath(path);
        try {
            const deleteRecursive = (dir) => {
                if ((0, fs_1.existsSync)(dir)) {
                    const entries = (0, fs_1.readdirSync)(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const entryPath = (0, path_1.join)(dir, entry.name);
                        if (entry.isDirectory()) {
                            deleteRecursive(entryPath);
                        }
                        else {
                            (0, fs_1.unlinkSync)(entryPath);
                        }
                    }
                    (0, fs_1.rmdirSync)(dir);
                }
            };
            deleteRecursive(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async append(path, content) {
        const fullPath = this.getFullPath(path);
        try {
            const existing = await this.exists(path) ? await this.get(path) : Buffer.alloc(0);
            const appended = Buffer.concat([existing, Buffer.from(content)]);
            await this.put(path, appended);
            return true;
        }
        catch {
            return false;
        }
    }
    async prepend(path, content) {
        const fullPath = this.getFullPath(path);
        try {
            const existing = await this.exists(path) ? await this.get(path) : Buffer.alloc(0);
            const prepended = Buffer.concat([Buffer.from(content), existing]);
            await this.put(path, prepended);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LocalDriver = LocalDriver;
exports.default = LocalDriver;
