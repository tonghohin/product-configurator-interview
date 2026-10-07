import type { CollectionConfig } from "payload";
import { catalogField, generalStatusField, titleField } from "./common";

export const Locations: CollectionConfig = {
	slug: "locations",
	admin: {
		useAsTitle: "title",
	},
	fields: [
		titleField,
		generalStatusField,
		{
			name: "organization",
			type: "relationship",
			relationTo: "organizations",
			required: true,
		},
		{
			name: "address",
			label: "Address of Location",
			type: "text",
			required: true,
		},
		catalogField,
	],
};
