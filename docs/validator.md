# CanxJS Validator

The `Validator` module provides a powerful and flexible way to validate incoming data, request bodies, and database records. It supports both synchronous and asynchronous validation.

## Basic Usage

```typescript
import { validate } from "canxjs";

const data = {
  email: "test@example.com",
  age: 25,
};

const rules = {
  email: "required|email",
  age: "required|min:18",
};

const result = validate(data, rules);

if (!result.valid) {
  console.log(result.errors);
} else {
  console.log("Data is valid!");
}
```

## Async Validation (Database Rules)

For rules that require database checks (like `unique` or `exists`), use `validateAsync`.

```typescript
import { validateAsync } from "canxjs";

const rules = {
  email: "required|email|unique:users,email",
  role_id: "exists:roles,id",
};

const result = await validateAsync(req.body, rules);
```

## Available Rules

| Rule               | Description                                            | Example              |
| ------------------ | ------------------------------------------------------ | -------------------- |
| `required`         | Field must be present and non-empty                    | `required`           |
| `string`           | Must be a string                                       | `string`             |
| `number`           | Must be a number                                       | `number`             |
| `array`            | Must be an array                                       | `array`              |
| `email`            | Must be a valid email format                           | `email`              |
| `boolean`          | Must be a boolean value                                | `boolean`            |
| `min:value`        | Minimum length (string/array) or value (number)        | `min:5`              |
| `max:value`        | Maximum length (string/array) or value (number)        | `max:255`            |
| `equals:field`     | Must match another field (e.g., password_confirmation) | `equals:password`    |
| `unique:table,col` | **(Async)** Value must be unique in database table     | `unique:users,email` |
| `exists:table,col` | **(Async)** Value must exist in database table         | `exists:roles,id`    |

## Pipe Syntax

Rules can be separated by a pipe `|` character:

```typescript
"required|string|email|unique:users";
```

## Custom Messages

You can provide custom error messages:

```typescript
validate(data, rules, {
  required: "The :field field is mandatory.",
  "email.email": "Please provide a valid email address.",
});
```
