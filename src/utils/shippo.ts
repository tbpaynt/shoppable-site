const SHIPPO_API = "https://api.goshippo.com";

interface Address {
  name?: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export async function getCheapestRate(totalWeightOz: number, to: Address) {
  const addressFrom = {
    name: process.env.SHIP_FROM_NAME,
    street1: process.env.SHIP_FROM_STREET1,
    city: process.env.SHIP_FROM_CITY,
    state: process.env.SHIP_FROM_STATE,
    zip: process.env.SHIP_FROM_ZIP,
    country: process.env.SHIP_FROM_COUNTRY ?? "US",
  };

  const parcel = {
    length: 8,
    width: 6,
    height: 4,
    distance_unit: "in",
    weight: totalWeightOz,
    mass_unit: "oz",
  };

  const res = await fetch(`${SHIPPO_API}/shipments/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address_from: addressFrom, address_to: to, parcels: [parcel], async: false }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Shippo error: ${res.status} ${txt}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.rates) || json.rates.length === 0) {
    throw new Error("No rates returned");
  }
  json.rates.sort((a: any, b: any) => Number(a.amount) - Number(b.amount));
  const cheapest = json.rates[0];
  return {
    rateId: cheapest.object_id as string,
    provider: cheapest.provider as string,
    service: cheapest.servicelevel?.name as string,
    amount: Number(cheapest.amount),
    currency: cheapest.currency,
  };
}

// Generate a fresh rate specifically for label purchasing with complete address validation
export async function getRateForLabelPurchase(totalWeightOz: number, to: Address) {
  const addressFrom = {
    name: process.env.SHIP_FROM_NAME,
    street1: process.env.SHIP_FROM_STREET1,
    city: process.env.SHIP_FROM_CITY,
    state: process.env.SHIP_FROM_STATE,
    zip: process.env.SHIP_FROM_ZIP,
    country: process.env.SHIP_FROM_COUNTRY ?? "US",
  };

  const parcel = {
    length: 8,
    width: 6,
    height: 4,
    distance_unit: "in",
    weight: totalWeightOz,
    mass_unit: "oz",
  };

  console.log('🔥 SHIPPO: Creating shipment for label purchase with addresses:', {
    from: addressFrom,
    to: to,
    parcel
  });

  const res = await fetch(`${SHIPPO_API}/shipments/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      address_from: addressFrom, 
      address_to: to, 
      parcels: [parcel], 
      async: false 
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Shippo shipment error: ${res.status} ${txt}`);
  }

  const json = await res.json();
  console.log('🔥 SHIPPO: Shipment created with', json.rates?.length || 0, 'rates');

  if (!Array.isArray(json.rates) || json.rates.length === 0) {
    throw new Error("No rates returned for label purchase");
  }

  // Sort by price and get cheapest
  json.rates.sort((a: any, b: any) => Number(a.amount) - Number(b.amount));
  const cheapest = json.rates[0];
  
  console.log('🔥 SHIPPO: Selected cheapest rate:', cheapest.provider, cheapest.servicelevel?.name, '$' + cheapest.amount);
  
  return cheapest.object_id as string;
}

export async function purchaseLabel(rateId: string) {
  console.log('🔥 SHIPPO: Attempting to purchase label with rate ID:', rateId);
  
  const res = await fetch(`${SHIPPO_API}/transactions/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rate: rateId, label_file_type: "PDF" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo purchase error ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.status !== "SUCCESS") {
    const msg = Array.isArray(json.messages) && json.messages.length > 0 ? json.messages.map((m: any) => m.text).join("; ") : "Label purchase failed";
    throw new Error(msg);
  }
  return {
    trackingNumber: json.tracking_number as string,
    labelUrl: json.label_url as string,
  };
}

export interface LineItem {
  title: string;
  quantity: number;
  total_price: string; // in currency units as string e.g. "19.99"
  currency: string;
  weight?: number;
  weight_unit?: string;
}

/**
 * Create an order record in Shippo so it shows up in the Shippo dashboard.
 * This is useful for marketplaces / stores that want to manage fulfilment
 * from the Shippo Orders tab instead of the Shipments tab.
 */
export async function createShippoOrder(params: {
  orderNumber: string;
  addressTo: Address;
  lineItems: LineItem[];
  totalPrice: number; // in major currency units e.g. 49.95
  shippingCost?: number;
  taxAmount?: number;
  currency?: string;
}) {
  const {
    orderNumber,
    addressTo,
    lineItems,
    totalPrice,
    shippingCost,
    taxAmount,
    currency = "USD",
  } = params;

  const addressFrom = {
    name: process.env.SHIP_FROM_NAME,
    street1: process.env.SHIP_FROM_STREET1,
    city: process.env.SHIP_FROM_CITY,
    state: process.env.SHIP_FROM_STATE,
    zip: process.env.SHIP_FROM_ZIP,
    country: process.env.SHIP_FROM_COUNTRY ?? "US",
  };

  // Calculate total weight from line items
  const totalWeight = lineItems.reduce((sum, item) => {
    const itemWeight = typeof item.weight === 'number' ? item.weight : 0;
    return sum + (itemWeight * item.quantity);
  }, 0);

  const payload: any = {
    order_number: orderNumber.toString(),
    order_status: "PAID",
    placed_at: new Date().toISOString(),
    to_address: addressTo,
    from_address: addressFrom,
    line_items: lineItems,
    total_price: totalPrice.toFixed(2),
    currency: currency,
    weight: totalWeight,
    weight_unit: "oz",
    async: false,
  };

  if (shippingCost !== undefined) {
    payload.shipping_cost = shippingCost.toFixed(2);
    payload.shipping_cost_currency = currency;
  }
  if (taxAmount !== undefined) {
    payload.total_tax = taxAmount.toFixed(2);
    payload.total_tax_currency = currency;
  }

  console.log('🔥 SHIPPO: Creating order:', payload.order_number);
  
  const res = await fetch(`${SHIPPO_API}/orders/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shippo order error ${res.status}: ${text}`);
  }

  return res.json();
} 