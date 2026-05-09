import { supabase } from "@/integrations/supabase/client";

type MaybeNumber = number | string | null | undefined;

export interface RefundAwareOrder {
  id: string;
  unit_price?: MaybeNumber;
  quantity?: number | null;
  discount?: MaybeNumber;
  refunded_amount?: MaybeNumber;
  refundedAmount?: MaybeNumber;
  refunded_at?: string | null;
  refundedAt?: string | null;
  status?: string | null;
}

const roundCurrency = (value: number) => Number(value.toFixed(2));

export const getRefundedAmount = (order?: Partial<RefundAwareOrder> | null) =>
  Math.max(0, Number(order?.refunded_amount ?? order?.refundedAmount ?? 0));

export const isOrderRefunded = (order?: Partial<RefundAwareOrder> | null) =>
  Boolean(order && (order.status === "refunded" || order.refunded_at || order.refundedAt || getRefundedAmount(order) > 0));

export const getRefundableTicketAmount = (order: Pick<RefundAwareOrder, "unit_price" | "quantity" | "discount">) => {
  const grossTicketPrice = Math.max(0, Number(order.unit_price) || 0) * Math.max(1, Number(order.quantity) || 1);
  const promoDiscount = Math.max(0, Number(order.discount) || 0);
  return roundCurrency(Math.max(0, grossTicketPrice - promoDiscount));
};

export const getGrossTicketRevenue = (order: Pick<RefundAwareOrder, "unit_price" | "quantity">) => {
  return roundCurrency(Math.max(0, Number(order.unit_price) || 0) * Math.max(1, Number(order.quantity) || 1));
};

export const getNetOrderRevenue = (
  order: Pick<RefundAwareOrder, "unit_price" | "quantity" | "discount" | "refunded_amount" | "refundedAmount">
) => roundCurrency(Math.max(0, getRefundableTicketAmount(order) - getRefundedAmount(order)));

export const applyRefundToOrder = <T extends Record<string, any>>(
  order: T | null | undefined,
  refundAmount: number,
  refundedAt = new Date().toISOString()
): T | null | undefined => {
  if (!order) return order;

  const roundedRefundAmount = roundCurrency(refundAmount);

  return {
    ...order,
    status: "refunded",
    refunded: true,
    refunded_amount: roundedRefundAmount,
    refundedAmount: roundedRefundAmount,
    refunded_at: refundedAt,
    refundedAt,
  };
};

export const applyRefundToOrders = <T extends Record<string, any>>(
  orders: T[],
  orderId: string,
  refundAmount: number,
  refundedAt = new Date().toISOString()
) => orders.map((order) => (order.id === orderId ? (applyRefundToOrder(order, refundAmount, refundedAt) as T) : order));

export const refundOrder = async (orderId: string, refundAmount: number) => {
  const roundedRefundAmount = roundCurrency(refundAmount);
  const { data, error } = await (supabase as any).rpc("refund_order", {
    _order_id: orderId,
    _refund_amount: roundedRefundAmount,
  });

  if (error) throw error;
  return data;
};