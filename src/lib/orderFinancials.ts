/**
 * Centralized order financial calculations.
 *
 * Formulas (per order row):
 *   Subtotal         = (unit_price × qty) − discount
 *   Service Fee      = (subtotal × 10 %) + ($0.99 × qty)
 *   Total Processing = subtotal + service_fee
 *   Stripe Fee       = (total_processing × 2.9 %) + $0.30  ← $0.30 only once per checkout group
 *   Platform Revenue = service_fee − stripe_fee
 */

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface OrderFinancials {
  subtotal: number;
  serviceFee: number;
  processingValue: number;
  stripeFee: number;
  platformRevenue: number;
}

export interface OrderLike {
  unit_price: number | string;
  quantity: number | string;
  discount?: number | string | null;
  order_group_id?: string | null;
}

/** Compute financials for a single order row (stripe flat fee included — use aggregateFinancials for grouped accuracy). */
export const computeOrderFinancials = (o: OrderLike): OrderFinancials => {
  const unitPrice = Math.max(0, Number(o.unit_price) || 0);
  const qty = Math.max(1, Number(o.quantity) || 1);
  const discount = Math.max(0, Number(o.discount) || 0);

  const subtotal = unitPrice * qty - discount;
  const serviceFee = subtotal * 0.10 + 0.99 * qty;
  const processingValue = subtotal + serviceFee;
  const stripeFee = processingValue * 0.029 + 0.30;
  const platformRevenue = serviceFee - stripeFee;

  return {
    subtotal: round2(subtotal),
    serviceFee: round2(serviceFee),
    processingValue: round2(processingValue),
    stripeFee: round2(stripeFee),
    platformRevenue: round2(platformRevenue),
  };
};

/**
 * Aggregate financials for a list of orders, correctly applying the
 * Stripe $0.30 flat fee only once per order_group_id (checkout transaction).
 */
export const aggregateFinancials = (orders: OrderLike[]) => {
  let totalSubtotal = 0;
  let totalServiceFees = 0;
  let totalProcessing = 0;

  orders.forEach((o) => {
    const unitPrice = Math.max(0, Number(o.unit_price) || 0);
    const qty = Math.max(1, Number(o.quantity) || 1);
    const discount = Math.max(0, Number(o.discount) || 0);

    const subtotal = unitPrice * qty - discount;
    const serviceFee = subtotal * 0.10 + 0.99 * qty;
    const processingValue = subtotal + serviceFee;

    totalSubtotal += subtotal;
    totalServiceFees += serviceFee;
    totalProcessing += processingValue;
  });

  // Count unique checkout groups for the $0.30 flat fee
  const uniqueGroups = countUniqueGroups(orders);
  const totalStripeFees = totalProcessing * 0.029 + 0.30 * uniqueGroups;
  const netPlatformRevenue = totalServiceFees - totalStripeFees;

  return {
    grossTicketRevenue: round2(totalSubtotal),
    totalServiceFees: round2(totalServiceFees),
    totalProcessing: round2(totalProcessing),
    totalStripeFees: round2(totalStripeFees),
    netPlatformRevenue: round2(netPlatformRevenue),
  };
};

/**
 * Count unique order groups. Orders with the same order_group_id
 * are one checkout transaction. Orders without a group id are each
 * counted as their own transaction (legacy data).
 */
export const countUniqueGroups = (orders: OrderLike[]): number => {
  const seen = new Set<string>();
  let count = 0;
  for (const o of orders) {
    const gid = o.order_group_id;
    if (gid) {
      if (!seen.has(gid)) {
        seen.add(gid);
        count++;
      }
    } else {
      // Legacy order without group — counts as its own transaction
      count++;
    }
  }
  return count;
};
