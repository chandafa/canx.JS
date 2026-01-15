import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { storage } from "../src/storage/Storage";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";

const TEST_DIR = "./tests/storage_tmp";

describe("Storage System", () => {
    beforeAll(() => {
        if (!existsSync(TEST_DIR)) {
            mkdirSync(TEST_DIR, { recursive: true });
        }
        storage.initialize({
            default: "local",
            disks: {
                local: { root: TEST_DIR }
            }
        });
    });

    afterAll(() => {
        if (existsSync(TEST_DIR)) {
            rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });

    test("should write and read files", async () => {
        const filename = "test.txt";
        const content = "Hello Storage";
        
        await storage.put(filename, content);
        
        const exists = await storage.exists(filename);
        expect(exists).toBe(true);
        
        const readContent = await storage.getString(filename);
        expect(readContent).toBe(content);
    });

    test("should delete files", async () => {
        const filename = "delete_me.txt";
        await storage.put(filename, "tmp");
        
        await storage.delete(filename);
        const exists = await storage.exists(filename);
        expect(exists).toBe(false);
    });

    test("should copy files", async () => {
        const src = "src.txt";
        const dest = "dest.txt";
        await storage.put(src, "content");
        
        await storage.copy(src, dest);
        
        expect(await storage.exists(src)).toBe(true);
        expect(await storage.exists(dest)).toBe(true);
        expect(await storage.getString(dest)).toBe("content");
    });
    
    test("should move files", async () => {
        const src = "move_src.txt";
        const dest = "move_dest.txt";
        await storage.put(src, "content");
        
        await storage.move(src, dest);
        
        expect(await storage.exists(src)).toBe(false);
        expect(await storage.exists(dest)).toBe(true);
    });
    
    test("should handle directories", async () => {
        const dir = "subdir";
        await storage.makeDirectory(dir);
        
        const path = `${dir}/file.txt`;
        await storage.put(path, "nested");
        
        const files = await storage.files(dir);
        expect(files).toContain(join(dir, "file.txt"));
        // path.join uses os separator.
    });
});
