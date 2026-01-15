import { describe, expect, test, afterAll } from "bun:test";
import { scheduler, Scheduler } from "../src/features/Scheduler";

describe("Scheduler", () => {
    
    // Create a fresh scheduler for tests
    const testScheduler = new Scheduler();

    afterAll(() => {
        testScheduler.stop();
    });

    // Access private members for testing using 'any'
    const getTask = (s: Scheduler) => (s as any).tasks[0];
    const parseInterval = (s: Scheduler, i: string) => (s as any).parseInterval(i);
    const matchesCron = (s: Scheduler, c: string, d: Date) => (s as any).matchesCron(c, d);

    describe("Task Registration", () => {
        test("should register a callback task", () => {
             const s = new Scheduler();
             s.call(() => {}).every("1m");
             const task = getTask(s);
             expect(task).toBeDefined();
             expect(task.type).toBe("callback");
             expect(task.schedule).toBe("1m");
             s.stop();
        });

        test("should register a command task", () => {
            const s = new Scheduler();
            s.command("echo hello").cron("* * * * *");
            const task = getTask(s);
            expect(task).toBeDefined();
            expect(task.type).toBe("command");
            expect(task.schedule).toBe("* * * * *");
            s.stop();
       });
    });

    describe("Interval Parsing", () => {
        test("should parse 10s correctly", () => {
            expect(parseInterval(testScheduler, "10s")).toBe(10000);
        });
        test("should parse 1m correctly", () => {
            expect(parseInterval(testScheduler, "1m")).toBe(60000);
        });
        test("should parse 1h correctly", () => {
            expect(parseInterval(testScheduler, "1h")).toBe(3600000);
        });
    });

    describe("Cron Matching", () => {
        test("should match basic cron * * * * *", () => {
            // Any date should match * * * * *
            expect(matchesCron(testScheduler, "* * * * *", new Date())).toBe(true);
        });

        test("should match specific minute", () => {
            const date = new Date("2023-01-01T12:30:00");
            // 30 12 * * *
            expect(matchesCron(testScheduler, "30 12 * * *", date)).toBe(true);
            expect(matchesCron(testScheduler, "29 12 * * *", date)).toBe(false);
        });

        test("should match lists", () => {
            const date = new Date("2023-01-01T12:05:00");
            expect(matchesCron(testScheduler, "0,5,10 * * * *", date)).toBe(true);
        });

        test("should match ranges", () => {
             const date = new Date("2023-01-01T12:15:00");
             expect(matchesCron(testScheduler, "10-20 * * * *", date)).toBe(true);
        });
    });

    // We can't easily test accurate execution timing without complex mocking,
    // so we trust the logic verification above.
});
