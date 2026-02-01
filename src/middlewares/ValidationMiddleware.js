"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = validateSchema;
const ValidationException_1 = require("../core/exceptions/ValidationException");
function validateSchema(schema, target = 'body') {
    return async (req, res, next) => {
        let data;
        if (target === 'body') {
            data = await req.body();
        }
        else if (target === 'query') {
            data = req.query;
        }
        else {
            data = req.params;
        }
        try {
            const validated = schema.parse(data);
            // Attach validated data to request for type safety in controllers
            req.validatedData = validated;
            return next();
        }
        catch (error) {
            if (error instanceof ValidationException_1.ValidationException) {
                return res.status(422).json({
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: Object.fromEntries(error.errors),
                    }
                });
            }
            throw error;
        }
    };
}
