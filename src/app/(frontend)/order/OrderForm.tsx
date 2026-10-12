"use client";

import {
	availableValues,
	describeSku,
	type Picks,
	type ProductConfiguration,
	resolveSku,
	type SelectedSku,
	setPick,
} from "@/lib/configurator";
import { errorMessage, toId } from "@/lib/utils";
import { type SubmitEvent, useRef, useState } from "react";
import { Spinner } from "../components/Spinner";
import {
	listProducts,
	loadProductConfiguration,
	submitSelection,
} from "./actions";

export type ClientOption = { id: number; title: string };

export type LocationOption = {
	id: number;
	title: string;
	organizationTitle: string;
	clientId: number | null;
};

type ProductOption = { id: number; title: string };

type SubmitResult = { allowed: SelectedSku[]; rejected: number[] };

/** Groups locations by organization for <optgroup>s, keeping title order */
const groupByOrganization = (locations: LocationOption[]) => {
	const groups = new Map<string, LocationOption[]>();
	for (const location of locations) {
		const group = groups.get(location.organizationTitle) ?? [];
		group.push(location);
		groups.set(location.organizationTitle, group);
	}
	return [...groups].sort(([a], [b]) => a.localeCompare(b));
};

/**
 * The client select stands in for logging in as that client: it only narrows
 * the locations offered, the server actions don't check it.
 */
