import {
	APIError,
	type CollectionBeforeDeleteHook,
	type CollectionConfig,
} from "payload";
import { generalStatusField, handleField, titleField } from "./common";

/** SKUs must keep one value per option, so a used value can't vanish */
const preventDeleteWhileUsedBySkus: CollectionBeforeDeleteHook = async ({
	id,
	req,
}) => {
	const { totalDocs } = await req.payload.count({
		collection: "skus",
		where: { productOptionValues: { in: [id] } },
		req,
	});
	if (totalDocs > 0) {
		throw new APIError(
			`Option value is used by ${totalDocs} ${totalDocs === 1 ? "SKU" : "SKUs"}; delete or change them first`,
			400,
			undefined,
			true,
		);
	}
};

export const ProductOptionValues: CollectionConfig = {
	slug: "productOptionValues",
	admin: {
		useAsTitle: "title",
	},
	hooks: {
		beforeDelete: [preventDeleteWhileUsedBySkus],
	},
	fields: [
		titleField,
		generalStatusField,
		handleField,
		{
			name: "productOption",
			type: "relationship",
			relationTo: "productOptions",
			required: true,
		},
		{
			name: "skus",
			type: "join",
			collection: "skus",
			on: "productOptionValues",
		},
	],
};
