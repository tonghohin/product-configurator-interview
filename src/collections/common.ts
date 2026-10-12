import {
	APIError,
	type CollectionBeforeDeleteHook,
	type Field,
	type TextFieldSingleValidation,
} from "payload";

const handlePattern = /^[a-zA-Z0-9-]+$/;

const handleValidation: TextFieldSingleValidation = async (
	handle: string | null | undefined,
) => {
	if (handle === undefined || handle === null) return "Handle must be provided";
	if (handlePattern.exec(handle)) return true;
	return "Invalid characters in handle";
};

export const handleField: Field = {
	name: "handle",
	type: "text",
	unique: true,
	required: true,
	validate: handleValidation,
};

export const titleField: Field = {
	name: "title",
	type: "text",
	required: true,
};

export const generalStatusField: Field = {
	name: "status",
	type: "select",
	hasMany: false,
	options: ["draft", "active", "archived"],
	defaultValue: "active",
	required: true,
};

export const catalogEntriesField = (
	on: "client" | "organization" | "location",
): Field => ({
	name: "catalogEntries",
	label: "SKU Catalog",
	type: "join",
	collection: "catalogEntries",
	on,
	admin: {
		description:
			"Products and SKUs available here. Overrides the parent's catalog entirely; leave empty to inherit from the parent.",
	},
});

/**
 * Runs before the delete because the owner/product columns are set to null
 * once the referenced document is gone, leaving nothing to match on.
 */
export const deleteCatalogEntriesOf =
	(
		field: "client" | "organization" | "location" | "product",
	): CollectionBeforeDeleteHook =>
	async ({ id, req }) => {
		// A bulk delete reports failures instead of throwing
		const { errors } = await req.payload.delete({
			collection: "catalogEntries",
			where: { [field]: { equals: id } },
			req,
		});
		if (errors.length > 0) {
			throw new APIError(
				`Could not delete the catalog entries of this ${field}`,
				500,
			);
		}
	};
