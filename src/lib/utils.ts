/** Turns a `<select>` value into an id; the empty placeholder means none */
export const toId = (value: string): number | null =>
	value === "" ? null : Number(value);

export const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Something went wrong";
