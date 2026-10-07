import type { CollectionConfig } from "payload";
import {
	catalogField,
	generalStatusField,
	handleField,
	titleField,
} from "./common";

export const Organizations: CollectionConfig = {
	slug: "organizations",
	admin: {
		useAsTitle: "title",
	},
	fields: [
		generalStatusField,
		handleField,
		titleField,
		{
			name: "client",
			label: "Client of Organization",
			type: "relationship",
			relationTo: "clients",
			required: true,
		},
		{
			name: "locations",
			type: "join",
			collection: "locations",
			on: "organization",
		},
		catalogField,
	],
};
