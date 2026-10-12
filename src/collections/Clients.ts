import type { CollectionConfig } from "payload";
import {
	catalogEntriesField,
	deleteCatalogEntriesOf,
	generalStatusField,
	handleField,
	titleField,
} from "./common";

export const Clients: CollectionConfig = {
	slug: "clients",
	admin: {
		useAsTitle: "title",
	},
	hooks: {
		beforeDelete: [deleteCatalogEntriesOf("client")],
	},
	fields: [
		titleField,
		handleField,
		generalStatusField,
		{
			name: "legal_name",
			label: "Legal Name of Client",
			type: "text",
			required: true,
		},
		{
			name: "legal_address",
			label: "Legal Address of Client",
			type: "text",
			required: true,
		},
		{
			name: "organizations",
			label: "Organizations",
			type: "join",
			collection: "organizations",
			on: "client",
		},
		catalogEntriesField("client"),
	],
};
