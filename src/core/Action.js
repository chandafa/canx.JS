"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = void 0;
const Container_1 = require("../container/Container");
/**
 * Base Action Class
 * Actions represent a single task or operation in your application.
 * They encourage the "Single Responsibility Principle" and are easily testable.
 */
class Action {
    /**
     * Execute the action statically resolving from the container
     * @param input The input data for the action
     */
    static async run(input) {
        // Resolve from container to allow dependency injection
        const instance = await Container_1.container.resolve(this);
        return instance.handle(input);
    }
    /**
     * Execute the action as a standalone function (for passing to other functions)
     */
    static asFunction() {
        return async (input) => {
            const instance = await Container_1.container.resolve(this);
            return instance.handle(input);
        };
    }
}
exports.Action = Action;
