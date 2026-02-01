"use strict";
/**
 * CanxJS Storage - File storage abstraction layer with multiple drivers
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDriver = exports.storage = void 0;
exports.handleUpload = handleUpload;
exports.handleMultipleUploads = handleMultipleUploads;
exports.initStorage = initStorage;
const LocalDriver_1 = require("./drivers/LocalDriver");
Object.defineProperty(exports, "LocalDriver", { enumerable: true, get: function () { return LocalDriver_1.LocalDriver; } });
// ============================================
// Storage Manager
// ============================================
class StorageManager {
    drivers = new Map();
    defaultDisk = 'local';
    config = {};
    /**
     * Initialize storage with configuration
     */
    initialize(config) {
        this.config = config;
        this.defaultDisk = config.default || 'local';
        // Auto-register local driver
        if (config.disks?.local) {
            this.registerDriver('local', new LocalDriver_1.LocalDriver(config.disks.local));
        }
        else {
            this.registerDriver('local', new LocalDriver_1.LocalDriver({ root: './storage' }));
        }
        // Register S3 driver if configured
        if (config.disks?.s3) {
            // Lazy load S3 driver
            Promise.resolve().then(() => __importStar(require('./drivers/S3Driver'))).then(({ S3Driver }) => {
                this.registerDriver('s3', new S3Driver(config.disks.s3));
            });
        }
    }
    /**
     * Register a storage driver
     */
    registerDriver(name, driver) {
        this.drivers.set(name, driver);
    }
    /**
     * Get a disk instance
     */
    disk(name) {
        const diskName = name || this.defaultDisk;
        const driver = this.drivers.get(diskName);
        if (!driver) {
            throw new Error(`Storage disk "${diskName}" not found. Available disks: ${Array.from(this.drivers.keys()).join(', ')}`);
        }
        return driver;
    }
    /**
     * Store a file (shortcut to default disk)
     */
    async put(path, content) {
        return this.disk().put(path, content);
    }
    /**
     * Get file contents
     */
    async get(path) {
        return this.disk().get(path);
    }
    /**
     * Get file as string
     */
    async getString(path, encoding = 'utf-8') {
        const buffer = await this.get(path);
        return buffer.toString(encoding);
    }
    /**
     * Check if file exists
     */
    async exists(path) {
        return this.disk().exists(path);
    }
    /**
     * Delete a file
     */
    async delete(path) {
        return this.disk().delete(path);
    }
    /**
     * Copy a file
     */
    async copy(from, to) {
        return this.disk().copy(from, to);
    }
    /**
     * Move a file
     */
    async move(from, to) {
        return this.disk().move(from, to);
    }
    /**
     * Get file URL
     */
    url(path) {
        return this.disk().url(path);
    }
    /**
     * Get temporary URL (for private files)
     */
    async temporaryUrl(path, expiresIn = 3600) {
        return this.disk().temporaryUrl(path, expiresIn);
    }
    /**
     * Get file metadata
     */
    async metadata(path) {
        return this.disk().metadata(path);
    }
    /**
     * List files in directory
     */
    async files(directory = '') {
        return this.disk().files(directory);
    }
    /**
     * List all files recursively
     */
    async allFiles(directory = '') {
        return this.disk().allFiles(directory);
    }
    /**
     * Create directory
     */
    async makeDirectory(path) {
        return this.disk().makeDirectory(path);
    }
    /**
     * Delete directory
     */
    async deleteDirectory(path) {
        return this.disk().deleteDirectory(path);
    }
    /**
     * Get file size in bytes
     */
    async size(path) {
        const meta = await this.metadata(path);
        return meta.size;
    }
    /**
     * Get file MIME type
     */
    async mimeType(path) {
        const meta = await this.metadata(path);
        return meta.mimeType;
    }
    /**
     * Append to file
     */
    async append(path, content) {
        return this.disk().append(path, content);
    }
    /**
     * Prepend to file
     */
    async prepend(path, content) {
        return this.disk().prepend(path, content);
    }
}
async function handleUpload(req, fieldName, options = {}) {
    const formData = await req.formData();
    const file = formData.get(fieldName);
    if (!file || !(file instanceof File)) {
        return null;
    }
    // Validate file type
    if (options.allowedTypes && options.allowedTypes.length > 0) {
        if (!options.allowedTypes.includes(file.type)) {
            throw new Error(`File type ${file.type} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`);
        }
    }
    // Validate file size
    if (options.maxSize && file.size > options.maxSize) {
        throw new Error(`File size ${file.size} exceeds maximum allowed size of ${options.maxSize} bytes`);
    }
    // Generate filename
    let filename;
    if (typeof options.filename === 'function') {
        filename = options.filename(file);
    }
    else if (options.filename) {
        filename = options.filename;
    }
    else {
        const ext = file.name.split('.').pop() || '';
        filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    }
    const directory = options.directory || 'uploads';
    const path = `${directory}/${filename}`;
    // Store file
    const disk = exports.storage.disk(options.disk);
    const buffer = Buffer.from(await file.arrayBuffer());
    await disk.put(path, buffer);
    return {
        path,
        url: disk.url(path),
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
    };
}
async function handleMultipleUploads(req, fieldName, options = {}) {
    const formData = await req.formData();
    const files = formData.getAll(fieldName);
    const results = [];
    for (const file of files) {
        if (file instanceof File) {
            // Create a mock request with this single file
            const mockFormData = new FormData();
            mockFormData.append(fieldName, file);
            const buffer = Buffer.from(await file.arrayBuffer());
            // Validate and process
            if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
                continue;
            }
            if (options.maxSize && file.size > options.maxSize) {
                continue;
            }
            const ext = file.name.split('.').pop() || '';
            const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const directory = options.directory || 'uploads';
            const path = `${directory}/${filename}`;
            const disk = exports.storage.disk(options.disk);
            await disk.put(path, buffer);
            results.push({
                path,
                url: disk.url(path),
                originalName: file.name,
                size: file.size,
                mimeType: file.type,
            });
        }
    }
    return results;
}
// ============================================
// Singleton & Exports
// ============================================
exports.storage = new StorageManager();
function initStorage(config) {
    exports.storage.initialize(config);
}
exports.default = exports.storage;
