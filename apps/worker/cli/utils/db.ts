import { execSync } from "child_process";
import type { IApp, IUpdate } from "../../src/db/schema.js";

/*
 * Helper to convert a single key from camelCase to snake_case
 */
type CamelToSnake<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${CamelToSnake<U>}`
  : S;

/*
 * Convert object keys from camelCase to snake_case
 */
export type ToSnakeCase<T> = {
  [K in keyof T as CamelToSnake<K & string>]: T[K];
};

export type IAppRow = ToSnakeCase<IApp>;
export type IUpdateRow = ToSnakeCase<IUpdate>;

interface IQueryResult<T> {
  results: T[];
  success: boolean;
}

export async function queryDatabase<T>(sql: string): Promise<T[]> {
  try {
    const command = `npx wrangler d1 execute expo-ota-updates --remote --command="${sql.replace(
      /"/g,
      '\\"'
    )}"`;
    const output = execSync(command, { encoding: "utf-8" });

    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to parse database output");
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);

    // Validate the parsed structure
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid database output: expected array");
    }

    const firstResult = parsed[0];
    if (!firstResult || typeof firstResult !== "object") {
      return [];
    }

    const queryResult = firstResult as IQueryResult<T>;
    return queryResult.results || [];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
    throw error;
  }
}
