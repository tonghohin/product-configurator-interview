"use server";

import config from "@payload-config";
import { headers as getHeaders } from "next/headers.js";
import { getPayload } from "payload";
import {
	getAllowedSkus,
	getAvailableProducts,
	getProductConfiguration,
} from "@/lib/catalog";
import type { ProductConfiguration, SelectedSku } from "@/lib/configurator";

/** Server actions are public endpoints, so each one checks for a user itself */
const requireUser = async () => {
	const payload = await getPayload({ config });
	const { user } = await payload.auth({ headers: await getHeaders() });
	if (!user) throw new Error("Not authenticated");
	return payload;
};

export const listProducts = async (
	locationId: number,
): Promise<{ id: number; title: string }[]> => {
	const payload = await requireUser();
	const products = await getAvailableProducts(payload, locationId);
	return products.map(({ id, title }) => ({ id, title }));
};

export const loadProductConfiguration = async (
	locationId: number,
	productId: number,
): Promise<ProductConfiguration | null> => {
	const payload = await requireUser();
	return getProductConfiguration(payload, locationId, productId);
};

export const submitSelection = async (
	locationId: number,
	skuIds: number[],
): Promise<{ allowed: SelectedSku[]; rejected: number[] }> => {
	const payload = await requireUser();
	if (!Array.isArray(skuIds) || skuIds.length === 0) {
		throw new Error("Select at least one SKU");
	}
	return getAllowedSkus(payload, locationId, [...new Set(skuIds)]);
};