export function OrderForm({
	clients,
	locations,
}: {
	clients: ClientOption[];
	locations: LocationOption[];
}) {
	const [clientId, setClientId] = useState<number | null>(null);
	const [locationId, setLocationId] = useState<number | null>(null);
	const [products, setProducts] = useState<ProductOption[] | null>(null);
	const [productsLoading, setProductsLoading] = useState(false);
	const [productId, setProductId] = useState<number | null>(null);
	const [config, setConfig] = useState<ProductConfiguration | null>(null);
	const [configLoading, setConfigLoading] = useState(false);
	const [picks, setPicks] = useState<Picks>([]);
	const [lines, setLines] = useState<SelectedSku[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<SubmitResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Responses to anything but the latest location/product pick are ignored
	const latestRequest = useRef(0);

	const resetProduct = () => {
		setProductId(null);
		setConfig(null);
		setConfigLoading(false);
		setPicks([]);
	};

	const changeLocation = async (id: number | null) => {
		const request = ++latestRequest.current;
		setLocationId(id);
		setProducts(null);
		resetProduct();
		setLines([]);
		setResult(null);
		setError(null);
		if (id == null) {
			setProductsLoading(false);
			return;
		}

		setProductsLoading(true);
		try {
			const loaded = await listProducts(id);
			if (request === latestRequest.current) setProducts(loaded);
		} catch (err) {
			if (request === latestRequest.current) setError(errorMessage(err));
		} finally {
			if (request === latestRequest.current) setProductsLoading(false);
		}
	};

	const changeClient = (id: number | null) => {
		setClientId(id);
		changeLocation(null);
	};

	const clientLocations = locations.filter(
		(location) => clientId != null && location.clientId === clientId,
	);

	const changeProduct = async (id: number | null) => {
		const request = ++latestRequest.current;
		resetProduct();
		setProductId(id);
		setError(null);
		if (id == null || locationId == null) return;

		setConfigLoading(true);
		try {
			const loaded = await loadProductConfiguration(locationId, id);
			if (request === latestRequest.current) setConfig(loaded);
		} catch (err) {
			if (request === latestRequest.current) setError(errorMessage(err));
		} finally {
			if (request === latestRequest.current) setConfigLoading(false);
		}
	};

	// A SKU can only be added once, so the pickers only lead to SKUs not yet added
	const addedIds = new Set(lines.map((line) => line.id));
	const remainingSkus =
		config?.skus.filter((sku) => !addedIds.has(sku.id)) ?? [];
	const resolved = config
		? resolveSku(config.options, remainingSkus, picks)
		: null;

	const addLine = () => {
		if (!config || !resolved) return;
		const productTitle =
			products?.find((product) => product.id === productId)?.title ?? "";
		const valueTitles = config.options.map(
			(option, index) =>
				option.values.find((value) => value.id === picks[index])?.title ?? "",
		);
		setLines([...lines, { id: resolved.id, productTitle, valueTitles }]);
		setResult(null);
		resetProduct();
	};

	const removeLine = (id: number) => {
		setLines(lines.filter((line) => line.id !== id));
		setResult(null);
	};

	const submit = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (locationId == null || lines.length === 0) return;
		setSubmitting(true);
		setError(null);
		try {
			setResult(
				await submitSelection(
					locationId,
					lines.map((line) => line.id),
				),
			);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form className="order-form" onSubmit={submit}>
			<div className="field">
				<label htmlFor="order-client">Client</label>
				<select
					id="order-client"
					value={clientId ?? ""}
					disabled={submitting}
					onChange={(event) => changeClient(toId(event.target.value))}
				>
					<option value="">Choose a client</option>
					{clients.map((client) => (
						<option key={client.id} value={client.id}>
							{client.title}
						</option>
					))}
				</select>
			</div>

			<div className="field">
				<label htmlFor="order-location">Location</label>
				<select
					id="order-location"
					value={locationId ?? ""}
					disabled={submitting || clientId == null}
					onChange={(event) => changeLocation(toId(event.target.value))}
				>
					<option value="">
						{clientId != null && clientLocations.length === 0
							? "This client has no active locations"
							: "Choose a location"}
					</option>
					{groupByOrganization(clientLocations).map(([organization, group]) => (
						<optgroup key={organization} label={organization}>
							{group.map((location) => (
								<option key={location.id} value={location.id}>
									{location.title}
								</option>
							))}
						</optgroup>
					))}
				</select>
			</div>

			{productsLoading && <Spinner label="Loading products…" />}

			{products && products.length === 0 && (
				<p className="notice">No products are available for this location.</p>
			)}

			{products && products.length > 0 && (
				<fieldset className="configurator" disabled={submitting}>
					<legend>Add a product</legend>
					<div className="field">
						<label htmlFor="order-product">Product</label>
						<select
							id="order-product"
							value={productId ?? ""}
							onChange={(event) => changeProduct(toId(event.target.value))}
						>
							<option value="">Choose a product</option>
							{products.map((product) => (
								<option key={product.id} value={product.id}>
									{product.title}
								</option>
							))}
						</select>
					</div>

					{configLoading && <Spinner label="Loading options…" />}

					{productId != null &&
						!configLoading &&
						!error &&
						(config == null || config.skus.length === 0) && (
							<p className="notice">
								No SKUs of this product are available here.
							</p>
						)}

					{config && config.skus.length > 0 && remainingSkus.length === 0 && (
						<p className="notice">
							Every SKU of this product is already added.
						</p>
					)}

					{config &&
						remainingSkus.length > 0 &&
						config.options.map((option, index) => {
							const picksBefore = picks.slice(0, index);
							const open = new Set(
								availableValues(option, remainingSkus, picksBefore).map(
									(value) => value.id,
								),
							);
							return (
								<div className="field" key={option.id}>
									<label htmlFor={`order-option-${option.id}`}>
										{option.title}
									</label>
									<select
										id={`order-option-${option.id}`}
										value={picks[index] ?? ""}
										disabled={index > 0 && picks[index - 1] == null}
										onChange={(event) =>
											setPicks(setPick(picks, index, toId(event.target.value)))
										}
									>
										<option value="">
											Choose {option.title.toLowerCase()}
										</option>
										{availableValues(option, config.skus, picksBefore).map(
											(value) => (
												<option
													key={value.id}
													value={value.id}
													disabled={!open.has(value.id)}
												>
													{value.title}
													{!open.has(value.id) && " (added)"}
												</option>
											),
										)}
									</select>
								</div>
							);
						})}

					{resolved && (
						<div className="resolved">
							<span>SKU #{resolved.id}</span>
							<button type="button" onClick={addLine}>
								Add
							</button>
						</div>
					)}
				</fieldset>
			)}

			{lines.length > 0 && (
				<section className="selection">
					<h2>Selected SKUs</h2>
					<ul>
						{lines.map((line) => (
							<li key={line.id}>
								<span>
									#{line.id} {describeSku(line)}
								</span>
								<button
									type="button"
									onClick={() => removeLine(line.id)}
									disabled={submitting}
								>
									Remove
								</button>
							</li>
						))}
					</ul>
					<button type="submit" disabled={submitting}>
						Submit
					</button>
					{submitting && <Spinner label="Submitting…" />}
				</section>
			)}

			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}

			{result && (
				<section className="result" aria-live="polite">
					<h2>Confirmed SKUs</h2>
					{result.allowed.length > 0 ? (
						<ul>
							{result.allowed.map((sku) => (
								<li key={sku.id}>
									#{sku.id} {describeSku(sku)}
								</li>
							))}
						</ul>
					) : (
						<p>None of the selected SKUs are available.</p>
					)}
					{result.rejected.length > 0 && (
						<p className="error">
							No longer available here:{" "}
							{result.rejected.map((id) => `#${id}`).join(", ")}
						</p>
					)}
				</section>
			)}
		</form>
	);
}
