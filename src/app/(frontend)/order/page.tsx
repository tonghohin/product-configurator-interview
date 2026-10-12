import { headers as getHeaders } from "next/headers.js";
import { getPayload } from "payload";
import { extractID } from "payload/shared";

import config from "@/payload.config";
import { type ClientOption, type LocationOption, OrderForm } from "./OrderForm";

export const metadata = {
	title: "Order",
};

export default async function OrderPage() {
	const headers = await getHeaders();
	const payloadConfig = await config;
	const payload = await getPayload({ config: payloadConfig });
	const { user } = await payload.auth({ headers });

	if (!user) {
		return (
			<div className="order">
				<h1>Order</h1>
				<p>
					<a href={`${payloadConfig.routes.admin}/login?redirect=/order`}>
						Log in
					</a>{" "}
					to place an order.
				</p>
			</div>
		);
	}

	const [{ docs: clientDocs }, { docs: locationDocs }] = await Promise.all([
		payload.find({
			collection: "clients",
			where: { status: { equals: "active" } },
			select: { title: true },
			sort: "title",
			depth: 0,
			pagination: false,
		}),
		// depth 1 populates the organization, leaving its client as an ID
		payload.find({
			collection: "locations",
			where: { status: { equals: "active" } },
			select: { title: true, organization: true },
			sort: "title",
			depth: 1,
			pagination: false,
		}),
	]);
	const clients: ClientOption[] = clientDocs.map(({ id, title }) => ({
		id,
		title,
	}));
	const locations: LocationOption[] = locationDocs.map((location) => {
		const organization =
			typeof location.organization === "object" ? location.organization : null;
		return {
			id: location.id,
			title: location.title,
			organizationTitle: organization?.title ?? "",
			clientId: organization ? extractID(organization.client) : null,
		};
	});

	return (
		<div className="order">
			<h1>Order</h1>
			<OrderForm clients={clients} locations={locations} />
		</div>
	);
}
